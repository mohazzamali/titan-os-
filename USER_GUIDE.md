# 📖 NEXUS TITAN OS - The Ultimate User Guide

Welcome to the future of decentralized computing! This guide is designed to help you understand what **NEXUS TITAN OS** is, who it is built for, what it can (and cannot) do, and how you can run it on your own hardware.

---

## 🎯 1. Is Nexus Titan For You? (Target Audience)

Nexus Titan is a highly specialized "Unikernel". It is not designed to replace your daily operating system (like Windows, macOS, or Ubuntu). It is designed to turn your computer into a **high-speed, decentralized compute node.**

**✅ THIS OS IS FOR YOU IF:**
* **You are a Node Operator/Miner:** You want to dedicate a spare PC or Server to execute decentralized tasks and earn NXC tokens.
* **You are a Cloud Developer:** You want a lightning-fast, zero-overhead environment to run WebAssembly (WASM) functions securely.
* **You are a Systems Hacker:** You love bare-metal architecture, zero-copy networking, and Kernel-bypass technologies.
* **You build IoT or Edge Devices:** You need a tiny, instantaneous OS to run on smart cameras, drones, or routers.

**❌ THIS OS IS NOT FOR YOU IF:**
* You want to browse the web, watch YouTube, or play traditional PC games.
* You need a Graphical User Interface (GUI) with a mouse, folders, and a start menu.
* You want to host standard WordPress websites or run Docker containers.

---

## ⚙️ 2. What Can Nexus Titan Actually Do?

* **Execute WASM Over-The-Air (OTA):** It can receive raw WebAssembly code directly from the network (via UDP) and execute it in milliseconds, bypassing traditional OS networking stacks.
* **Mint Crypto (PoUC):** It uses "Proof-of-Useful-Compute". When your node successfully executes a task, it natively participates in pBFT consensus and secures Total Value Locked (TVL) in the network.
* **Surge Pricing:** The OS has a built-in economic engine. If the network gets flooded (like a DDoS attack or heavy task load), it automatically increases the payout for executing tasks.
* **Run Without an OS:** It boots directly onto the silicon, dedicating 100% of the CPU power to the task, with absolutely zero background bloat.

---

## 🚀 3. How to Set Up and Run Nexus Titan

There are two ways to experience Nexus Titan:

### Method A: The Cloud User (Deploying Tasks)
If you just want to run code on the Nexus network, you don't need to install the OS. You just need the Gateway.
1. Make sure Node.js is installed on your machine.
2. Navigate to the Cloud Gateway folder: `cd nexus-hub/dashboard`
3. Install dependencies: `npm install`
4. Start the dashboard: `npm run dev`
5. Open your browser to `http://localhost:3000`. You can now inject `.wasm` files directly into the global swarm.

### Method B: The Node Operator (Running the OS)
If you want to run the actual bare-metal OS on your machine or an emulator.

**Prerequisites:**
* Rust (Nightly toolchain with `rust-src`)
* QEMU (for emulation)

**Steps to Boot (in Emulator):**
1. Open your terminal and navigate to the core folder: `cd nexus-core`
2. Build the Unikernel: `cargo build`
3. Prepare the EFI boot directory: 
   `cp target/x86_64-unknown-uefi/debug/nexus-core.efi esp/EFI/BOOT/BOOTX64.EFI`
4. Launch the OS via QEMU with the custom network bridge (Port 6969):
   ```bash
   qemu-system-x86_64 -drive if=pflash,format=raw,readonly=on,file=$PWD/OVMF.fd -drive format=raw,file=fat:rw:esp -netdev user,id=net0,hostfwd=udp::6969-:6969 -device e1000,netdev=net0,mac=52:54:00:12:34:56
