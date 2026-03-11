import uuid
from datetime import datetime
from typing import List, Optional, Dict
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import qrcode
import io
import base64

app = FastAPI(title="NFT Ticket Blockchain API")

# Enable CORS for frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MOCK BLOCKCHAIN LEDGER (In-Memory) ---
class BlockchainState:
    def __init__(self):
        self.events = {}
        self.tickets = {}  # token_id -> ticket_data
        self.ledger = []   # Transaction history

state = BlockchainState()

# --- SCHEMAS ---
class EventCreate(BaseModel):
    name: str
    date: str
    venue: str
    capacity: int

class TicketTransfer(BaseModel):
    to_address: str

class VerifyRequest(BaseModel):
    qr_payload: str

# --- AUTH SIMULATION (RBAC) ---
# In a real app, this would verify JWT tokens or Wallet Signatures.
# Here we use a custom header 'X-Role' to simulate the user role.
def get_role(x_role: Optional[str] = Header(None)):
    if not x_role:
        return "GUEST"
    return x_role.upper()

def require_role(allowed_roles: List[str]):
    def role_checker(role: str = Depends(get_role)):
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Unauthorized access for this role")
        return role
    return role_checker

# --- ENDPOINTS ---

@app.get("/events")
def list_events():
    return list(state.events.values())

@app.post("/events", dependencies=[Depends(require_role(["ORGANIZER"]))])
def create_event(event: EventCreate):
    event_id = str(uuid.uuid4())[:8]
    event_data = {
        "id": event_id,
        **event.dict(),
        "created_at": datetime.now().isoformat()
    }
    state.events[event_id] = event_data
    return event_data

@app.post("/events/{event_id}/mint", dependencies=[Depends(require_role(["ORGANIZER"]))])
def mint_tickets(event_id: str, count: int, owner: str = "ORGANIZER_WALLET"):
    if event_id not in state.events:
        raise HTTPException(status_code=404, detail="Event not found")
    
    minted = []
    for _ in range(count):
        token_id = f"NFT-{uuid.uuid4().hex[:12].upper()}"
        ticket = {
            "token_id": token_id,
            "event_id": event_id,
            "event_name": state.events[event_id]["name"],
            "owner": owner,
            "is_used": False,
            "minted_at": datetime.now().isoformat(),
            "history": [f"Minted to {owner}"]
        }
        state.tickets[token_id] = ticket
        minted.append(ticket)
        
    return {"message": f"Successfully minted {count} tickets", "tickets": minted}

@app.get("/tickets/my", dependencies=[Depends(require_role(["HOLDER", "ORGANIZER"]))])
def get_my_tickets(address: str):
    return [t for t in state.tickets.values() if t["owner"] == address]

@app.post("/tickets/{token_id}/transfer", dependencies=[Depends(require_role(["HOLDER", "ORGANIZER"]))])
def transfer_ticket(token_id: str, req: TicketTransfer, current_user_address: str):
    if token_id not in state.tickets:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket = state.tickets[token_id]
    
    # Ownership Check
    if ticket["owner"] != current_user_address:
        raise HTTPException(status_code=403, detail="You do not own this NFT")
    
    old_owner = ticket["owner"]
    ticket["owner"] = req.to_address
    ticket["history"].append(f"Transferred from {old_owner} to {req.to_address} at {datetime.now().isoformat()}")
    
    return {"status": "success", "ticket": ticket}

@app.get("/tickets/{token_id}/qr")
def get_ticket_qr(token_id: str):
    if token_id not in state.tickets:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # The payload is the unique Token ID - the "On-Chain" reference
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(token_id)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return {"qr_code": f"data:image/png;base64,{img_str}"}

@app.post("/verify", dependencies=[Depends(require_role(["VERIFIER"]))])
def verify_ticket(req: VerifyRequest):
    token_id = req.qr_payload
    if token_id not in state.tickets:
        return {"valid": False, "reason": "Invalid Token: Not found on blockchain ledger"}
    
    ticket = state.tickets[token_id]
    
    if ticket["is_used"]:
        return {"valid": False, "reason": "Ticket already used/scanned", "ticket": ticket}
    
    # Mark as used upon successful verification (entry)
    ticket["is_used"] = True
    ticket["history"].append(f"Verified and used at gate: {datetime.now().isoformat()}")
    
    return {
        "valid": True, 
        "message": "Access Granted", 
        "ticket": ticket,
        "event": state.events.get(ticket["event_id"])
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)