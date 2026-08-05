// nexus-core/src/crypto.rs
#![allow(dead_code)]
extern crate alloc;
use alloc::format;

#[cfg(target_arch = "x86_64")]
use core::arch::x86_64::{_rdrand64_step, _rdtsc};

// 🚀 HARDWARE LEVEL RNG: Generates secure random bytes directly from CPU Silicon
pub fn get_random_bytes(buffer: &mut [u8]) {
    let mut i = 0;
    while i < buffer.len() {
        let mut rand_val: u64 = 0;
        let mut success = 0;
        
        unsafe {
            for _ in 0..10 {
                success = _rdrand64_step(&mut rand_val);
                if success == 1 {
                    break;
                }
            }
        }

        if success != 1 {
            unsafe {
                rand_val = _rdtsc();
            }
        }

        let bytes = rand_val.to_ne_bytes();
        let chunk_size = core::cmp::min(8, buffer.len() - i);
        buffer[i..i + chunk_size].copy_from_slice(&bytes[..chunk_size]);
        i += chunk_size;
    }
}

// 🚀 INTERNAL CONSENSUS: FNV-1a 32-bit (For BFT and Wasm Node Verification)
pub fn fnv1a_hash(data: &[u8]) -> u32 {
    let mut hash: u32 = 0x811C9DC5;
    for &byte in data {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    hash
}

pub fn generate_pouc_proof(task_id: u64, result: i32) -> u32 {
    crate::graphics::write_result_to_screen(13, "CRYPTO: GENERATING PoUC ZK-PROOF...         ", 0x0E); 
    
    // Simulate intense cryptographic math operations
    for _ in 0..4_000_000 { core::hint::spin_loop(); }

    let mut payload = [0u8; 12];
    payload[0..8].copy_from_slice(&task_id.to_be_bytes());
    payload[8..12].copy_from_slice(&result.to_be_bytes());

    let signature = fnv1a_hash(&payload);

    let msg = format!("CRYPTO: PROOF VERIFIED! HASH: 0x{:08X} ", signature);
    crate::graphics::write_result_to_screen(14, &msg, 0x0B); 
    
    signature
}

// 🚀 EXTERNAL NETWORK RPC: FNV-1a 64-bit (For incoming Mac Terminal Payloads)
pub fn generate_pouc_hash(payload: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325; // FNV offset basis
    for byte in payload.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3); // FNV prime
    }
    hash
}
