from web3 import Web3
import json
import os

# Connect to Hardhat
w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))

# Load deployment info
with open("backend/deployment.json", "r") as f:
    deploy = json.load(f)

# Load ABI
with open("backend/TicketNFT_abi.json", "r") as f:
    abi = json.load(f)

contract = w3.eth.contract(address=deploy["contractAddress"], abi=abi)

event_id = "EVT-001"
max_supply = contract.functions.eventMaxSupply(event_id).call()
minted_count = contract.functions.eventMintedCount(event_id).call()
price = contract.functions.eventPrice(event_id).call()

print(f"Event: {event_id}")
print(f"Max Supply: {max_supply}")
print(f"Minted Count: {minted_count}")
print(f"Price (Wei): {price}")
