import socket
import os

WASM_FILE = "nexus-contract/target/wasm32-unknown-unknown/release/nexus_contract.wasm"
MCAST_GRP = '230.0.0.1'
MCAST_PORT = 1234

print("\n🌌 NEXUS CLOUD GATEWAY: INITIALIZING INJECTION...")
if not os.path.exists(WASM_FILE):
    print("❌ ERROR: WASM file not found! Ensure nexus-contract is built.")
    exit(1)

with open(WASM_FILE, "rb") as f:
    wasm_bytes = f.read()

# Construct the NEXUS FABRIC FRAME (Raw Ethernet)
# 6 bytes Dest MAC (Broadcast), 6 bytes Src MAC (Cloud Node), 2 bytes EtherType (0x88B5), 1 byte Command (0x03 = RPC_EXEC)
header = bytes([
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,  
    0x52, 0x54, 0x00, 0x99, 0x99, 0x99,        
    0x88, 0xB5,                          
    0x03                                 
])

payload = header + wasm_bytes

print(f"📦 AI Payload constructed: {len(payload)} bytes.")
print("🚀 BROADCASTING RAW ETHERNET FRAME TO SWARM MULTICAST (230.0.0.1:1234)...")

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
sock.sendto(payload, (MCAST_GRP, MCAST_PORT))

print("✅ DEPLOYMENT SUCCESSFUL! Check your QEMU windows!\n")
