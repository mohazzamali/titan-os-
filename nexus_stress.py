import socket
import threading
import time

TARGET_IP = "127.0.0.1"
TARGET_PORT = 6969 # 🚀 Changed to UDP Port

# 14-Byte Valid WASM Payload (10 + 32 = 42)
WASM_PAYLOAD = b"\x00\x61\x73\x6D\x01\x00\x00\x00\x41\x0A\x41\x20\x6A\x0B"

def fire_payload(thread_id):
    try:
        # 🚀 Using SOCK_DGRAM for UDP (Fire and Forget!)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.sendto(WASM_PAYLOAD, (TARGET_IP, TARGET_PORT))
        print(f"[Attack {thread_id}] FIRE -> UDP DATAGRAM INJECTED!")
    except Exception as e:
        print(f"[Attack {thread_id}] FAILED: {e}")
    finally:
        s.close()

print("🔥 LAUNCHING NEXUS STRESS TEST: UDP WASM BOMBARDMENT 🔥")
print("Target: Bare-Metal Unikernel (UDP Port 6969)")
time.sleep(1)

def launch_burst(start, count):
    threads = []
    for i in range(start, start + count):
        t = threading.Thread(target=fire_payload, args=(i,))
        threads.append(t)
        t.start()
        time.sleep(0.01) # Ultra fast! UDP doesn't care about handshakes!
    
    for t in threads:
        t.join()

# Fire 5 bursts of 20 packets
for burst in range(5):
    print(f"\n--- FIRING BURST {burst + 1}/5 ---")
    launch_burst(burst * 20 + 1, 20)
    time.sleep(0.5)

print("\n🎯 UDP BOMBARDMENT COMPLETE.")