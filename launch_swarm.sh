#!/bin/bash
echo "======================================================="
echo " 🌌 INITIATING NEXUS TITAN 4-NODE CLUSTER (THE SWARM)"
echo "======================================================="

killall -9 qemu-system-x86_64 2>/dev/null

echo "🛠️ Compiling Immortal Bare-Metal OS..."
cd nexus-core
cargo build --target x86_64-unknown-uefi --release
cp target/x86_64-unknown-uefi/release/nexus-core.efi esp/EFI/BOOT/BOOTX64.EFI
cd ..

echo "🚀 IGNITING SWARM NODES..."

# NODE 1: GENESIS (Sends Gossip out to Mac)
qemu-system-x86_64 -m 256M -drive if=pflash,format=raw,readonly=on,file=nexus-core/OVMF.fd -drive format=raw,file=fat:rw:nexus-core/esp -device e1000,netdev=n1,mac=52:54:00:12:34:01 -netdev user,id=n1,hostfwd=tcp:127.0.0.1:9999-:9999,hostfwd=udp::7001-:6969 -name "NEXUS [GENESIS NODE]" &
sleep 1.5

# NODE 2: ALPHA (Listens on Mac Port 7002)
qemu-system-x86_64 -m 256M -drive if=pflash,format=raw,readonly=on,file=nexus-core/OVMF.fd -drive format=raw,file=fat:rw:nexus-core/esp -device e1000,netdev=n2,mac=52:54:00:12:34:02 -netdev user,id=n2,hostfwd=udp::7002-:6969 -name "NEXUS [ALPHA NODE]" &
sleep 1.5

# NODE 3: BETA (Listens on Mac Port 7003)
qemu-system-x86_64 -m 256M -drive if=pflash,format=raw,readonly=on,file=nexus-core/OVMF.fd -drive format=raw,file=fat:rw:nexus-core/esp -device e1000,netdev=n3,mac=52:54:00:12:34:03 -netdev user,id=n3,hostfwd=udp::7003-:6969 -name "NEXUS [BETA NODE]" &
sleep 1.5

# NODE 4: GAMMA (Listens on Mac Port 7004)
qemu-system-x86_64 -m 256M -drive if=pflash,format=raw,readonly=on,file=nexus-core/OVMF.fd -drive format=raw,file=fat:rw:nexus-core/esp -device e1000,netdev=n4,mac=52:54:00:12:34:04 -netdev user,id=n4,hostfwd=udp::7004-:6969 -name "NEXUS [GAMMA NODE]" &

echo "🔥 SWARM CLUSTER ONLINE! START THE PYTHON RELAY TO BRIDGE THEM."
wait