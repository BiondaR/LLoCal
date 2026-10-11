class PromptBuilder:

    # Idiomas em que os resultados podem ser gerados (código -> nome usado nos prompts)
    LANGUAGES = {
        "pt": "português do Brasil",
        "en": "inglês",
        "es": "espanhol",
        "fr": "francês",
        "de": "alemão",
        "it": "italiano",
    }

    # Instruções padrão de cada artefato. É a parte que o usuário pode editar nas
    # configurações; o material, o formato da resposta e o idioma são acrescentados pelo código.
    DEFAULT_INSTRUCTIONS = {
        "summary": """Você é um monitor acadêmico especialista no assunto do material abaixo.
Sua tarefa é criar um resumo didático baseado na transcrição de uma aula e nos materiais complementares fornecidos.

DIRETRIZES:
1. O resumo deve ter aproximadamente 500 palavras.
2. Use linguagem técnica precisa, mas explique os conceitos complexos que aparecerem.
3. Faça correlação entre o que o professor falou e o que está nos slides.
4. Use formatação Markdown (negrito, listas e blocos de código se necessário).
5. Use apenas o que está no material; não invente conteúdo que não aparece nele.
6. Comece direto pelo resumo, sem frases de introdução nem comentários sobre a tarefa.""",

        "mindmap": """Com base no conteúdo abaixo, liste os conceitos principais para um mapa mental.

REGRAS:
1. De 3 a 6 tópicos principais, cada um com 2 a 4 subtópicos.
2. Cada item deve ter no máximo 4 palavras.""",

        "flashcards": """Crie de 10 a 15 flashcards para um estudante revisar o material abaixo.

REGRAS:
1. Frente: uma pergunta curta ou um termo. Verso: a resposta em 1 a 3 frases.
2. Cubra os conceitos mais importantes, sem repetir.
3. Use apenas o que está no material.""",

        "quiz": """Crie um teste com 8 questões de múltipla escolha sobre o material abaixo.

REGRAS:
1. As alternativas erradas devem ser plausíveis. Não use "todas as anteriores" nem "nenhuma das anteriores".
2. Inclua uma explicação de 1 ou 2 frases sobre por que a alternativa correta está certa.
3. Use apenas o que está no material.""",

        "audio": """Escreva o roteiro de um audioresumo do material abaixo, com cerca de 350 palavras, para ser lido em voz alta por um único narrador.

REGRAS:
1. Texto corrido, em tom de conversa, como alguém explicando a matéria a um colega.
2. Sem títulos, listas, markdown, emojis ou indicações de cena. Só o que o narrador fala.
3. Escreva números e siglas do jeito que se fala.
4. Use apenas o que está no material.
5. Comece direto pela primeira frase da narração: sem título, sem rótulo como "Roteiro:" e sem comentar a tarefa.""",
    }

    @staticmethod
    def language_code(lang: str) -> str:
        """Normaliza 'pt-br', 'en-us', 'es-es'... para 'pt', 'en', 'es'."""
        code = (lang or "pt").lower()[:2]
        return code if code in PromptBuilder.LANGUAGES else "pt"

    @staticmethod
    def language_rule(lang: str) -> str:
        """Instrução de idioma que vai no fim dos prompts."""
        name = PromptBuilder.LANGUAGES[PromptBuilder.language_code(lang)]
        return f"IDIOMA: escreva toda a resposta em {name}, traduzindo o conteúdo se ele estiver em outro idioma."

    @staticmethod
    def _instructions(kind: str, custom: str = None) -> str:
        return (custom or "").strip() or PromptBuilder.DEFAULT_INSTRUCTIONS[kind]

    @staticmethod
    def _lesson_block(transcription: str, extra_material: str) -> str:
        material_context = f"\nMATERIAL COMPLEMENTAR (SLIDES/NOTAS):\n{extra_material}" if extra_material else ""
        return f"---\nTRANSCRIÇÃO DA AULA:\n{transcription}\n{material_context}\n---"

    @staticmethod
    def build_summary_prompt(transcription: str, extra_material: str, lang: str = "pt", instructions: str = None) -> str:
        """Monta o prompt para o resumo didático."""
        return f"""{PromptBuilder._instructions("summary", instructions)}

{PromptBuilder._lesson_block(transcription, extra_material)}

{PromptBuilder.language_rule(lang)}

Gere o resumo abaixo:"""

    @staticmethod
    def build_outline_prompt(transcription: str, extra_material: str, lang: str = "pt", instructions: str = None) -> str:
        """Monta o prompt que pede só os tópicos do mapa mental; o desenho é montado pelo MindmapGenerator."""
        return f"""{PromptBuilder._instructions("mindmap", instructions)}

FORMATO DA RESPOSTA (siga exatamente, sem explicações antes ou depois, e sem escrever código):
TÍTULO: <tema central em até 5 palavras>
- <tópico principal>
  - <subtópico>
  - <subtópico>
- <tópico principal>
  - <subtópico>

{PromptBuilder._lesson_block(transcription, extra_material)}

{PromptBuilder.language_rule(lang)} Mantenha o marcador "TÍTULO:" exatamente assim."""

    @staticmethod
    def build_flashcards_prompt(material: str, lang: str = "pt", instructions: str = None) -> str:
        """Monta o prompt dos flashcards (a resposta vem em JSON, ver study.py)."""
        return f"""{PromptBuilder._instructions("flashcards", instructions)}

FORMATO: "front" é a frente do cartão e "back" é o verso.

---
MATERIAL:
{material}
---

{PromptBuilder.language_rule(lang)}"""

    @staticmethod
    def build_quiz_prompt(material: str, lang: str = "pt", instructions: str = None) -> str:
        """Monta o prompt do teste de múltipla escolha (a resposta vem em JSON, ver study.py)."""
        return f"""{PromptBuilder._instructions("quiz", instructions)}

FORMATO: cada questão tem exatamente 4 alternativas ("options"), só uma correta; "answer" é o índice (0 a 3) da alternativa correta; "explanation" é a explicação.

---
MATERIAL:
{material}
---

{PromptBuilder.language_rule(lang)}"""

    @staticmethod
    def build_audio_script_prompt(material: str, lang: str = "pt", instructions: str = None) -> str:
        """Monta o prompt do roteiro do audioresumo, que depois é lido por um TTS."""
        return f"""{PromptBuilder._instructions("audio", instructions)}

---
MATERIAL:
{material}
---

{PromptBuilder.language_rule(lang)}"""

    # --- Versões antigas do mapa mental (o modelo escrevia o código do diagrama) ---

    @staticmethod
    def build_mindmap_prompt(transcription: str,  extra_material: str) -> str:
        """Monta o prompt para gerar o código do mapa mental (Mermaid)."""
        material_context = f"\nMATERIAL COMPLEMENTAR (SLIDES/NOTAS):\n{extra_material}" if extra_material else ""

        prompt = f"""
Com base na transcrição da aula abaixo, crie um mapa mental hierárquico dos conceitos principais.
Retorne APENAS o código em formato Mermaid.js (graph TD).

REGRAS:
1. Use 'graph TD'.
2. Foque na hierarquia dos conceitos de computação.
3. Não inclua explicações, apenas o bloco de código Mermaid.

---
TRANSCRIÇÃO:
{transcription}
{material_context}
---
        """
        return prompt.strip()

    @staticmethod
    def build_graphviz_prompt(transcription: str,  extra_material: str) -> str:
        """Monta o prompt para gerar o código do mapa mental (Graphviz)."""
        material_context = f"\nMATERIAL COMPLEMENTAR (SLIDES/NOTAS):\n{extra_material}" if extra_material else ""

        '''return f"""
Crie um mapa mental hierárquico usando a sintaxe DOT do Graphviz.
REGRAS:
1. Retorne APENAS o código dentro do bloco 'digraph G {{ ... }}'.
2. Use 'rankdir=LR' para o mapa crescer da esquerda para a direita.
3. Use nós com formas arredondadas (node [style=rounded, shape=box]).
4. Foque nos conceitos principais da aula abaixo:

---
TRANSCRIÇÃO:
{transcription}
{material_context}
"""'''
        prompt = f"""
Gere um código DOT (Graphviz) para um MAPA MENTAL RADIAL.

REGRAS DE LAYOUT (CRÍTICO):
1. Use 'graph [overlap=false, splines=true, bgcolor="#FAFAFA"];'
2. Use 'node [fontname="Handlee", style="filled", shape=capsule, penwidth=0, margin=0.2];'
3. O nó CENTRAL deve ter 'fontsize=24, fillcolor="#E04C4C", fontcolor=white'.
4. Use 'ranksep=1.2; nodesep=0.6;' para dar respiro entre os tópicos.

REGRAS DE CONTEÚDO:
1. Nó Central: O título da aula.
2. Níveis 1 e 2: Use apenas 1 ou 2 palavras por nó (curtíssimo!).
3. Cores: Cada braço principal do mapa deve ter uma cor consistente (ex: braço 1 é todo azul, braço 2 todo verde).

"PROIBIDO: Não use estruturas de controle como 'foreach', 'if' ou variáveis. Escreva cada conexão manualmente no formato: 'A' -> 'B';"

TRANSCRICAO:
{transcription}
{material_context}
"""
        return prompt.strip()
