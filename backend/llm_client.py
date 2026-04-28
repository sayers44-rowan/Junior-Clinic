import os
import subprocess
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
if not os.getenv("NVIDIA_API_KEY"):
    load_dotenv("backend/.env")

class LLMClient:
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY")
        self.base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
        self.client = OpenAI(
            base_url=self.base_url,
            api_key=self.api_key
        )

    def _stream_via_curl(self, model: str, messages: list, temperature: float, top_p: float, max_tokens: int):
        print(f"DEBUG: Engaging Resilience Bridge (curl) for model {model}")
        url = f"{self.base_url}/chat/completions"
        headers = [
            "-H", f"Authorization: Bearer {self.api_key}",
            "-H", "Content-Type: application/json"
        ]
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "stream": True
        }
        
        cmd = [
            "curl.exe", "-X", "POST", url,
            *headers,
            "-d", json.dumps(payload),
            "--silent", "--no-buffer"
        ]
        
        try:
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
            for line in process.stdout:
                if line.startswith("data: "):
                    content = line[6:].strip()
                    if content == "[DONE]":
                        break
                    try:
                        data = json.loads(content)
                        if data.get("choices") and data["choices"][0].get("delta", {}).get("content"):
                            yield data["choices"][0]["delta"]["content"]
                    except json.JSONDecodeError:
                        continue
            process.terminate()
        except Exception as e:
            print(f"DEBUG: Resilience Bridge Error: {str(e)}")
            yield f"CRITICAL_ERROR: {str(e)}"

    def stream_completion(self, model: str, messages: list, temperature: float = 1.0, top_p: float = 0.95, max_tokens: int = 8192, player_context: dict = None):
        print(f"DEBUG: Starting stream for model {model}")
        
        # Inject player context into system prompt if provided
        if player_context and messages and messages[0]["role"] == "system":
            ctx_str = f"\n\nPLAYER CONTEXT:\n- Username: {player_context.get('username')}\n- Current Stage: {player_context.get('current_stage')}\n- Outfit: {player_context.get('outfit_color')}"
            messages[0]["content"] += ctx_str

        # Try primary OpenAI client first
        try:
            # We use a short timeout for the initial connection to detect hangs
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                top_p=top_p,
                max_tokens=max_tokens,
                stream=True,
                timeout=5.0 # 5 second timeout for the initial request
            )
            print("DEBUG: Primary stream established")
            for chunk in response:
                if not getattr(chunk, "choices", None):
                    continue
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
            return
        except Exception as e:
            print(f"DEBUG: Primary Engine Failed ({type(e).__name__}). Switching to Resilience Bridge...")
            
        # Fallback to curl-based bridge
        yield from self._stream_via_curl(model, messages, temperature, top_p, max_tokens)

    def get_available_models(self):
        # Hardcoding based on user's request, but could be dynamic
        return [
            {"id": "deepseek-ai/deepseek-v3.2", "name": "DeepSeek v3.2"},
            {"id": "minimaxai/minimax-m2", "name": "Minimax-m2"}
        ]

llm_client = LLMClient()
