extern crate alloc;

use alloc::vec::Vec;
use ed25519_compact::{KeyPair, Seed, Signature};

pub struct NodeIdentity {
    pub keypair: KeyPair,
}

impl NodeIdentity {
    pub fn generate() -> Self {
        // In a production hardware environment, this seed comes from a Hardware RNG chip.
        // For our unikernel, we use a fixed deterministic seed to represent this specific Node.
        let seed = Seed::new([99u8; 32]); 
        NodeIdentity {
            keypair: KeyPair::from_seed(seed),
        }
    }

    // 🚀 GENERATE THE PROOF-OF-USEFUL-COMPUTE (PoUC)
    pub fn sign_pouc(&self, task_id: u64, result: i32) -> Signature {
        let mut payload = Vec::new();
        
        // Serialize Task ID and Result into raw hardware bytes
        payload.extend_from_slice(&task_id.to_le_bytes());
        payload.extend_from_slice(&result.to_le_bytes());
        
        // Sign the raw bytes using Ed25519 Secret Key
        self.keypair.sk.sign(&payload, None)
    }
}