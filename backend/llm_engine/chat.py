# Conversa sobre o material já processado. Recebe o histórico em JSON pelo stdin
# ([{"role": "user"|"assistant", "content": "..."}]) e escreve a resposta no stdout
# conforme o modelo gera.
import argparse
import json
import sys
from pathlib import Path
from core.llm_factory import LLMFactory
from core.prompt_builder import PromptBuilder
from core.settings import Settings
from core.material import read_material

def main():
    parser = argparse.ArgumentParser(description="Tira dúvidas sobre o material processado")
    parser.add_argument("--job-dir", required=True, help="Pasta com os resultados (fontes.txt)")
    parser.add_argument("--lang", default="pt", help="Idioma das respostas (pt, en, es)")
    parser.add_argument("--model", help="Modelo do Ollama (padrão: o das configurações)")
    parser.add_argument("--settings", help="Arquivo settings.json salvo pela interface")
    args = parser.parse_args()

    history = json.load(sys.stdin)
    material = read_material(Path(args.job_dir))

    system = (
        "Você é um monitor acadêmico tirando dúvidas de um estudante sobre o material abaixo. "
        "Responda de forma clara e direta, com base no material. "
        "Se a resposta não estiver no material, diga isso antes de complementar com o que você sabe.\n"
        f"{PromptBuilder.language_rule(args.lang)}\n\n"
        f"MATERIAL:\n{material}"
    )
    messages = [{"role": "system", "content": system}] + history

    for chunk in LLMFactory.chat_stream(messages, Settings(args.settings, args.model).model):
        sys.stdout.write(chunk)
        sys.stdout.flush()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[!] {e}", file=sys.stderr, flush=True)
        sys.exit(1)
