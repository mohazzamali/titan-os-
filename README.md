# 🌐 NEXUS TITAN: Bare-Metal Decentralized Cloud OS

![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![Architecture](https://img.shields.io/badge/Architecture-WebSockets%20%7C%20TCP%20%7C%20Rust-orange)
![Status](https://img.shields.io/badge/Status-Fully%20Operational-brightgreen)

**NEXUS TITAN** is a custom Ring-0 Unikernel Operating System written entirely in Rust, fused with a modern Full-Stack Web3 ecosystem. It bypasses traditional centralized cloud infrastructure (like AWS or Google Cloud) by establishing a bare-metal, peer-to-peer compute mesh that monetizes idle hardware globally.

---

## ❓ The Problem it Solves
Millions of old PCs, laptops, and smartphones sit idle across the world. Titan Nexus bridges this gap. It allows anyone to rent out their idle hardware (CPU/RAM) to execute tasks and earn crypto (NXC tokens), while allowing buyers to compute massive workloads at a fraction of the cost.

## 🏗️ The 3-Tier Ecosystem
1. **The Web Hub (Next.js):** The global marketplace where buyers upload their compute tasks (WebAssembly `.wasm` files) from any device (even smartphones).
2. **The Universal Relay (Node.js):** The "Matchmaker". It takes tasks from the Web Hub and broadcasts them across the global Swarm using both WebSockets (Port 8080) and Raw TCP (Port 8081).
3. **The Bare-Metal Nodes (Rust / Titan OS):** The workers. They catch the tasks, execute them in an isolated sandbox, and instantly send the results back via our custom hardware network stack.

---

## 🚀 Core Architecture Pillars (Deep Tech)
1. **The Silicon Foundation:** Direct Ring-0 memory management, PCIe ECAM scanning, and MSI-X hardware interrupts.
2. **The Zero-Trust Fabric:** A custom network stack bypassing standard TCP/IP. Uses Kademlia DHT (256 K-Buckets) and Epidemic Gossip over UDP Multicast for node discovery.
3. **The Compute Sandbox:** A strictly deterministic WebAssembly (WASM) JIT compiler. Dynamically scales RAM for AI tensors and blocks malicious operations via register bitmasking.
4. **The Economic Consensus:** Utilizes an $O(1)$ Bit-Vector voting engine to achieve $3f+1$ pBFT (Practical Byzantine Fault Tolerance). Mints NXC tokens as Proof-of-Useful-Compute.
5. **The Dreaming Layer:** An autonomous protocol mutation engine. Uses a Graph Neural Network (GNN) to map Mid-level Intermediate Representation (MIR) into a 256-Dimensional Tensor Space, performs a geodesic walk, and verifies safety via the Gamma ($\Gamma$) Formal Artifact.

---

## 💡 Real-World Use Cases
- **AI & Data Processing:** Split massive datasets and process them across thousands of idle laptops globally.
- **Video Rendering:** 3D artists can render animations by distributing frames to the Swarm instead of buying expensive GPUs.
- **Passive Income:** Flash the `TITAN_OS_v1.iso` on a USB drive, boot an old PC, and passively earn NXC tokens just by staying connected.

---

## 🛠️ Build & Run Instructions

### Option A: Run the Full-Stack Cloud Network
To spin up the entire marketplace and connect web/mobile clients:

**1. Start the Relay Matchmaker:**
```bash
cd nexus-relay
node server.js