import base64
import fitz
from pathlib import Path

class DocumentParser:
    # Abaixo disso consideramos que a página não tem texto digital (escaneada)
    MIN_TEXT_CHARS = 50
    # Fração mínima da página que uma imagem precisa ocupar para valer a leitura
    # (ignora logos e enfeites de slide)
    MIN_FIGURE_AREA = 0.08

    PROMPT_SCANNED = (
        "Esta é uma página de um documento. Transcreva todo o texto que aparece nela, "
        "mantendo a ordem de leitura, e descreva objetivamente figuras, gráficos, tabelas "
        "e diagramas. Responda só com o conteúdo, sem comentários."
    )
    PROMPT_FIGURES = (
        "Esta é uma página de um documento cujo texto eu já tenho. Descreva objetivamente "
        "apenas as figuras, gráficos, tabelas e diagramas da página e o que eles mostram. "
        "Se não houver nenhum, responda apenas: NENHUMA."
    )

    @staticmethod
    def read_transcription(file_path: str) -> str:
        """Lê o arquivo .txt gerado pelo Whisper (STT)."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Arquivo de transcrição não encontrado: {file_path}")
        
        # Whisper geralmente salva em UTF-8. 
        # Usamos errors='ignore' ou 'replace' por segurança extra com caracteres de áudio zicados.
        return path.read_text(encoding='utf-8', errors='replace')

    @staticmethod
    def _has_figure(page) -> bool:
        page_area = abs(page.rect)
        if not page_area:
            return False
        return any(
            abs(fitz.Rect(info["bbox"]) & page.rect) / page_area >= DocumentParser.MIN_FIGURE_AREA
            for info in page.get_image_info()
        )

    @staticmethod
    def parse_pdf(file_path: str, read_image=None, on_progress=None) -> str:
        """
        Extrai o texto do PDF. Texto digital é lido direto (rápido e exato); páginas
        escaneadas ou com figuras são enviadas como imagem para o modelo multimodal.

        read_image(prompt, imagem_base64) -> str: chamada ao modelo multimodal.
        on_progress(percent): avisado a cada página.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")

        pages = []
        with fitz.open(path) as doc:
            for i, page in enumerate(doc):
                text = page.get_text().strip()
                scanned = len(text) < DocumentParser.MIN_TEXT_CHARS

                if read_image and (scanned or DocumentParser._has_figure(page)):
                    image = base64.b64encode(page.get_pixmap(dpi=110).tobytes("png")).decode("ascii")
                    if scanned:
                        print(f"[DocumentParser] Página {i + 1}: sem texto digital, lendo como imagem...", flush=True)
                        text = read_image(DocumentParser.PROMPT_SCANNED, image).strip()
                    else:
                        print(f"[DocumentParser] Página {i + 1}: interpretando figuras...", flush=True)
                        figures = read_image(DocumentParser.PROMPT_FIGURES, image).strip()
                        if figures and "NENHUMA" not in figures.upper()[:20]:
                            text += f"\n[Figuras da página]\n{figures}"

                if text:
                    pages.append(f"--- Página {i + 1} ---\n{text}")
                if on_progress:
                    on_progress(int(100 * (i + 1) / len(doc)))

        return "\n\n".join(pages)

# --- Bloco de teste local (só roda se você executar esse arquivo diretamente) ---
if __name__ == "__main__":
    print("Testando o parser...")
    # Crie um arquivo txt fake e um pdf qualquer pra testar se quiser
    #text = DocumentParser.parse_pdf("caminho/para/arquivo.pdf")
    #print(text)
