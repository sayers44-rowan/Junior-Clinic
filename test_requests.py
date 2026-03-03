import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("NVIDIA_API_KEY")
base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")

def test_requests():
    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-ai/deepseek-v3.2",
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 10
    }
    print(f"Testing POST to {url} with requests...")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Failed! Error: {e}")

if __name__ == "__main__":
    test_requests()
