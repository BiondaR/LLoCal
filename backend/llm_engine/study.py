# Artefatos de estudo gerados sob demanda a partir de um material já processado
# (fontes.txt na pasta do job): flashcards, teste de múltipla escolha e audioresumo.
# Cada tipo grava <tipo>.json (lido pela interface) e os arquivos para baixar.
import argparse
import base64
import json
import random
import re
import subprocess
import sys
import wave
from pathlib import Path
from core.llm_factory import LLMFactory
from core.prompt_builder import PromptBuilder
from core.settings import Settings

# Limite do material enviado ao modelo, para caber no contexto
MAX_SOURCE_CHARS = 36000

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

# TTS principal: Kokoro, que soa mais natural. idioma -> (voz, código de idioma do Kokoro)
KOKORO_DIR = MODELS_DIR / "kokoro"
KOKORO_VOICES = {
    "pt": ("pf_dora", "pt-br"),
    "en": ("af_heart", "en-us"),
    "es": ("ef_dora", "es"),
    "fr": ("ff_siwis", "fr-fr"),
    "it": ("if_sara", "it"),
}

# TTS reserva: Piper, para os idiomas sem voz no Kokoro (alemão) ou se o Kokoro não estiver instalado
VOICES_DIR = MODELS_DIR / "piper"
VOICES = {
    "pt": "pt_BR-faber-medium",
    "en": "en_US-lessac-medium",
    "es": "es_ES-davefx-medium",
    "fr": "fr_FR-siwis-medium",
    "de": "de_DE-thorsten-medium",
    "it": "it_IT-paola-medium",
}

FLASHCARDS_SCHEMA = {
    "type": "object",
    "properties": {
        "cards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"front": {"type": "string"}, "back": {"type": "string"}},
                "required": ["front", "back"],
            },
        }
    },
    "required": ["cards"],
}

QUIZ_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "answer": {"type": "integer"},
                    "explanation": {"type": "string"},
                },
                "required": ["question", "options", "answer", "explanation"],
            },
        }
    },
    "required": ["questions"],
}

