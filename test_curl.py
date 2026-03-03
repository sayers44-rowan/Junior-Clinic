import os
import subprocess
import json
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("NVIDIA_API_KEY")
base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")

def test_curl_subprocess():
    url = f"{base_url}/chat/completions"
    headers = [
        "-H", f"Authorization: Bearer {api_key}",
        "-H", "Content-Type: application/json"
    ]
    payload = {
        "model": "deepseek-ai/deepseek-v3.2",
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 10
    }
    
    cmd = [
        "curl.exe", "-X", "POST", url,
        *headers,
        "-d", json.dumps(payload),
        "--silent"
    ]
    
    print(f"Testing connectivity via subprocess curl to {url}...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            print("Success!")
            print(f"Response: {result.stdout}")
        else:
            print(f"Failed with return code {result.returncode}")
            print(f"Error: {result.stderr}")
    except Exception as e:
        print(f"Failed! Error: {e}")

if __name__ == "__main__":
    test_curl_subprocess()
