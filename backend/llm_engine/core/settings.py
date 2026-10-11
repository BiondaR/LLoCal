import json
from pathlib import Path
from core.llm_factory import LLMFactory
from core.prompt_builder import PromptBuilder

class Settings:
    """
    Configurações salvas pela interface (settings.json): modelo e prompts editados.
    Sem arquivo, vale tudo no padrão.
    """

    def __init__(self, path: str = None, model: str = None):
        data = {}
        if path and Path(path).is_file():
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        # --model na linha de comando vence o que está salvo
        self.model = model or data.get("model") or LLMFactory.DEFAULT_MODEL
        self.prompts = data.get("prompts") or {}

    def instructions(self, kind: str):
        """Instruções editadas pelo usuário para o artefato, ou None para usar o padrão."""
        return (self.prompts.get(kind) or "").strip() or None

    @staticmethod
    def defaults() -> dict:
        return {"model": LLMFactory.DEFAULT_MODEL, "prompts": PromptBuilder.DEFAULT_INSTRUCTIONS}
