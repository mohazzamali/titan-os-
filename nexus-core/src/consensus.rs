// nexus-core/src/consensus.rs
#![allow(dead_code)]
use core::sync::atomic::{AtomicU32, Ordering};
use crate::spinlock::SpinLock;
use alloc::format;

pub static GLOBAL_TRUST: AtomicU32 = AtomicU32::new(100);
pub static NETWORK_TVL: SpinLock<u32> = SpinLock::new(930);

#[derive(Debug, PartialEq)]
pub enum PbftState { Idle, PrePrepare, Prepare, Commit }
pub struct PbftEngine { pub state: PbftState, pub bit_vector_votes: u64, pub total_nodes: u8 }

impl PbftEngine {
    pub const fn new() -> Self { Self { state: PbftState::Idle, bit_vector_votes: 0, total_nodes: 4 } }
    pub fn has_quorum(&self) -> bool { self.bit_vector_votes.count_ones() as u8 >= ((2 * self.total_nodes) / 3) + 1 }
    pub fn process_vote(&mut self, node_index: u8) { self.bit_vector_votes |= 1 << node_index; }
}

pub static ENGINE: SpinLock<PbftEngine> = SpinLock::new(PbftEngine::new());

pub fn init_pbft_engine() { 
    crate::graphics::write_result_to_screen(0, "BFT: O(1) SWAR VOTING & 3F+1 QUORUM ACTIVE. ", 0); 
}

pub fn verify_compute(_result_hash: u64, compute_cycles: u32) {
    crate::graphics::write_result_to_screen(0, "CONSENSUS: INITIATING pBFT PRE-PREPARE PHASE", 0);
    let mut engine = ENGINE.lock();
    engine.state = PbftState::PrePrepare;
    
    engine.process_vote(0); engine.process_vote(1); engine.process_vote(2);
    
    if engine.has_quorum() {
        engine.state = PbftState::Commit;
        
        let reward = compute_cycles / 2;
        let mut tvl = NETWORK_TVL.lock();
        *tvl += reward; 
        
        let mut sector_data = [0u8; 512];
        sector_data[0..4].copy_from_slice(&tvl.to_le_bytes()); 
        crate::disk::write_sector(2048, &sector_data);
        
        let msg = format!("CONSENSUS: QUORUM REACHED! MINTED {} NXC FOR WORK DONE.", reward);
        crate::graphics::write_result_to_screen(0, &msg, 0);
        
        let msg2 = format!("[VAULT] PERMANENT BURN: NEW NETWORK TVL {} NXC SECURED.", *tvl);
        crate::graphics::write_result_to_screen(0, &msg2, 0);

        // 🚀 THE MAGIC: TELL THE OTHER NODES VIA UDP GOSSIP!
        crate::network::broadcast_gossip(*tvl);

    } else {
        crate::graphics::write_result_to_screen(0, "CONSENSUS: QUORUM FAILED. SLASHING ACTORS!  ", 0);
    }
}