import os
import asyncio
import socket
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("NVIDIA_API_KEY")
base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")

async def test_dns():
    print("Testing DNS resolution for integrate.api.nvidia.com...")
    try:
        addr = socket.gethostbyname("integrate.api.nvidia.com")
        print(f"Resolved to: {addr}")
    except Exception as e:
        print(f"DNS Resolution Failed: {e}")

async def test():
    await test_dns()
    client = AsyncOpenAI(base_url=base_url, api_key=api_key)
    print(f"Testing connection to {base_url}...")
    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model="deepseek-ai/deepseek-v3.2",
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=10
            ),
            timeout=15.0
        )
        print(f"Success! Response: {response.choices[0].message.content}")
    except asyncio.TimeoutError:
        print("Failed! Error: Request timed out after 15 seconds.")
    except Exception as e:
        print(f"Failed! Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
