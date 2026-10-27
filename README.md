# ⚡ Nexus Titan // Decentralized Apple Silicon WASM Compute Network (DePIN)

**Nexus Titan** is a production-grade, serverless WebAssembly (WASM) distributed compute platform powered by Apple Silicon (M4) worker nodes, content-addressed UDP (`NEXH` / `NEXC`) transport, pre-flight static infinite-loop bytecode guards, Ed25519 hardware attestation, and Burn-and-Mint Equilibrium (BME) tokenomics.

---

## 🌟 Key Innovations & Architecture

1. **Zero-Docker Sub-Millisecond WASM MicroVMs:** Executes compiled `.wasm` kernels directly inside isolated Worker Thread sandboxes with linear memory inspection (`0x30000` matrix buffer).
2. **2-Layer Infinite-Loop & Gas Protection:**
   - **Layer 1 (Pre-Flight Static Scanner):** Scans raw WASM bytecode (`0x03` loop opcodes) before dispatch and bans unconditional infinite loops (`loop ... br 0` without `br_if`).
   - **Layer 2 (Dynamic SLA Gas Window):** Enforces compute-tier execution timeouts so worker nodes never hang.
3. **Hybrid UDP (`NEXH`/`NEXC`) + HTTP/HTTPS WAN Miner Bridge:** Ultra-fast zero-copy hash probes over LAN UDP (`:6969`, `:6970`, `:6971`) combined with an HTTP/HTTPS WAN bridge (`:6972+`) so external laptops worldwide can mine without router port-forwarding.
4. **Cryptographic Proof-of-Compute:** Every shard output is signed using **Ed25519** hardware keys and sealed into a SHA-256 Merkle State Root. Dishonest nodes are automatically slashed (`-250 NXC`) and rescued by hero nodes.
5. **Multi-Tenant API Keys & UPI (INR) / Web3 Billing:** Built-in tenant isolation (`nx_live_...`) with instant UPI (UTR) and USDC top-up settlement.

---

## 🚀 1-Command Quick Start

```bash
git clone https://github.com/mohazzamali/titan-os-.git
cd titan-os-
./start_nexus.sh
```

Open **http://localhost:3000** in your browser to access the 6-Tab Enterprise Cloud Console.

---

## 🖥️ 6-Tab Enterprise Console Overview

- **Tab 1 — Compute Deployment & Batch Runner:** Run 5 built-in industry WASM kernels (Quant Monte Carlo, ZK SHA-256 Merkle, DSP Spectral FFT, AI Cosine Similarity, Verlet Physics) or upload custom `.wasm` binaries (up to 50 MB) with Single-Vector or Multi-Row CSV Batch execution.
- **Tab 2 — Live WASM Studio & Loop Guard:** Edit loop iterations, bitwise operators (`XOR`, `ADD`, `MUL`), and constants in real time, compile to `.wasm` in-browser, and test the Static Infinite-Loop Ban.
- **Tab 3 — CLI & Software SDK Bridge:** Connect external Python, Node.js, or Rust applications via REST RPC.
- **Tab 4 — Medical & Vision Pixel Pipeline:** Real-time 3x3 Sobel Edge, CLAHE contrast enhancement, and radiograph negative filtering attested on the M4 cluster.
- **Tab 5 — Immutable Block Explorer & LAN Node Onboarding:** Full audit trail of every block across Web Console, CLI, and Python SDK, plus 1-line LAN miner join commands.
- **Tab 6 — API Keys, UPI Billing & Public Domain:** Generate customer `nx_live_...` API keys, credit NXC via UPI (INR) packages, and expose the gateway over Cloudflare HTTPS tunnels.

---

## 🛠️ External CLI & Python SDK Usage

### Node.js CLI Dispatcher
```bash
node tools/nexus_cli.js --kernel zk_sha256_merkle --vector "45,80,120,165,256,720" --shards 8
```

### Zero-Dependency Python SDK
```bash
python3 tools/nexus_sdk.py
```

### Connect a Remote WAN Miner (Anywhere on the Internet)
```bash
node tools/nexus_miner_package.js --gateway http://localhost:3000 --port 6972
```

For detailed step-by-step instructions, see **[USER_GUIDE.md](./USER_GUIDE.md)**.
