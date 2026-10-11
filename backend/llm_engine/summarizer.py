# Rodar pipreqs llm_engine/ pra gerar os requirements
import argparse
import sys
from pathlib import Path
from core.document_parser import DocumentParser
from core.prompt_builder import PromptBuilder
from core.llm_factory import LLMFactory
from core.settings import Settings
from render.mindmap_generator import MindmapGenerator

def report(event: str, value: str = ""):
    """Linha de status lida pela interface (prefixo @@)."""
    print(f"@@{event} {value}".rstrip(), flush=True)

def strip_preamble(text: str) -> str:
    """Remove a frase de abertura que o modelo às vezes escreve ("Aqui está o resumo...:")."""
    lines = text.strip().split("\n")
    first = lines[0].strip()
    if len(lines) > 1 and not first.startswith(("#", "-", "*")) and first.endswith((":", ".")) and len(first) < 200 \
            and not lines[1].strip():
        lines = lines[1:]
        while lines and lines[0].strip() in ("", "---"):
            lines = lines[1:]
    return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description="Maracutaia Summarizer - Do áudio ao Mapa Mental")
    parser.add_argument("transcription", nargs="*", help="Caminho(s) para arquivos .txt (transcrições ou textos)")
    parser.add_argument("--pdf", action="append", default=[], help="Caminho para um PDF (pode repetir)")
    parser.add_argument("--model", help="Modelo do Ollama a usar (padrão: o das configurações)")
    parser.add_argument("--settings", help="Arquivo settings.json salvo pela interface")
    parser.add_argument("--lang", default="pt", help="Idioma dos resultados (pt, en, es)")
    parser.add_argument("--out-dir", default=".", help="Pasta onde os resultados serão salvos")

    args = parser.parse_args()

    if not args.transcription and not args.pdf:
        parser.error("Informe ao menos uma transcrição ou um PDF.")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    settings = Settings(args.settings, args.model)
    print(f"[*] Iniciando processamento com {settings.model}...", flush=True)
    call_llm = lambda prompt, images=None: LLMFactory.call(prompt, images=images, model=settings.model)

    # 1. Parsing
    text_aula = "\n\n".join(DocumentParser.read_transcription(t) for t in args.transcription)

    pdf_texts = []
    for pdf in args.pdf:
        pdf_texts.append(DocumentParser.parse_pdf(
            pdf,
            read_image=lambda prompt, image: call_llm(prompt, images=[image]),
            on_progress=lambda percent: report("pdf_progress", f"{percent} {pdf}"),
        ))
        report("pdf_done", pdf)
    text_pdf = "\n\n".join(pdf_texts)

    # Sem áudio/texto, o PDF vira o conteúdo principal
    if not text_aula.strip():
        text_aula, text_pdf = text_pdf, ""

    if not text_aula.strip():
        raise RuntimeError("Nenhum texto foi extraído dos arquivos.")

    # Texto completo das fontes, usado depois pela conversa (chat.py)
    with open(out_dir / "fontes.txt", "w", encoding="utf-8") as f:
        f.write(text_aula + (f"\n\nMATERIAL COMPLEMENTAR:\n{text_pdf}" if text_pdf else ""))

    # 2. Resumo
    report("stage", "resumo")
    print("[*] Gerando resumo didático...", flush=True)
    prompt_resumo = PromptBuilder.build_summary_prompt(text_aula, text_pdf, args.lang, settings.instructions("summary"))
    resumo = strip_preamble(call_llm(prompt_resumo))

    with open(out_dir / "resumo.md", "w", encoding="utf-8") as f:
        f.write(resumo)

    # 3. Mapa Mental
    # O modelo só lista os tópicos; o código DOT é montado por nós. Pedir o DOT direto ao
    # modelo gerava sintaxe inválida com frequência e o mapa não renderizava.
    report("stage", "mapa")
    print("[*] Gerando tópicos do mapa mental...", flush=True)
    prompt_mapa = PromptBuilder.build_outline_prompt(text_aula, text_pdf, args.lang, settings.instructions("mindmap"))
    topicos = call_llm(prompt_mapa)

    # Salvamos a resposta bruta do modelo por segurança
    with open(out_dir / "mapa_topicos.txt", "w", encoding="utf-8") as f:
        f.write(topicos)

    # 4. Renderizando Mapa Mental (Offline)
    print("[*] Renderizando o mapa mental via Graphviz...", flush=True)
    titulo, ramos = MindmapGenerator.parse_outline(topicos)
    rendered = False
    if ramos:
        dot = MindmapGenerator.outline_to_dot(titulo, ramos)
        with open(out_dir / "mapa.dot", "w", encoding="utf-8") as f:
            f.write(dot)
        # SVG para exibir na interface, PNG para baixar
        rendered = all(
            MindmapGenerator.render_offline(dot, output_path=str(out_dir / "mapa"), format=fmt, engine="twopi")
            for fmt in ("svg", "png")
        )
    else:
        print("[!] O modelo não devolveu tópicos no formato esperado.", flush=True)
    report("map", "ok" if rendered else "falhou")

    print(f"\n[V] Sucesso! Resultados salvos em: {out_dir}", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[!] {e}", file=sys.stderr, flush=True)
        sys.exit(1)
