# NEXUS TITAN: Bare-Metal Decentralized OS

**NEXUS TITAN** is a custom Ring-0 Unikernel Operating System written entirely in Rust. It bypasses traditional centralized cloud infrastructure by establishing a bare-metal, peer-to-peer compute mesh.

## 🚀 Core Architecture Pillars
1. **The Silicon Foundation:** Direct Ring-0 memory management, PCIe ECAM scanning, and MSI-X hardware interrupts.
2. **The Zero-Trust Fabric:** A custom network stack bypassing standard TCP/IP. Uses Kademlia DHT (256 K-Buckets) and Epidemic Gossip over UDP Multicast for node discovery.
3. **The Compute Sandbox:** A strictly deterministic WebAssembly (WASM) JIT compiler. Dynamically scales RAM for AI tensors and blocks malicious operations via register bitmasking.
4. **The Economic Consensus:** Utilizes an $O(1)$ Bit-Vector voting engine to achieve $3f+1$ pBFT (Practical Byzantine Fault Tolerance). Mints NXC tokens as Proof-of-Useful-Compute.
5. **The Dreaming Layer:** An autonomous protocol mutation engine. Uses a Graph Neural Network (GNN) to map Mid-level Intermediate Representation (MIR) into a 256-Dimensional Tensor Space, performs a geodesic walk, and verifies safety via the Gamma ($\Gamma$) Formal Artifact.

## 🛠️ Build & Run
To run the 4-Node Swarm Cluster on a single machine (requires QEMU):
```bash
./launch_swarm.sh
