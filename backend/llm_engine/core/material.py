# Material longo não cabe no contexto do modelo: o Ollama corta o começo do pedido sem
# avisar, justamente onde ficam as instruções, e o resultado sai curto ou fora do formato.
# Aqui o material é condensado em anotações por trecho antes de virar resumo, mapa etc.

# Tamanho máximo do material enviado ao modelo (o contexto de 16k tokens comporta isso
# mais as instruções e a resposta)
MAX_CHARS = 36000

# Tamanho de cada trecho anotado separadamente
CHUNK_CHARS = 24000

def read_material(job_dir) -> str:
    """Material já preparado de um job (material.txt); em jobs antigos, o começo de fontes.txt."""
    prepared = job_dir / "material.txt"
    if prepared.is_file():
        return prepared.read_text(encoding="utf-8", errors="replace")
    return (job_dir / "fontes.txt").read_text(encoding="utf-8", errors="replace")[:MAX_CHARS]

def split_chunks(text: str, size: int = CHUNK_CHARS) -> list:
    """Divide o texto em trechos de até `size` caracteres, quebrando em fim de parágrafo ou linha."""
    chunks = []
    while len(text) > size:
        cut = text.rfind("\n\n", size // 2, size)
        if cut == -1:
            cut = text.rfind("\n", size // 2, size)
        if cut == -1:
            cut = text.rfind(" ", size // 2, size)
        if cut == -1:
            cut = size
        chunks.append(text[:cut].strip())
        text = text[cut:]
    if text.strip():
        chunks.append(text.strip())
    return chunks

def fit_material(text: str, call_llm, language: str = "português do Brasil", on_progress=None) -> str:
    """
    Devolve o material em um tamanho que cabe no contexto: o próprio texto, se for curto,
    ou anotações detalhadas de cada trecho, se for longo.

    call_llm(prompt) -> str; `language` é o nome do idioma das anotações;
    on_progress(feitos, total) é avisado antes de cada trecho.
    """
    if len(text) <= MAX_CHARS:
        return text

    chunks = split_chunks(text)
    words = max(250, min(900, (MAX_CHARS // len(chunks)) // 7))
    notes = []
    for i, chunk in enumerate(chunks, 1):
        prompt = f"""Abaixo está a parte {i} de {len(chunks)} de um material de estudo. Faça anotações detalhadas dela, em tópicos, com até {words} palavras.

REGRAS:
1. Registre conceitos, definições, métodos, resultados, números e exemplos importantes.
2. Escreva as anotações em {language}, mesmo que o trecho esteja em outro idioma.
3. Ignore cabeçalhos, rodapés, numeração de página e lista de referências.
4. Comece direto pelas anotações, sem comentar a tarefa.

---
TRECHO:
{chunk}
---"""
        if on_progress:
            on_progress(i, len(chunks))
        notes.append(f"[Parte {i} de {len(chunks)}]\n{call_llm(prompt).strip()}")

    return "\n\n".join(notes)[:MAX_CHARS]
