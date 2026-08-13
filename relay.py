import socket

# Bind to localhost to intercept QEMU's SLIRP UDP packets
server = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
server.bind(("0.0.0.0", 6969))

print("==================================================")
print(" 🌐 NEXUS TRUE MESH RELAY [ACTIVE]")
print(" Listening for Genesis UDP Packets on Port 6969...")
print("==================================================\n")

# Map of the other Swarm Nodes (Alpha, Beta, Gamma)
SWARM_NODES = [("127.0.0.1", 7002), ("127.0.0.1", 7003), ("127.0.0.1", 7004)]

while True:
    data, addr = server.recvfrom(1024)
    print(f"⚡ [INTERCEPT] {len(data)} bytes received from {addr}!")
    
    if b"GOSSIP" in data:
        print("🚀 [BROADCAST] Routing TVL Update to Alpha, Beta, & Gamma...")
        for node in SWARM_NODES:
            server.sendto(data, node)
        print("✅ Sync Complete!\n")