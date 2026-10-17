# ⚡ NEXUS TITAN: Dual-Path Decentralized Bare-Metal Compute Fabric

**NEXUS** is a high-performance, verifiable decentralized computing network (DePIN) that bridges a **Next.js BFT Verification Gateway** directly with **Path-A `#![no_std]` Rust UEFI Bare-Metal Unikernels** and **Path-B Sandboxed WebAssembly Miner Daemons** over a custom binary UDP protocol (`NEXUS Frame v0.1`).

---

## 🏗️ 5-Layer Architecture (Implemented & Live)

1. **Layer 0 (Silicon Backbone - Path A & Path B):**
   - **Path A (`nexus-core`):** `#![no_std]` Rust UEFI Unikernel with PCIe bus scanning, Intel E1000 DMA Ring Buffers (`128-byte` aligned), `smoltcp` network stack, and Ring-0/Ring-3 GDT/MSR syscall isolation.
   - **Path B (`tools/miner_node.js`):** Multi-instance UDP WebAssembly MicroVM Daemons broadcasting real-time hardware telemetry.
2. **Layer 1 (Link Fabric - `NEXUS Frame v0.1`):**
   - Binary-aligned UDP packets with `0x4E455855` (`"NEXU"`) magic header, frame type flags, 64-byte SHA-512 cryptographic integrity digest, 12-byte shard header, and raw `.wasm` bytecode payload.
3. **Layer 2 (Discovery & 4-Digit PIN Broker):**
   - Real-time UDP `PING/PONG` heartbeat liveness scanner (`:6969`, `:6970`, `:6971`), Kademlia XOR distance routing (`255 - clz(x ^ y)`), and 4-digit PIN DHT key indexing (`PIN_HASH`).
4. **Layer 3 (Trusted Compute & Explainable Scheduler):**
   - **NCIP Capabilities Passports:** Nodes report live CPU cores, bandwidth, thermal penalty, and RTT latency.
   - **Asymmetric Load Balancing:** Workloads (1,000 shards) are dynamically split across live nodes proportional to their `Fixed64` Selection Utility Score, producing a full JSON Audit Trail on every run.
5. **Layer 4 (BFT Verification, Hunter-Killer Slashing & Surge Pricing):**
   - **O(1) Deterministic Spot-Check:** Gateway verifies boundary shards in V8 WASM without re-running the full workload.
   - **Hunter-Killer Slashing:** Rogue/Byzantine miners (`--corrupt`) returning tampered outputs are immediately caught, slashed `-25,000 NXC` from staked collateral, and blacklisted.
   - **Autonomous Surge Pricing:** Dynamic fee calculation `Base * (1 + (Load / Capacity)^2)` settled atomically per node.
