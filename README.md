# ⚡ NEXUS TITAN OS
**A Decentralized, Bare-Metal WebAssembly Unikernel with Native Cryptoeconomics.**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![Platform](https://img.shields.io/badge/platform-bare--metal%20%7C%20x86__64-blue.svg)](#)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#)

NEXUS TITAN OS is a paradigm shift in distributed computing. It strips away the bloat of traditional operating systems (Linux/Windows) and heavy networking stacks, running a high-speed WebAssembly (WASM) execution engine directly on the silicon. 

By utilizing zero-copy DMA networking and a Kademlia-based DHT mesh, Nexus Titan allows nodes to securely execute over-the-air (OTA) computational payloads with sub-millisecond latency, settling transactions via a native Practical Byzantine Fault Tolerance (pBFT) consensus engine.

## 🚀 Key Features

* **Layer 0: Bare-Metal Unikernel**
  * OS-less execution written entirely in Rust (`no_std`).
  * Direct Hardware Access: Custom ATA/IDE disk drivers and VGA hardware bank switching.
  * Fast System Calls: Hardware-level Ring-0 to Ring-3 transitions via `MSR LSTAR`.
* **Layer 1 & 2: Zero-Latency Fabric**
  * Intel E1000 Gigabit NIC Driver with Zero-Copy DMA RX/TX Rings (128B aligned to prevent false sharing).
  * Kernel-bypass networking using a custom `smoltcp` stack.
  * P2P UDP Gossip network and Kademlia DHT (256-bit XOR metric) for instant swarm discovery.
* **Layer 3: Secure Compute Enclave**
  * JIT WebAssembly (WASM) Sandbox Engine running in Ring-3.
  * Over-The-Air (OTA) Payload Injection: Catch raw WASM frames off the wire and execute them instantly.
* **Layer 4: Built-in Cryptoeconomics**
  * **Proof-of-Useful-Compute (PoUC):** Cryptographic receipts for executed WebAssembly tasks.
  * **Surge Pricing Engine:** Dynamic gas metering based on live network load and memory allocation.
  * **pBFT Consensus:** O(1) SWAR voting math for sub-second state validation and Vault updating.

## 🌉 The Cloud Gateway (Web3 Integration)
Nexus Titan includes a Next.js based Web3 Gateway that allows browsers to interact directly with the bare-metal kernel via UDP Datagrams/WebSockets, bridging the gap between consumer web and extreme bare-metal edge nodes.

## 🛠️ Build & Run

**Requirements:**
* Rust Nightly (with `rust-src` component)
* QEMU (`qemu-system-x86_64`)
* Node.js (for the Cloud Gateway)

**Booting the Kernel:**
```bash
cd nexus-core
cargo build
cp target/x86_64-unknown-uefi/debug/nexus-core.efi esp/EFI/BOOT/BOOTX64.EFI
qemu-system-x86_64 -drive if=pflash,format=raw,readonly=on,file=$PWD/OVMF.fd -drive format=raw,file=fat:rw:esp -netdev user,id=net0,hostfwd=udp::6969-:6969 -device e1000,netdev=net0,mac=52:54:00:12:34:56b