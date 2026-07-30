#!/bin/bash
echo "=================================================="
echo "🚀 IGNITING THE NEXUS MULTI-NODE CLUSTER..."
echo "=================================================="

# Compile the OS
cargo bootimage

# 🎯 THE FIX: Total File Isolation!
# Copy both the NVMe Ledger AND the Kernel Binary for Node B
cp nexus_drive.img nexus_drive_b.img
cp target/x86_64-unknown-none/debug/bootimage-nexus-core.bin bootimage_b.bin

echo "🟢 Booting Node A (Alpha) on Port 7777..."
qemu-system-x86_64 -drive format=raw,file=target/x86_64-unknown-none/debug/bootimage-nexus-core.bin -drive file=nexus_drive.img,format=raw,if=none,id=nvme0 -device nvme,serial=1234,drive=nvme0 -net none -netdev user,id=net0,hostfwd=udp:127.0.0.1:7777-:7777 -device e1000,netdev=net0,mac=52:54:00:12:34:56 -smp 4 -display cocoa -serial stdio &

sleep 3

echo "🔵 Booting Node B (Beta) on Port 7778..."
# Node B now boots from its own private kernel file (bootimage_b.bin)
qemu-system-x86_64 -drive format=raw,file=bootimage_b.bin -drive file=nexus_drive_b.img,format=raw,if=none,id=nvme0 -device nvme,serial=5678,drive=nvme0 -net none -netdev user,id=net0,hostfwd=udp:127.0.0.1:7778-:7777 -device e1000,netdev=net0,mac=52:54:00:11:22:33 -smp 4 -display cocoa &

echo "✅ CLUSTER ONLINE! Node A and Node B are executing fully independently."
wait