def one_line(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()

def make_flashcards(material: str, lang: str, out_dir: Path, settings: Settings) -> dict:
    reply = LLMFactory.call(PromptBuilder.build_flashcards_prompt(material, lang, settings.instructions("flashcards")), model=settings.model, format=FLASHCARDS_SCHEMA)
    cards = [
        {"front": one_line(c["front"]), "back": one_line(c["back"])}
        for c in json.loads(reply).get("cards", [])
        if c.get("front", "").strip() and c.get("back", "").strip()
    ]
    if not cards:
        raise RuntimeError("O modelo não devolveu nenhum flashcard.")

    # Texto separado por tabulação: o formato que o Anki importa direto
    with open(out_dir / "flashcards.tsv", "w", encoding="utf-8") as f:
        for card in cards:
            f.write(f"{card['front']}\t{card['back']}\n")

    return {"cards": cards}

def make_quiz(material: str, lang: str, out_dir: Path, settings: Settings) -> dict:
    reply = LLMFactory.call(PromptBuilder.build_quiz_prompt(material, lang, settings.instructions("quiz")), model=settings.model, format=QUIZ_SCHEMA)
    questions = []
    for q in json.loads(reply).get("questions", []):
        options = [one_line(o) for o in q.get("options", [])]
        answer = q.get("answer")
        if len(options) != 4 or not isinstance(answer, int) or not 0 <= answer < 4:
            continue
        # Embaralha: os modelos tendem a deixar a correta sempre na mesma posição
        correct = options[answer]
        random.shuffle(options)
        questions.append({
            "question": one_line(q["question"]),
            "options": options,
            "answer": options.index(correct),
            "explanation": one_line(q.get("explanation", "")),
        })
    if not questions:
        raise RuntimeError("O modelo não devolveu nenhuma questão válida.")

    letters = "ABCD"
    with open(out_dir / "quiz.md", "w", encoding="utf-8") as f:
        for i, q in enumerate(questions, 1):
            f.write(f"**{i}. {q['question']}**\n\n")
            for letter, option in zip(letters, q["options"]):
                f.write(f"- {letter}) {option}\n")
            f.write("\n")
        f.write("---\n\n")
        for i, q in enumerate(questions, 1):
            f.write(f"{i}. **{letters[q['answer']]}** — {q['explanation']}\n")

    return {"questions": questions}

def clean_script(script: str) -> str:
    """Tira do roteiro tudo que o TTS leria em voz alta sem fazer parte da narração."""
    # Restos de markdown e indicações de cena "(...)"
    script = re.sub(r"[*_#`>]", "", script)
    script = re.sub(r"^\s*[(\[][^)\]\n]*[)\]]\s*$", "", script, flags=re.M)

    # Título ou rótulo que o modelo põe antes do texto ("Roteiro do audioresumo:")
    lines = script.strip().split("\n")
    while len(lines) > 1:
        first = lines[0].strip()
        is_label = first.endswith(":") and len(first) < 120
        is_title = len(first) < 60 and not first.endswith((".", "!", "?")) and not lines[1].strip()
        if first and not (is_label or is_title):
            break
        lines = lines[1:]
    # Aspas em volta do roteiro inteiro
    return "\n".join(lines).strip().strip('"“”').strip()

def synthesize(script: str, lang: str, wav_path: Path):
    """Lê o roteiro em voz alta e grava um WAV."""
    kokoro_model = KOKORO_DIR / "kokoro-v1.0.onnx"
    if lang in KOKORO_VOICES and kokoro_model.exists():
        import numpy as np
        from kokoro_onnx import Kokoro

        voice, kokoro_lang = KOKORO_VOICES[lang]
        kokoro = Kokoro(str(kokoro_model), str(KOKORO_DIR / "voices-v1.0.bin"))
        samples, sample_rate = kokoro.create(script, voice=voice, speed=1.0, lang=kokoro_lang)
        with wave.open(str(wav_path), "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes((np.clip(samples, -1, 1) * 32767).astype(np.int16).tobytes())
        return

    from piper import PiperVoice

    voice_path = VOICES_DIR / f"{VOICES[lang]}.onnx"
    if not voice_path.exists():
        raise RuntimeError(f"Voz do Piper não encontrada: {voice_path}")
    voice = PiperVoice.load(str(voice_path))
    with wave.open(str(wav_path), "wb") as wav_file:
        voice.synthesize_wav(script, wav_file)

def make_audio(material: str, lang: str, out_dir: Path, settings: Settings) -> dict:
    script = LLMFactory.call(PromptBuilder.build_audio_script_prompt(material, lang, settings.instructions("audio")), model=settings.model)
    script = clean_script(script)
    if not script:
        raise RuntimeError("O modelo não devolveu o roteiro do áudio.")
    (out_dir / "audioresumo_roteiro.txt").write_text(script, encoding="utf-8")

    wav_path = out_dir / "audioresumo.wav"
    synthesize(script, lang, wav_path)

    mp3_path = out_dir / "audioresumo.mp3"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(wav_path), "-codec:a", "libmp3lame", "-qscale:a", "4", str(mp3_path)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    wav_path.unlink()

    return {"script": script, "audio": base64.b64encode(mp3_path.read_bytes()).decode("ascii")}

MAKERS = {"flashcards": make_flashcards, "quiz": make_quiz, "audio": make_audio}

def main():
    parser = argparse.ArgumentParser(description="Gera flashcards, teste ou audioresumo do material processado")
    parser.add_argument("--job-dir", required=True, help="Pasta com os resultados (fontes.txt)")
    parser.add_argument("--kind", required=True, choices=MAKERS.keys())
    parser.add_argument("--lang", default="pt", help="Idioma do resultado (pt, en, es)")
    parser.add_argument("--model", help="Modelo do Ollama (padrão: o das configurações)")
    parser.add_argument("--settings", help="Arquivo settings.json salvo pela interface")
    args = parser.parse_args()

    out_dir = Path(args.job_dir)
    material = (out_dir / "fontes.txt").read_text(encoding="utf-8", errors="replace")[:MAX_SOURCE_CHARS]
    lang = PromptBuilder.language_code(args.lang)

    data = MAKERS[args.kind](material, lang, out_dir, Settings(args.settings, args.model))

    with open(out_dir / f"{args.kind}.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"[V] {args.kind} gerado em: {out_dir}", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[!] {e}", file=sys.stderr, flush=True)
        sys.exit(1)
