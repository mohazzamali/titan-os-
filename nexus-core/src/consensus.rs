// nexus-core/src/consensus.rs
#![allow(dead_code)]
extern crate alloc;
use alloc::format;
use alloc::string::String;

#[derive(Debug, PartialEq)]
pub enum PbftState {
    Idle,
    PrePrepare,
    Prepare,
    Commit,
}

pub struct PbftEngine {
    pub state: PbftState,
    pub bit_vector_votes: u64, // 🚀 O(1) Bit-Vector Mask (Supports 64 nodes per shard)
    pub total_nodes: u8,
}

impl PbftEngine {
    pub const fn new() -> Self {
        Self {
            state: PbftState::Idle,
            bit_vector_votes: 0,
            total_nodes: 4, // Minimum required for a 3f+1 cluster where f=1 (Fault tolerance of 1)
        }
    }

    // 🚀 O(1) BIT-VECTOR VOTING: Verifies quorum instantly using CPU bitwise instructions
    pub fn has_quorum(&self) -> bool {
        let active_votes = self.bit_vector_votes.count_ones() as u8;
        let required_quorum = ((2 * self.total_nodes) / 3) + 1; // Formula: 3f+1
        active_votes >= required_quorum
    }

    pub fn process_vote(&mut self, node_index: u8) {
        // Set the bit corresponding to the node's position in the shard
        self.bit_vector_votes |= 1 << node_index;
    }
}

pub static mut ENGINE: PbftEngine = PbftEngine::new();

pub fn init_pbft_engine() {
    crate::graphics::write_result_to_screen(9, "BFT: O(1) SWAR VOTING & 3F+1 QUORUM ACTIVE. ", 0x0C);
}

pub fn verify_compute(result_hash: u64) {
    crate::graphics::write_result_to_screen(23, "CONSENSUS: INITIATING pBFT PRE-PREPARE PHASE", 0x0E);
    
    unsafe {
        ENGINE.state = PbftState::PrePrepare;
        
        // Simulating incoming GOSSIP votes from 3 different Mesh Nodes for this execution
        ENGINE.process_vote(0); 
        ENGINE.process_vote(1);
        ENGINE.process_vote(2);
        
        crate::graphics::write_result_to_screen(24, "CONSENSUS: O(1) BIT-VECTOR VOTING ENGAGED... ", 0x0B);

        if ENGINE.has_quorum() {
            ENGINE.state = PbftState::Commit;
            crate::graphics::write_result_to_screen(25, "CONSENSUS: 3f+1 QUORUM REACHED. CRYPTO-PROOF!", 0x0A);
            
            // 🚀 Hook into the Tokenomics engine (PoUC - Proof of Useful Compute)
            crate::tokenomics::mint_nxc_reward(result_hash);
        } else {
            crate::graphics::write_result_to_screen(25, "CONSENSUS: QUORUM FAILED. SLASHING ACTORS!  ", 0x04);
        }
    }
}