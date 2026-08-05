#!/bin/bash
echo "=================================================="
echo "🚀 BUILDING NEXUS TITAN HYBRID OS (ISO & DUAL-BOOT)"
echo "=================================================="

# 1. Build the release kernel binary
cd nexus-core
cargo bootimage --release

# 2. Prepare ISO Workspace
mkdir -p target/iso_root/boot/grub

# 3. Copy bootimage to ISO root
cp target/x86_64-unknown-none/release/bootimage-nexus-core.bin target/iso_root/boot/nexus-kernel.bin

# 4. Generate Dual-Boot GRUB Configuration
cat << 'GRUBEOF' > target/iso_root/boot/grub/grub.cfg
set timeout=5
set default=0

menuentry "Nexus Titan OS v1.0 (Bare-Metal Swarm Node)" {
    multiboot2 /boot/nexus-kernel.bin
    boot
}

menuentry "Reboot to Primary OS (Windows / Linux)" {
    reboot
}
GRUBEOF

echo "=================================================="
echo "✅ HYBRID KERNEL READY AT:"
echo "   nexus-core/target/x86_64-unknown-none/release/bootimage-nexus-core.bin"
echo "=================================================="
