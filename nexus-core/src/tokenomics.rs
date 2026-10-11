// nexus-core/src/tokenomics.rs
#![allow(dead_code)]
extern crate alloc;
use alloc::format;
use alloc::string::String;
use core::sync::atomic::{AtomicU32, Ordering};

// 🚀 GLOBAL NETWORK STATE FOR PRICING
pub static ACTIVE_NODES: AtomicU32 = AtomicU32::new(1); // Self
pub static PENDING_TASKS: AtomicU32 = AtomicU32::new(0);

pub struct GasMeter {
    instructions_executed: u64,
    memory_pages_allocated: u64,
    base_fee_per_gas: u64,
}

impl GasMeter {
    pub fn new() -> Self {
        Self {
            instructions_executed: 0,
            memory_pages_allocated: 0,
            base_fee_per_gas: 10, // Base rate
        }
    }

    pub fn consume_cpu(&mut self, instructions: u64) {
        self.instructions_executed += instructions;
    }

    pub fn consume_memory(&mut self, pages: u64) {
        self.memory_pages_allocated += pages;
    }

    // 🚀 THE SURGE PRICING ALGORITHM (Integer Math)
    pub fn calculate_payout(&self, node_trust_score: u32) -> u64 {
        let active_nodes = ACTIVE_NODES.load(Ordering::Relaxed) as u64;
        let pending_tasks = PENDING_TASKS.load(Ordering::Relaxed) as u64;

        // Simplified Surge Multiplier using Integer Math
        let mut surge_multiplier = 1;
        if active_nodes > 0 && pending_tasks > active_nodes {
            let load_ratio = pending_tasks / active_nodes;
            surge_multiplier = 1 + load_ratio;
            if surge_multiplier > 5 { surge_multiplier = 5; } 
        }

        let cpu_cost = self.instructions_executed * self.base_fee_per_gas;
        let mem_cost = self.memory_pages_allocated * (self.base_fee_per_gas * 50); 
        
        let raw_cost = cpu_cost + mem_cost;
        let surged_cost = raw_cost * surge_multiplier;

        // Trust Bonus: High reputation nodes earn a slight premium
        let trust_multiplier = 1 + (node_trust_score as u64 / 100);
        
        surged_cost * trust_multiplier
    }
}

pub fn init_crypto_economy() {
    crate::graphics::update_terminal_log("[ECON] PROOF-OF-USEFUL-COMPUTE (PoUC) READY.", 10); // Green
    crate::graphics::update_terminal_log("[ECON] SURGE PRICING MULTIPLIER ACTIVATED.", 11); // Cyan
}

pub fn execute_payout(workload_type: &str, instructions: u64, memory_pages: u64, trust_score: u32) -> u32 {
    let mut meter = GasMeter::new();
    
    meter.consume_cpu(instructions);
    meter.consume_memory(memory_pages);
    
    let payout = meter.calculate_payout(trust_score);
    let payout_u32 = payout as u32;

    let msg = format!("[ECON] SURGE PAYOUT: {} NXC MINTED FOR {}", payout_u32, workload_type);
    crate::graphics::update_terminal_log(&msg, 14); // Yellow
    
    payout_u32
}

pub fn mint_nxc_reward(_hash: u64) {}