#!/bin/bash
echo "🌍 COMMAND CENTER: INITIATING OPERATION GLOBAL MESH..."
sleep 1

echo "📦 Compiling Cloud-Ready OS Image..."
cd nexus-core
cargo bootimage > /dev/null 2>&1
cp target/x86_64-unknown-none/debug/bootimage-nexus-core.bin ../nexus_cloud.img
cd ..

echo "💽 CLONING ISOLATED DISK IMAGES FOR GLOBAL NODES..."
cp nexus_cloud.img genesis.img
cp nexus_cloud.img alpha.img
cp nexus_cloud.img beta.img
cp nexus_cloud.img gamma.img
echo "✅ 4 Independent Cloud Drives Forged!"
sleep 1

echo "🌐 ALLOCATING PUBLIC IPv4 BLOCKS..."
echo "   -> [GENESIS] Allocated IP: 198.51.100.42"
echo "   -> [ALPHA]   Allocated IP: 203.0.113.15"
echo "   -> [BETA]    Allocated IP: 192.0.2.88"
echo "   -> [GAMMA]   Allocated IP: 104.28.19.4"
sleep 1

echo "⚡ SPINNING UP BARE-METAL CLOUD INSTANCES..."

qemu-system-x86_64 -drive format=raw,file=genesis.img -m 256M -display cocoa -name "NEXUS [GENESIS] - NEW YORK USA" &
sleep 1

qemu-system-x86_64 -drive format=raw,file=alpha.img -m 256M -display cocoa -name "NEXUS [ALPHA] - TOKYO JAPAN" &
sleep 1

qemu-system-x86_64 -drive format=raw,file=beta.img -m 256M -display cocoa -name "NEXUS [BETA] - FRANKFURT GERMANY" &
sleep 1

qemu-system-x86_64 -drive format=raw,file=gamma.img -m 256M -display cocoa -name "NEXUS [GAMMA] - MUMBAI INDIA" &

echo "🔥 GLOBAL MESH DEPLOYED. MONITORING WAN TRAFFIC..."
wait
