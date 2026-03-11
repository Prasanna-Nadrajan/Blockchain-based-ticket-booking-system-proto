# NFT Blockchain Ticket App — Implementation Plan

A full-stack, single-page web application for an NFT-based event ticketing system,
built with a **FastAPI backend** (Python) and a **Vanilla HTML/CSS/JS frontend**.
No real blockchain is required — a mock in-memory ledger simulates NFT minting,
transfer, and verification, keeping the demo fully self-contained.

---

## Proposed Changes

### Backend — FastAPI + Mock Blockchain

#### [NEW] `backend/main.py`
Core FastAPI application. Implements a simple in-memory state store that acts as the "blockchain ledger". All business logic lives here.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/events` | Create a new event |
| `GET` | `/events` | List all events |
| `POST` | `/events/{id}/tickets/generate` | Batch-mint NFT tickets (organizer) |
| `GET` | `/events/{id}/tickets` | List all tickets for an event |
| `GET` | `/tickets/{ticket_id}` | Get ticket details + QR payload |
| `POST` | `/tickets/{ticket_id}/transfer` | Transfer ticket to new holder |
| `GET` | `/tickets/{ticket_id}/qr` | Generate QR code PNG (base64) |
| `POST` | `/verify` | Verify a ticket by QR payload → VALID/INVALID |

**Mock Blockchain Layer:**
- Each ticket is an NFT with a unique `token_id` and `owner_address`
- Minting increments a counter and stores to the in-memory ledger
- Transfer updates `owner_address` and appends to `transfer_history`
- Verification checks `token_id` validity, event match, and `is_used` status

#### [NEW] `backend/requirements.txt`
```
fastapi
uvicorn
qrcode[pil]
pillow
python-multipart
```

---

### Frontend — Three-Page UI

#### [NEW] `frontend/index.html`
Landing/home page with animated role selection cards (Organizer / Ticket Holder / Gate Verifier).

#### [NEW] `frontend/organizer.html`
- **Create Event** form (name, date, venue, total capacity)
- **Generate Tickets** (select event → enter count → mint batch)
- **View Tickets** table (paginated list with status badges)
- **Verify Ticket** tab (enter ticket ID manually → see result)

#### [NEW] `frontend/holder.html`
- **My Tickets** list (fetched by wallet address)
- **View QR Code** modal (shows QR image for selected ticket)
- **Transfer Ticket** modal (enter recipient address → confirm)

#### [NEW] `frontend/verifier.html`
- **Scan QR** button → uses browser camera (HTML5 `getUserMedia` + `jsQR` library)
- Fallback: paste QR payload manually
- Result display: large `✓ VALID` / `✗ INVALID` with ticket details

#### [NEW] `frontend/styles.css`
Global design system:
- Deep dark background with glassmorphism cards
- Neon accent color palette (purple/cyan gradient)
- Google Fonts: **Inter**
- Smooth micro-animations and hover effects
- Responsive grid layouts

---

## Verification Plan

### Automated API Tests
Run the FastAPI server, then use `curl` or the built-in Swagger UI:

```bash
# 1. Start backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 2. Open Swagger UI
# Navigate to: http://localhost:8000/docs
```

### Browser Demo (Manual)
1. Open `frontend/index.html` in a browser (just double-click or use Live Server)
2. **Organizer flow**:
   - Click Organizer → Create an event → Generate 10 tickets → View ticket list
3. **Ticket Holder flow**:
   - Open Holder page → Enter wallet address → See tickets → Click a ticket → View QR
   - Transfer a ticket to another wallet address
4. **Gate Verifier flow**:
   - Open Verifier page → Paste a ticket token ID → Click Verify → See VALID result
   - Try an invalid/used ticket → See INVALID result
