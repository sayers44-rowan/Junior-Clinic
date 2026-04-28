
import requests
import json

BASE_URL = "http://localhost:8000"

def test_player_endpoints():
    username = "TimmyExplorer"
    
    # 1. Create/Save Player
    print(f"Testing POST /player for {username}...")
    resp = requests.post(f"{BASE_URL}/player", params={
        "username": username,
        "current_stage": "LOBBY",
        "outfit_color": "Blue",
        "player_data": json.dumps({"inventory": ["map", "torch"]})
    })
    print(f"Status: {resp.status_code}, Response: {resp.json()}")

    # 2. Get Player
    print(f"\nTesting GET /player/{username}...")
    resp = requests.get(f"{BASE_URL}/player/{username}")
    print(f"Status: {resp.status_code}, Response: {resp.json()}")

    # 3. Update Player State
    print(f"\nTesting PATCH /player/{username}/state...")
    resp = requests.patch(f"{BASE_URL}/player/{username}/state", params={
        "current_stage": "EXTERIOR"
    })
    print(f"Status: {resp.status_code}, Response: {resp.json()}")

    # 4. Test Chat with Context
    print(f"\nTesting POST /chat with context...")
    # First create a conversation
    conv = requests.post(f"{BASE_URL}/conversations", params={"title": "Test Context Chat"}).json()
    conv_id = conv["id"]
    
    resp = requests.post(f"{BASE_URL}/chat/{conv_id}", params={
        "prompt": "Who am I and where am I?",
        "username": username
    }, stream=True)
    
    print("AI Response: ", end="", flush=True)
    for chunk in resp.iter_content(chunk_size=None):
        if chunk:
            print(chunk.decode(), end="", flush=True)
    print("\n")

if __name__ == "__main__":
    try:
        test_player_endpoints()
    except Exception as e:
        print(f"Error: {e}. Is the backend running?")
