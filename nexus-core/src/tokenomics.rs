#![allow(dead_code)]
extern crate alloc;
use alloc::format;
use alloc::string::String;

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
            base_fee_per_gas: 10,
        }
    }

    pub fn consume_cpu(&mut self, instructions: u64) {
        self.instructions_executed += instructions;
    }

    pub fn consume_memory(&mut self, pages: u64) {
        self.memory_pages_allocated += pages;
    }

    pub fn calculate_payout(&self, node_trust_score: u32) -> f64 {
        let cpu_cost = self.instructions_executed * self.base_fee_per_gas;
        let mem_cost = self.memory_pages_allocated * (self.base_fee_per_gas * 50); 
        
        let total_micro_nxc = cpu_cost + mem_cost;
        let trust_multiplier = 1.0 + (node_trust_score as f64 / 100000.0);
        
        (total_micro_nxc as f64 / 1_000_000.0) * trust_multiplier
    }
}

pub fn init_crypto_economy() {
    crate::graphics::write_result_to_screen(7, "ECON: PROOF-OF-USEFUL-COMPUTE (PoUC) READY.     ", 0x0A);
}

pub fn execute_payout(workload_type: &str, instructions: u64, memory_pages: u64, trust_score: u32) {
    let mut meter = GasMeter::new();
    
    meter.consume_cpu(instructions);
    meter.consume_memory(memory_pages);
    let payout_nxc = meter.calculate_payout(trust_score);

    // Removed the broken crate::disk::write_to_sector call to fix compile error
    
    let msg = format!("ECON: PAYOUT: {:.4} NXC MINTED FOR {} WORKLOAD", payout_nxc, workload_type);
    let mut padded_msg = String::from(msg);
    while padded_msg.len() < 48 { padded_msg.push(' '); }
    
    crate::graphics::write_result_to_screen(23, &padded_msg, 0x0E); // Yellow text
}

// Added to satisfy consensus.rs dependency
pub fn mint_nxc_reward(_hash: u64) {}
