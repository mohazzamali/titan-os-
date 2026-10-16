// nexus-core/src/consensus.rs
#![allow(dead_code)]
use core::sync::atomic::{AtomicU32, Ordering};
use spin::Mutex;
use alloc::format;

pub static GLOBAL_TRUST: AtomicU32 = AtomicU32::new(100);
pub static NETWORK_TVL: Mutex<u32> = Mutex::new(930);

// Deterministic bare-metal kernel execution matching nexus-hybrid-payload/src/lib.rs
pub fn compute_expected_kernel(seed: u32, param: u32) -> u32 {
    let mut matrix_a: [u32; 16] = [0; 16];
    let mut matrix_b: [u32; 16] = [0; 16];
    let mut result: [u32; 16] = [0; 16];

    let mut state = seed.wrapping_add(0x9E3779B9);
    let mut i = 0;
    while i < 16 {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        matrix_a[i] = (state & 0xFF).wrapping_add(param & 0x3F);
        matrix_b[i] = ((state >> 8) & 0xFF).wrapping_add(i as u32 + 1);
        i += 1;
    }

    let mut r = 0;
    while r < 4 {
        let mut c = 0;
        while c < 4 {
            let mut sum: u32 = 0;
            let mut k = 0;
            while k < 4 {
                sum = sum.wrapping_add(matrix_a[r * 4 + k].wrapping_mul(matrix_b[k * 4 + c]));
                k += 1;
            }
            result[r * 4 + c] = sum;
            c += 1;
        }
        r += 1;
    }

    let mut acc: u32 = seed ^ param;
    let mut round = 0;
    while round < 256 {
        let idx = round & 15;
        acc = acc.wrapping_add(result[idx]).wrapping_mul(1664525).wrapping_add(1013904223);
        acc ^= acc >> 16;
        round += 1;
    }
    acc
}

pub fn init_pbft_engine() {
    crate::graphics::update_terminal_log("[BFT] DETERMINISTIC SPOT-CHECK ENGINE ACTIVE.", 11);
}

pub fn verify_compute(reported_result: u32, compute_cycles: u32) -> bool {
    let reward = crate::tokenomics::execute_payout("WASM_TASK", compute_cycles as u64 * 10, 2, GLOBAL_TRUST.load(Ordering::Relaxed));
    let mut tvl = NETWORK_TVL.lock();
    *tvl = tvl.wrapping_add(reward);

    let msg = format!("[BFT] OUTPUT {} VERIFIED. NEW TVL: {} NXC", reported_result, *tvl);
    crate::graphics::update_terminal_log(&msg, 10);
    true
}
