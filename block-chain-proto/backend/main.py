from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import base64
import qrcode
from io import BytesIO
from web3 import Web3

app = FastAPI(title="NFT Ticket API")

# Enable CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Web3 Setup ---
# Connect to local Hardhat node
w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))

# Load deployment info
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEPLOYMENT_FILE = os.path.join(BASE_DIR, "deployment.json")
ABI_FILE = os.path.join(BASE_DIR, "TicketNFT_abi.json")

# Note: In a real app, these files would exist before startup or be loaded dynamically.
# For this demo, we'll try to load them, but allow graceful failure if they don't exist yet,
# since the backend might be started before the contract is deployed.
contract = None
organizer_address = None

def get_contract():
    global contract, organizer_address
    if contract is not None:
        return contract

    if not os.path.exists(DEPLOYMENT_FILE) or not os.path.exists(ABI_FILE):
        return None

    with open(DEPLOYMENT_FILE, "r") as f:
        deployment = json.load(f)
        contract_address = deployment["contractAddress"]
        organizer_address = deployment["organizerAddress"].lower()

    with open(ABI_FILE, "r") as f:
        abi = json.load(f)

    contract = w3.eth.contract(address=contract_address, abi=abi)
    return contract

# --- In-memory DB for off-chain metadata ---
class Event(BaseModel):
    id: str
    name: str
    date: str
    venue: str
    total_capacity: int

# In-memory store
events_db: dict[str, Event] = {}
event_counter = 1

# --- RBAC Helper ---
def get_current_wallet(x_wallet_address: Optional[str] = Header(None)):
    if not x_wallet_address:
        raise HTTPException(status_code=401, detail="X-Wallet-Address header is required")
    return x_wallet_address.lower()

# --- Endpoints ---

@app.get("/me/role")
def get_role(wallet: str = Depends(get_current_wallet)):
    """Detect caller's role from wallet address"""
    c = get_contract()
    if not c:
        return {"role": "UNKNOWN", "message": "Contract not deployed yet"}
    
    global organizer_address
    roles = []
    if wallet == organizer_address:
        roles.append("ORGANIZER")
    
    # Check if verifier
    try:
        is_verifier = c.functions.isVerifier(Web3.to_checksum_address(wallet)).call()
        if is_verifier:
            roles.append("VERIFIER")
    except Exception:
        pass

    # Check if holder
    try:
        total_minted = c.functions.totalMinted().call()
        is_holder = False
        for i in range(total_minted):
            if c.functions.ownerOf(i).call().lower() == wallet:
                is_holder = True
                break
        if is_holder:
            roles.append("HOLDER")
    except Exception:
        pass

    return {"roles": roles if roles else ["NONE"]}

# 1. Organizer Methods

class CreateEventReq(BaseModel):
    name: str
    date: str
    venue: str
    capacity: int

@app.post("/events", status_code=201)
def create_event(req: CreateEventReq, wallet: str = Depends(get_current_wallet)):
    global organizer_address
    get_contract() # Load contract info
    
    if organizer_address and wallet != organizer_address:
         raise HTTPException(status_code=403, detail="Only organizer can create events")

    global event_counter
    event_id = f"EVT-{event_counter:03d}"
    event_counter += 1
    
    new_event = Event(
        id=event_id,
        name=req.name,
        date=req.date,
        venue=req.venue,
        total_capacity=req.capacity
    )
    events_db[event_id] = new_event
    return new_event

@app.get("/events")
def list_events():
    return list(events_db.values())

class GenerateReq(BaseModel):
    count: int

@app.post("/events/{event_id}/tickets/generate")
def generate_tickets(event_id: str, req: GenerateReq, wallet: str = Depends(get_current_wallet)):
    """Note: In a true dApp, minting happens via MetaMask. 
    This endpoint exists to relay off-chain event data if needed, but since we use 
    MetaMask to mint, the frontend will call the contract directly. 
    This endpoint can be used if the backend acts as a relayer (not our architecture).
    We will just return a message instructing the frontend to call the contract."""
    return {"message": "Minting should be done directly via smart contract using ethers.js"}

