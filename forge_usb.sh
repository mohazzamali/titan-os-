#!/bin/bash
echo "=================================================="
echo " 🦅 NEXUS TITAN: PHYSICAL USB IMAGE FORGER (V2)"
echo "=================================================="

IMAGE_NAME="nexus_titan_os.img"
TEMP_DMG="temp_nexus.dmg"

echo "[1] Cleaning up old mounts & files..."
rm -f $IMAGE_NAME $TEMP_DMG temp_nexus.cdr
hdiutil detach /Volumes/NEXUS_OS 2>/dev/null

echo "[2] Creating an Empty 64MB FAT32 Virtual Drive..."
hdiutil create -size 64m -fs "MS-DOS FAT32" -volname "NEXUS_OS" $TEMP_DMG > /dev/null

echo "[3] Mounting Virtual Drive to macOS..."
hdiutil attach $TEMP_DMG > /dev/null
sleep 2 # Giving macOS 2 seconds to register the drive

echo "[4] Injecting Bare-Metal Kernel into FAT32 Sectors..."
mkdir -p /Volumes/NEXUS_OS/EFI/BOOT
cp nexus-core/esp/EFI/BOOT/BOOTX64.EFI /Volumes/NEXUS_OS/EFI/BOOT/BOOTX64.EFI

echo "[5] Unmounting and Converting to Raw Bootable Image..."
hdiutil detach /Volumes/NEXUS_OS > /dev/null
hdiutil convert $TEMP_DMG -format UDTO -o temp_nexus.cdr > /dev/null

echo "[6] Finalizing .img extension..."
mv temp_nexus.cdr $IMAGE_NAME
rm -f $TEMP_DMG

echo "=================================================="
echo " ✅ SUCCESS: $IMAGE_NAME is Ready (Size: 64MB)!"
echo "=================================================="
echo " Flash it using BalenaEtcher and boot into the real Matrix!"
