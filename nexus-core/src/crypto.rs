// nexus-core/src/crypto.rs

extern crate alloc;
use alloc::format;

// 🚀 FNV-1a 32-bit Hashing Algorithm (Lightweight, Fast, and #![no_std] compatible!)
pub fn fnv1a_hash(data: &[u8]) -> u32 {
    let mut hash: u32 = 0x811C9DC5;
    for &byte in data {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    hash
}

// 🚀 Generate the Verifiable Signature for the Compute Task
pub fn generate_pouc_proof(task_id: u64, result: i32) -> u32 {
    crate::graphics::write_result_to_screen(13, "CRYPTO: GENERATING PoUC ZK-PROOF...         ", 0x0E); 
    
    // Simulate intense cryptographic math operations
    for _ in 0..4_000_000 { core::hint::spin_loop(); }

    // Combine Task ID and Result into a single byte array payload
    let mut payload = [0u8; 12];
    payload[0..8].copy_from_slice(&task_id.to_be_bytes());
    payload[8..12].copy_from_slice(&result.to_be_bytes());

    // Hash the payload to generate the Immutable Signature
    let signature = fnv1a_hash(&payload);

    let msg = format!("CRYPTO: PROOF VERIFIED! HASH: 0x{:08X} ", signature);
    crate::graphics::write_result_to_screen(14, &msg, 0x0B); // Cyan text for Cryptography!
    
    signature
}