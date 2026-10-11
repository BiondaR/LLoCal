import json
import os
import requests

class LLMFactory:
    """
    Motor de chamadas para LLMs locais via Ollama.
    Garante que nenhum dado saia da sua RTX 5080.
    """

    # API nativa do Ollama: ao contrário da /v1 (compatível com OpenAI), aceita imagens
    # e deixa configurar o tamanho do contexto
    API_URL = "http://localhost:11434/api"
    BASE_URL = f"{API_URL}/chat"

    # Modelo multimodal usado para tudo (resumo, mapa, leitura de páginas e conversa)
    DEFAULT_MODEL = os.environ.get("LLOCAL_LLM_MODEL", "gemma3:12b")

    # O padrão do Ollama é pequeno e corta aulas longas sem avisar
    NUM_CTX = 16384

    SYSTEM_PROMPT = "Você é um assistente acadêmico de alto desempenho. Seja preciso e técnico."

    @staticmethod
    def _request(messages: list, model: str = None, stream: bool = False, format: dict = None):
        """Função interna para realizar a requisição HTTP ao Ollama."""
        model_name = model or LLMFactory.DEFAULT_MODEL
        payload = {
            "model": model_name,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": 0.3, # Mantém a precisão para resumos técnicos
                "num_ctx": LLMFactory.NUM_CTX,
            },
        }
        if format:
            payload["format"] = format

        try:
            response = requests.post(
                LLMFactory.BASE_URL,
                json=payload,
                stream=stream,
                timeout=600 # Modelos maiores podem demorar um pouco para 'acordar'
            )
            response.raise_for_status()
            return response
        except Exception as e:
            # Propaga o erro: devolver a mensagem como texto fazia ela virar o "resumo"
            raise RuntimeError(f"Erro na conexão com Ollama ({model_name}): {str(e)}") from e

    @staticmethod
    def call(prompt: str, images: list = None, model: str = None, format: dict = None) -> str:
        """
        Pergunta única. `images` é uma lista de imagens em base64 (modelos multimodais);
        `format` é um JSON Schema que obriga a resposta a ser um JSON nesse formato.
        """
        user_message = {"role": "user", "content": prompt}
        if images:
            user_message["images"] = images
        messages = [{"role": "system", "content": LLMFactory.SYSTEM_PROMPT}, user_message]
        return LLMFactory._request(messages, model, format=format).json()["message"]["content"]

    @staticmethod
    def chat_stream(messages: list, model: str = None):
        """Conversa com histórico; devolve a resposta em pedaços conforme o modelo gera."""
        response = LLMFactory._request(messages, model, stream=True)
        for line in response.iter_lines():
            if not line:
                continue
            chunk = json.loads(line)
            if chunk.get("error"):
                raise RuntimeError(chunk["error"])
            yield chunk.get("message", {}).get("content", "")

    @staticmethod
    def call_deepseek(prompt: str):
        """Chamada para o DeepSeek (Recomendado: deepseek-v2:16b ou coder-v2)."""
        return LLMFactory.call(prompt, model="deepseek-v2:16b")

    @staticmethod
    def call_llama(prompt: str):
        """Chamada para o Llama 3.1 (Recomendado: llama3.1:8b)."""
        return LLMFactory.call(prompt, model="llama3.1:8b")

# --- Teste Rápido ---
if __name__ == "__main__":
    test_prompt = "Olá! Você está rodando na minha RTX 5080?"
    print(f"Testando {LLMFactory.DEFAULT_MODEL}...")
    print(LLMFactory.call(test_prompt))
