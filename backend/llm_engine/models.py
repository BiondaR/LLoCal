# Baixa um modelo da biblioteca do Ollama (equivale a `ollama pull`), reportando o
# progresso em linhas "@@pull <percentual>" para a tela de configurações.
import argparse
import json
import sys
import requests
from core.llm_factory import LLMFactory

def pull(name: str):
    try:
        response = requests.post(f"{LLMFactory.API_URL}/pull", json={"model": name, "stream": True}, stream=True, timeout=60)
        response.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Erro na conexão com Ollama: {e}") from e

    # O modelo vem em várias camadas; o percentual é sobre o total das já anunciadas
    layers = {}
    last = -1
    for line in response.iter_lines():
        if not line:
            continue
        event = json.loads(line)
        if event.get("error"):
            raise RuntimeError(" ".join(event["error"].split()))
        if event.get("digest") and event.get("total"):
            layers[event["digest"]] = (event.get("completed", 0), event["total"])
            percent = int(100 * sum(done for done, _ in layers.values()) / sum(total for _, total in layers.values()))
            if percent != last:
                last = percent
                print(f"@@pull {percent}", flush=True)

    print(f"[V] Modelo {name} instalado.", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gerencia os modelos do Ollama")
    parser.add_argument("action", choices=["pull"])
    parser.add_argument("name", help="Nome do modelo na biblioteca do Ollama (ex.: gemma3:12b)")
    args = parser.parse_args()

    try:
        pull(args.name)
    except Exception as e:
        print(f"[!] {e}", file=sys.stderr, flush=True)
        sys.exit(1)
