import socket
import sys

if len(sys.argv) != 3:
    print("Usage: python3 remote_client.py <num1> <num2>")
    sys.exit(1)

num1, num2 = int(sys.argv[1]), int(sys.argv[2])
if not (0 <= num1 <= 255 and 0 <= num2 <= 255):
    print("Error: Numbers must be between 0 and 255")
    sys.exit(1)

# Magic "CMPT" Header + Num1 + Num2 (Padded to 64 bytes to bypass hardware drop)
payload = b'CMPT' + bytes([num1, num2])
payload += b'\x00' * (64 - len(payload))

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
print(f"🚀 FIRING RPC COMMAND OVER NETWORK: {num1} + {num2} -> NEXUS FABRIC")
sock.sendto(payload, ('127.0.0.1', 7777))
print("✅ Payload Injected Successfully!")
