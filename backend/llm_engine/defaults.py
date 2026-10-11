# Imprime em JSON os valores padrão (modelo e prompts) para a tela de configurações.
import json
from core.settings import Settings

if __name__ == "__main__":
    print(json.dumps(Settings.defaults(), ensure_ascii=False))
