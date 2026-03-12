import sys
sys.path.append("/home/prasaz_nat/desk/projects/Blockchain-based-ticket-booking-system-proto/block-chain-proto_new/backend")
from main import get_contract
import requests

c = get_contract()
owner = c.functions.ownerOf(22).call().lower()
print(f"Token 22 owner: {owner}")

res = requests.post(f"http://localhost:8000/tickets/22/transfer-email", 
                    json={"email": "prasaznat@gmail.com"}, 
                    headers={"x-wallet-address": owner})
print(res.status_code, res.text)
