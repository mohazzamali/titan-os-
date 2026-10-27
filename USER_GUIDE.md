# 📖 Nexus Titan — Complete User & Developer Guide

Welcome to **Nexus Titan**. This guide covers how to run the cluster, deploy WebAssembly workloads, connect external software, onboard remote miner nodes, and manage customer billing.

---

## 1. Starting the Platform

Run the automated launcher from the root directory:
```bash
./start_nexus.sh
```
This script automatically:
- Frees ports `3000`, `6969`, `6970`, and `6971`.
- Launches 3 local Apple Silicon M4 UDP worker nodes (`:6969`, `:6970`, `:6971`).
- Starts the Next.js Gateway Console at `http://localhost:3000`.

---

## 2. Running Compute Workloads (Tab 1)

1. Open `http://localhost:3000` -> **1. Compute Deployment**.
2. Choose one of the **Top 5 Production WASM Kernels** or click **Choose File** to upload your own compiled `.wasm` binary.
3. **Parameter Vector Mode:** Enter comma-separated 32-bit integers (e.g., `45, 80, 120, 165, 256, 720`). Any vector longer than 4 numbers is automatically partitioned across nodes.
4. **Batch Dataset Mode:** Switch to **Batch Dataset (Multi-Row CSV)** to process multiple vectors at once and click **Download .CSV** to export results.
5. Click **Deploy & Execute on Cluster** to view real-time GOPS throughput, Ed25519 shard signatures, BME token burn (30%), and the 64-word Linear Memory Snapshot (`0x30000`).

---

## 3. Live WASM Studio & Infinite-Loop Guard (Tab 2)

1. Open **2. Live WASM Studio & Loop Guard**.
2. Customize **Loop Iterations**, **Primary Folding Operator** (`i32.xor`, `i32.add`, `i32.mul`), and seed constants.
3. Check the live disassembled **WebAssembly Text (WAT)** preview on the right.
4. **Testing Security:** Enable the **Test Pre-Flight Infinite Loop Ban** checkbox and click **Compile .WASM & Execute**. The gateway will inspect the bytecode and reject the unconditional `br 0` loop before it ever reaches a miner.

---

## 4. Connecting External Software (Tab 3)

- **From Terminal (CLI):**
```bash
node tools/nexus_cli.js --kernel quant_monte_carlo --vector "45,80,120,165" --shards 4
```
- **From Python Applications:**
```python
from tools.nexus_sdk import NexusClient
client = NexusClient("http://localhost:3000/api/deploy")
res = client.compute(vector=[45, 80, 120, 165], kernel="zk_sha256_merkle", shards=8)
print(res["verifiedMinerOutputVector"])
```

---

## 5. Onboarding Additional Miner Nodes (Tab 5 & Tab 6)

- **Same Wi-Fi / LAN Miner (UDP):**
```bash
GATEWAY_HOST=<YOUR_MAC_LAN_IP> node tools/miner_node.js 6972
```
- **Global Internet Miner (HTTP/HTTPS WAN Tunnel — Zero Port Forwarding):**
```bash
node tools/nexus_miner_package.js --gateway https://your-domain.in --port 6972
```

---

## 6. Multi-User API Keys & UPI Billing (Tab 6)

1. Open **6. API Keys, UPI Billing & Domain**.
2. Enter a client name (e.g., `QuantBot Alpha`) and click **+ Generate API Key** to issue a dedicated `nx_live_...` key with an isolated NXC balance.
3. Select a package (`₹500`, `₹1,000`, or `₹5,000`), enter the 12-digit UPI UTR reference, and click **Verify UPI / UTR** to credit NXC to that key.
4. Pass `x-api-key: nx_live_...` in HTTP headers when calling `/api/deploy` to meter usage per customer.
