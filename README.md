# Nexus Titan // Distributed WebAssembly Compute Platform

Production DePIN compute platform powered by Apple Silicon worker nodes, content-addressed UDP (NEXH / NEXC) transport, Ed25519 hardware attestation, pre-flight infinite-loop bytecode guards, and Burn-and-Mint Equilibrium (BME) token settlement.

## Quick Start (1-Command Launch)

    ./start_nexus.sh

Open http://localhost:3000 in your browser.

## Core Capabilities

1. Compute Deployment & Batch Runner: Run 5 built-in industry .wasm kernels or upload custom .wasm binaries up to 50 MB with single-vector or multi-row CSV batch execution.
2. In-Platform Live WASM Studio & Loop Guard: Edit loop iterations, folding operators (XOR, ADD, MUL), and constants in the browser, assemble into a real .wasm binary, and verify pre-flight static infinite-loop rejection.
3. Standalone CLI & Zero-Dependency Python SDK:

    node tools/nexus_cli.js --kernel zk_sha256_merkle --vector "45,80,120,165,256,720" --shards 8
    python3 tools/nexus_sdk.py

4. Medical & Vision Convolution Pipeline: Real-time 3x3 Sobel Edge, CLAHE contrast enhancement, and radiograph negative filtering backed by M4 cluster attestation.
5. Immutable Block Explorer & LAN Node Onboarding:

    GATEWAY_HOST=<GATEWAY_LAN_IP> node tools/miner_node.js 6972
