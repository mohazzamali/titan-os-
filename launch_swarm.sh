#!/bin/bash
echo "🌌 INITIATING NEXUS TITAN 4-NODE CLUSTER..."

killall -9 qemu-system-x86_64 2>/dev/null
rm -f /tmp/nexus_multicast.sock

echo "🛠️ Recompiling Bare-Metal OS..."
cd nexus-core
cargo bootimage
cd ..

MASTER_IMAGE="nexus-core/target/x86_64-unknown-none/debug/bootimage-nexus-core.bin"

echo "💽 CLONING ISOLATED DISK IMAGES FOR SWARM NODES..."
cp $MASTER_IMAGE /tmp/nexus_node1.bin
cp $MASTER_IMAGE /tmp/nexus_node2.bin
cp $MASTER_IMAGE /tmp/nexus_node3.bin
cp $MASTER_IMAGE /tmp/nexus_node4.bin

echo "🚀 IGNITING SWARM NODES..."

# Node 1
qemu-system-x86_64 -drive format=raw,file=/tmp/nexus_node1.bin -m 128M -netdev socket,id=net0,mcast=230.0.0.1:1234 -device e1000,netdev=net0,mac=52:54:00:12:34:01 -netdev user,id=net1,hostfwd=tcp::9999-:9999 -device e1000,netdev=net1 -display cocoa -name "NEXUS NODE 1 (ALPHA)" &
sleep 2

# Node 2
qemu-system-x86_64 -drive format=raw,file=/tmp/nexus_node2.bin -m 128M -netdev socket,id=net0,mcast=230.0.0.1:1234 -device e1000,netdev=net0,mac=52:54:00:12:34:02 -display cocoa -name "NEXUS NODE 2 (BETA)" &
# Node 3
qemu-system-x86_64 -drive format=raw,file=/tmp/nexus_node3.bin -m 128M -netdev socket,id=net0,mcast=230.0.0.1:1234 -device e1000,netdev=net0,mac=52:54:00:12:34:03 -display cocoa -name "NEXUS NODE 3 (GAMMA)" &
# Node 4
qemu-system-x86_64 -drive format=raw,file=/tmp/nexus_node4.bin -m 128M -netdev socket,id=net0,mcast=230.0.0.1:1234 -device e1000,netdev=net0,mac=52:54:00:12:34:04 -display cocoa -name "NEXUS NODE 4 (DELTA)" &

echo "🔥 SWARM CLUSTER ONLINE. WATCH THE GOSSIP PROTOCOL."
wait
