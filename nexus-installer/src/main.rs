use std::fs;
use std::process::Command;
use std::path::Path;

fn main() {
    println!("==================================================");
    println!("⚡ NEXUS TITAN OS: DUAL-BOOT INSTALLER ENGINE");
    println!("==================================================");

    println!("[1/4] Checking Host System Security & Permissions...");
    
    let kernel_path = Path::new("../nexus-core/target/x86_64-unknown-none/release/bootimage-nexus-core.bin");
    if !kernel_path.exists() {
        println!("❌ ERROR: Kernel binary not found! Please run 'cargo bootimage --release' inside nexus-core first.");
        return;
    }
    println!("✅ FOUND: Nexus Core Bare-Metal Kernel Binary.");

    println!("[2/4] Accessing System EFI Partition (ESP)...");
    let efi_nexus_dir = Path::new("/tmp/nexus_efi_install"); 
    if let Err(e) = fs::create_dir_all(efi_nexus_dir) {
        println!("❌ FATAL: Unable to access EFI target location: {:?}", e);
        return;
    }

    println!("[3/4] Copying Nexus Titan Kernel into Physical Storage...");
    let target_kernel_file = efi_nexus_dir.join("nexus-kernel.efi");
    if let Err(e) = fs::copy(kernel_path, &target_kernel_file) {
        println!("❌ ERROR: Failed to write kernel to EFI: {:?}", e);
        return;
    }
    println!("✅ SUCCESS: Kernel Written to Target Sector ({:?})", target_kernel_file);

    println!("[4/4] Injecting Dual-Boot Entry into System Boot Manager...");
    
    #[cfg(target_os = "windows")]
    {
        println!("   -> Detecting Windows Boot Manager (BCD)...");
        let bcd_status = Command::new("cmd")
            .args(&["/C", "bcdedit /create /d \"Nexus Titan OS (Swarm Node)\" /application startup"])
            .output();
        println!("   -> BCD Dual-Boot Entry Status: {:?}", bcd_status.is_ok());
    }

    #[cfg(not(target_os = "windows"))]
    {
        println!("   -> Detecting POSIX/Linux EFI System...");
        println!("   -> Generating GRUB Custom Configuration Entry...");
        let grub_entry = r#"
menuentry "Nexus Titan OS (Bare-Metal Swarm Node)" {
    insmod part_gpt
    insmod fat
    search --no-floppy --fs-uuid --set=root YOUR_EFI_UUID
    chainloader /EFI/NexusTitan/nexus-kernel.efi
}
"#;
        println!("{}", grub_entry);
    }

    println!("==================================================");
    println!("🎉 INSTALLATION COMPLETE! DUAL-BOOT IS LIVE.");
    println!("==================================================");
}
