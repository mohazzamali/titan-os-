import socket
import struct

# Nexus Mesh Protocol Settings
TARGET_IP = "127.0.0.1"
TARGET_PORT = 7777

print("🚀 NEXUS P2P INJECTOR 🚀")
print(f"Targeting Node at {TARGET_IP}:{TARGET_PORT}...")

# 0xDEADBEEF00000001
fake_id = struct.pack('<Q', 0xDEADBEEF00000001) 
fake_ip = bytes([192, 168, 1, 99])
fake_mac = bytes([0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF])

payload = fake_id + fake_ip + fake_mac
payload += b'\x00' * (64 - len(payload))

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
print(f"📡 Firing Fake P2P Handshake (ID: DEADBEEF00000001)...")
sock.sendto(payload, (TARGET_IP, TARGET_PORT))
print("✅ Packet Injected!")