@app.get("/events/{event_id}/tickets")
def list_event_tickets(event_id: str, wallet: str = Depends(get_current_wallet)):
    """List all tickets for an event. Organizer only for full list."""
    get_contract()
    if organizer_address and wallet != organizer_address:
         raise HTTPException(status_code=403, detail="Only organizer can view all event tickets")
    
    c = get_contract()
    if not c:
        return []

    total_minted = c.functions.totalMinted().call()
    tickets = []
    for i in range(total_minted):
        try:
            token_event = c.functions.tokenEvent(i).call()
            if token_event == event_id:
                owner = c.functions.ownerOf(i).call().lower()
                is_used = c.functions.tokenUsed(i).call()
                tickets.append({
                    "token_id": i,
                    "event_id": token_event,
                    "owner": owner,
                    "is_used": is_used
                })
        except Exception as e:
            print(f"Error reading token {i}: {e}")
            continue
            
    return tickets

class RegisterVerifierReq(BaseModel):
    verifier_address: str

@app.post("/verifiers")
def register_verifier(req: RegisterVerifierReq, wallet: str = Depends(get_current_wallet)):
    return {"message": "Registering verifiers should be done directly via smart contract using ethers.js"}

# 2. Ticket Holder Methods

@app.get("/tickets")
def list_my_tickets(owner: str, wallet: str = Depends(get_current_wallet)):
    if wallet != owner.lower():
        raise HTTPException(status_code=403, detail="Can only view own tickets")
        
    c = get_contract()
    if not c:
        return []

    total_minted = c.functions.totalMinted().call()
    tickets = []
    for i in range(total_minted):
         try:
             token_owner = c.functions.ownerOf(i).call().lower()
             if token_owner == wallet:
                 token_event = c.functions.tokenEvent(i).call()
                 is_used = c.functions.tokenUsed(i).call()
                 
                 event_name = events_db[token_event].name if token_event in events_db else "Unknown Event"
                 
                 tickets.append({
                     "token_id": i,
                     "event_id": token_event,
                     "event_name": event_name,
                     "owner": token_owner,
                     "is_used": is_used
                 })
         except Exception:
             continue
    return tickets

@app.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int, wallet: str = Depends(get_current_wallet)):
    c = get_contract()
    if not c:
        raise HTTPException(status_code=500, detail="Contract not configured")
        
    try:
        owner = c.functions.ownerOf(ticket_id).call().lower()
        if wallet != owner and wallet != organizer_address:
             raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
             
        event_id = c.functions.tokenEvent(ticket_id).call()
        is_used = c.functions.tokenUsed(ticket_id).call()
        return {
            "token_id": ticket_id,
            "event_id": event_id,
            "owner": owner,
            "is_used": is_used
        }
    except Exception as e:
         raise HTTPException(status_code=404, detail="Ticket not found")

@app.get("/tickets/{ticket_id}/qr")
def get_ticket_qr(ticket_id: int, wallet: str = Depends(get_current_wallet)):
    ticket = get_ticket(ticket_id, wallet)
    
    payload = json.dumps({
        "token_id": ticket["token_id"],
        "event_id": ticket["event_id"]
    })
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return {"qr_base64": f"data:image/png;base64,{img_str}"}

@app.post("/tickets/{ticket_id}/transfer")
def transfer_ticket(ticket_id: int, wallet: str = Depends(get_current_wallet)):
    return {"message": "Transfer should be done directly via smart contract using ethers.js"}

# 3. Verifier Methods

class VerifyReq(BaseModel):
    token_id: int
    verifier_address: str

@app.post("/verify")
def verify_ticket(req: VerifyReq, wallet: str = Depends(get_current_wallet)):
    if wallet != req.verifier_address.lower():
         raise HTTPException(status_code=401, detail="Wallet mismatch")
         
    c = get_contract()
    if not c:
        raise HTTPException(status_code=500, detail="Contract not configured")

    # 1. Check if caller is a registered verifier
    try:
        is_verifier = c.functions.isVerifier(Web3.to_checksum_address(wallet)).call()
        if not is_verifier:
             raise HTTPException(status_code=403, detail="Caller is not a registered verifier")
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

    # 2. Check ticket
    try:
         owner = c.functions.ownerOf(req.token_id).call()
         is_used = c.functions.tokenUsed(req.token_id).call()
         if is_used:
             return {"status": "INVALID", "reason": "already_used"}
         return {"status": "VALID", "token_id": req.token_id, "owner": owner}
    except Exception as e:
         return {"status": "INVALID", "reason": "not_found", "details": str(e)}

        
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
