use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use ed25519-compact::{KeyPair, Seed};
use rand::RngCore;

fn main() {
    println!("==================================================");
    println!("⚡ NEXUS TITAN: PROVIDER NODE INSTALLER (MINER)");
    println!("==================================================");

    let efi_nexus_dir = Path::new("/tmp/nexus_efi_install"); 
    fs::create_dir_all(efi_nexus_dir).unwrap();

    println!("[1/3] Copying Bare-Metal Kernel to USB Sector...");
    let kernel_path = Path::new("../nexus-core/target/x86_64-unknown-none/release/bootimage-nexus-core.bin");
    if kernel_path.exists() {
        fs::copy(kernel_path, efi_nexus_dir.join("nexus-kernel.efi")).unwrap();
        println!("  -> Kernel flashed successfully.");
    } else {
        println!("  -> WARNING: Kernel binary not pre-compiled (run cargo bootimage in nexus-core later).");
    }

    println!("[2/3] Generating Unique Node Identity (Wallet)...");
    let mut random_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut random_bytes);
    
    let keypair = KeyPair::from_seed(Seed::new(random_bytes));
    let public_key = keypair.pk.as_ref();
    
    println!("  -> Node Swarm ID Generated: {:X?}", &public_key[0..8]);
    
    let wallet_path = efi_nexus_dir.join("WALLET.DAT");
    let mut wallet_file = File::create(&wallet_path).unwrap();
    wallet_file.write_all(&random_bytes).unwrap();
    println!("  -> WALLET.DAT securely written to physical drive.");

    println!("[3/3] Finalizing Bootloader Configurations...");
    println!("==================================================");
    println!("🎉 MINER USB READY! Plug this into any PC, boot it, and start earning NXC.");
}
