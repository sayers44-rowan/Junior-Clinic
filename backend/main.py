from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from .database import get_db, init_db, Conversation, Message, Player, engine
from .llm_client import llm_client

app = FastAPI(title="AI Chatbot API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/models")
def list_models():
    return llm_client.get_available_models()

@app.get("/conversations")
def get_conversations(db: Session = Depends(get_db)):
    return db.query(Conversation).order_by(Conversation.created_at.desc()).all()

@app.get("/conversations/{conversation_id}/messages")
def get_messages(conversation_id: int, db: Session = Depends(get_db)):
    return db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()

@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Delete all messages first
    db.query(Message).filter(Message.conversation_id == conversation_id).delete()
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}

@app.post("/conversations")
def create_conversation(title: str = "New Chat", db: Session = Depends(get_db)):
    new_conv = Conversation(title=title)
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return new_conv

# Player Endpoints
@app.post("/player")
def save_player(username: str, current_stage: str = "LOBBY", outfit_color: str = "default", player_data: str = "{}", db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.username == username).first()
    if player:
        player.current_stage = current_stage
        player.outfit_color = outfit_color
        player.player_data = player_data
    else:
        player = Player(username=username, current_stage=current_stage, outfit_color=outfit_color, player_data=player_data)
        db.add(player)
    db.commit()
    db.refresh(player)
    return player

@app.get("/player/{username}")
def get_player(username: str, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.username == username).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player

@app.patch("/player/{username}/state")
def update_player_state(username: str, current_stage: Optional[str] = None, outfit_color: Optional[str] = None, player_data: Optional[str] = None, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.username == username).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if current_stage: player.current_stage = current_stage
    if outfit_color: player.outfit_color = outfit_color
    if player_data: player.player_data = player_data
    
    db.commit()
    db.refresh(player)
    return player

@app.post("/chat/{conversation_id}")
async def chat(
    conversation_id: int, 
    prompt: str, 
    model: str = "deepseek-ai/deepseek-v3.2",
    username: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # 1. Fetch conversation
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 2. Save user message
    user_msg = Message(conversation_id=conversation_id, role="user", content=prompt)
    db.add(user_msg)
    db.commit()

    # 3. Fetch full history and add a system instruction
    history = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()
    messages = [{"role": "system", "content": "You are a helpful, premium AI assistant. Always respond in English unless specifically asked otherwise."}]
    messages.extend([{"role": m.role, "content": m.content} for m in history])

    # 4. Fetch player context if username provided
    player_context = None
    if username:
        player = db.query(Player).filter(Player.username == username).first()
        if player:
            player_context = {
                "username": player.username,
                "current_stage": player.current_stage,
                "outfit_color": player.outfit_color
            }

    # 5. Stream response
    async def event_generator():
        full_response = ""
        for chunk in llm_client.stream_completion(model, messages, player_context=player_context):
            full_response += chunk
            yield chunk
        
        # 6. After streaming finishes, save assistant message
        # We need a new session or use the existing one carefully
        # Note: In a real async environment, you'd use an async DB driver
        with Session(engine) as session:
            assistant_msg = Message(conversation_id=conversation_id, role="assistant", content=full_response)
            session.add(assistant_msg)
            session.commit()

    return StreamingResponse(event_generator(), media_type="text/plain")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
