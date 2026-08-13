// nexus-core/src/scheduler.rs
#![allow(dead_code)]

use core::sync::atomic::Ordering;
use crate::interrupts::OS_TICK;

static mut LAST_PROCESSED_TICK: u64 = 0;

pub fn tick() {
    let current_tick = OS_TICK.load(Ordering::Relaxed);
    unsafe {
        if current_tick > LAST_PROCESSED_TICK {
            
            // 🚀 FAST AI MATRIX: Now triggers every 5,000 ticks instead of 50,000
            if current_tick % 5000 == 0 {
                crate::gnn::execute_dream_cycle();
            }

            LAST_PROCESSED_TICK = current_tick;
        }
    }
}