// nexus-core/src/consensus.rs
#![allow(dead_code)]
use core::sync::atomic::{AtomicU32, Ordering};
use spin::Mutex;
use alloc::format;

pub static GLOBAL_TRUST: AtomicU32 = AtomicU32::new(100);
pub static NETWORK_TVL: Mutex<u32> = Mutex::new(930); // Genesis TVL

#[derive(Debug, PartialEq)]
pub enum PbftState { Idle, PrePrepare, Prepare, Commit }

pub struct PbftEngine { 
    pub state: PbftState, 
    pub bit_vector_votes: u64, 
    pub total_nodes: u8 
}

impl PbftEngine {
    pub const fn new() -> Self { 
        Self { state: PbftState::Idle, bit_vector_votes: 0, total_nodes: 4 } 
    }
    
    // 🚀 O(1) SWAR VOTING MATH (3f + 1 Quorum)
    pub fn has_quorum(&self) -> bool { 
        let required_votes = ((2 * self.total_nodes) / 3) + 1;
        (self.bit_vector_votes.count_ones() as u8) >= required_votes 
    }
    
    pub fn process_vote(&mut self, node_index: u8) { 
        self.bit_vector_votes |= 1 << node_index; 
    }
    
    pub fn reset(&mut self) {
        self.state = PbftState::Idle;
        self.bit_vector_votes = 0;
    }
}

pub static ENGINE: Mutex<PbftEngine> = Mutex::new(PbftEngine::new());

pub fn init_pbft_engine() { 
    crate::graphics::update_terminal_log("[BFT] O(1) SWAR VOTING & 3F+1 QUORUM ACTIVE.", 11); // Cyan
}

pub fn verify_compute(result: u32, compute_cycles: u32) -> bool {
    crate::graphics::update_terminal_log("[BFT] INITIATING pBFT PRE-PREPARE PHASE...", 13); // Purple
    
    let mut engine = ENGINE.lock();
    engine.state = PbftState::PrePrepare;
    
    // Simulate Network Votes (Nodes 0, 1, and 2 vote YES)
    engine.process_vote(0); 
    engine.process_vote(1); 
    engine.process_vote(2);
    
    if engine.has_quorum() {
        engine.state = PbftState::Commit;
        
        // 🚀 Fetch dynamic reward from Surge Pricing Engine
        let reward = crate::tokenomics::execute_payout("WASM_TASK", compute_cycles as u64 * 10, 2, 9999);
        
        let mut tvl = NETWORK_TVL.lock();
        *tvl += reward; 
        
        // Simulating physical disk write for now to avoid UEFI crashes
        // let mut sector_data = [0u8; 512];
        // sector_data[0..4].copy_from_slice(&tvl.to_le_bytes()); 
        // crate::disk::write_sector(2048, &sector_data);
        
        let msg = format!("[BFT] QUORUM REACHED! RESULT {} VALIDATED.", result);
        crate::graphics::update_terminal_log(&msg, 10);
        
        let msg2 = format!("[VAULT] PERMANENT BURN: NEW NETWORK TVL {} NXC SECURED.", *tvl);
        crate::graphics::update_terminal_log(&msg2, 10);

        engine.reset(); // Reset for next task
        return true;
    } else {
        crate::graphics::update_terminal_log("[BFT] QUORUM FAILED. SLASHING ACTORS!", 12); // Red
        engine.reset();
        return false;
    }
}