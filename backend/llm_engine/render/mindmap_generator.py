import requests
import base64
import re
from pathlib import Path
from graphviz import Source

class MindmapGenerator:
    @staticmethod
    def render_mermaid(mermaid_code: str, output_path: str = "mapa_mental.png"):
        """Converte código Mermaid em uma imagem PNG usando a API do mermaid.ink"""
        # Limpa o código de possíveis marcações de markdown (```mermaid)
        clean_code = mermaid_code.replace("```mermaid", "").replace("```", "").strip()
        
        # O Mermaid.ink aceita o código base64 na URL
        graphbytes = clean_code.encode("utf8")
        base64_bytes = base64.b64encode(graphbytes)
        base64_string = base64_bytes.decode("ascii")
        
        url = f"[https://mermaid.ink/img/](https://mermaid.ink/img/){base64_string}"
        
        try:
            response = requests.get(url)
            if response.status_code == 200:
                with open(output_path, "wb") as f:
                    f.write(response.content)
                print(f"[V] Mapa mental renderizado em: {output_path}")
            else:
                print(f"[!] Erro ao renderizar mapa: Status {response.status_code}")
        except Exception as e:
            print(f"[!] Erro de conexão ao renderizar: {e}")

    @staticmethod
    def render_offline(dot_code: str, output_path: str = "mapa_mental", format: str = "png", engine: str = "fdp"):
        """
        Gera o mapa mental usando o motor local do Graphviz.
        Não precisa de internet.
        """
        try:
            clean_code = MindmapGenerator.extract_dot(dot_code)
            src = Source(clean_code, engine=engine)
            src.render(output_path, format=format, cleanup=True)
            return True
        except Exception as e:
            print(f"[!] Erro no Graphviz: {e}")
            return False

    @staticmethod
    def extract_dot(text: str) -> str:
        """Isola o código DOT da resposta, descartando o texto que o modelo escreve em volta."""
        fenced = re.search(r"```\w*\s*\n(.*?)```", text, re.S)
        body = fenced.group(1) if fenced else text

        match = re.search(r"(?:strict\s+)?(?:di)?graph\s*[\w\"]*\s*\{", body)
        end = body.rfind("}")
        if match and end > match.start():
            return body[match.start():end + 1]
        if fenced:
            # Às vezes o modelo devolve só as instruções, sem o 'digraph G { }' em volta
            return "digraph G {\n" + body + "\n}"
        return text.strip()

    # Uma cor por braço do mapa: (tópico principal, subtópicos)
    BRANCH_COLORS = [
        ("#4C8BE0", "#DCE8FA"),
        ("#3FA66B", "#DAF0E3"),
        ("#E08A2C", "#FBE8D2"),
        ("#8E5CD0", "#E9DEF7"),
        ("#2CA6A4", "#D5F0EF"),
        ("#D0508C", "#F8DCE9"),
    ]

    @staticmethod
    def parse_outline(text: str):
        """
        Lê a lista de tópicos devolvida pelo modelo e devolve (título, ramos), onde cada ramo é
        (rótulo, [filhos]) recursivamente, seguindo a indentação.
        Tolerante a marcadores diferentes (-, *, •, 1.) e a negrito/cabeçalhos de markdown.
        """
        title = ""
        branches = []
        stack = []  # [(indentação, lista de filhos do item)] do nível mais raso ao mais fundo
        for raw in text.replace("\t", "    ").splitlines():
            line = raw.strip().replace("**", "").replace("`", "")
            if not line:
                continue

            item = re.match(r"^(?:[-*•+]|\d+[.)])\s+(.*)$", line)
            if not item:
                header = re.match(r"^(?:#+\s*)?(?:t[íi]tulo\s*:|title\s*:)?\s*(.+)$", line, re.I)
                if not title and not branches and header and not line.endswith(":"):
                    title = header.group(1).strip()
                continue

            label = item.group(1).strip().rstrip(":")
            if not label:
                continue
            indent = len(raw) - len(raw.lstrip())
            while stack and stack[-1][0] >= indent:
                stack.pop()
            node = (label, [])
            (stack[-1][1] if stack else branches).append(node)
            stack.append((indent, node[1]))

        return title or "Mapa mental", branches

    @staticmethod
    def outline_to_dot(title: str, branches) -> str:
        """Monta o código DOT de um mapa mental radial a partir dos tópicos."""
        def quote(label: str) -> str:
            return '"' + label.replace("\\", "\\\\").replace('"', '\\"') + '"'

        lines = [
            "digraph G {",
            '    graph [overlap=false, splines=true, bgcolor="#FAFAFA", root=central, ranksep=1.6];',
            '    node [fontname="Handlee", style="filled,rounded", shape=box, penwidth=0, margin=0.2];',
            "    edge [arrowhead=none, penwidth=2];",
            f'    central [label={quote(title)}, fontsize=24, fillcolor="#E04C4C", fontcolor=white];',
        ]

        def add_children(parent_id: str, children, strong: str, light: str):
            for j, (label, grandchildren) in enumerate(children):
                node_id = f"{parent_id}_{j}"
                lines.append(f'    {node_id} [label={quote(label)}, fillcolor="{light}"];')
                lines.append(f'    {parent_id} -> {node_id} [color="{strong}"];')
                add_children(node_id, grandchildren, strong, light)

        # Cada braço principal mantém uma cor do centro até as pontas
        for i, (branch, children) in enumerate(branches):
            strong, light = MindmapGenerator.BRANCH_COLORS[i % len(MindmapGenerator.BRANCH_COLORS)]
            lines.append(f'    b{i} [label={quote(branch)}, fontsize=16, fillcolor="{strong}", fontcolor=white];')
            lines.append(f'    central -> b{i} [color="{strong}"];')
            add_children(f"b{i}", children, strong, light)

        lines.append("}")
        return "\n".join(lines)
