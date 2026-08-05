// nexus-core/src/identity.rs
#![allow(dead_code)]
extern crate alloc;

use alloc::vec::Vec;
use ed25519_compact::{KeyPair, Seed, Signature, PublicKey};
use spin::Mutex;
use lazy_static::lazy_static;

pub struct NodeIdentity {
    pub keypair: KeyPair,
    pub node_id: [u8; 32], // Public Key is the Swarm ID
}

impl NodeIdentity {
    pub fn generate() -> Self {
        crate::graphics::write_result_to_screen(12, "SEC: GENERATING ED25519 ZERO-TRUST IDENTITY...", 0x0E);
        
        // For our unikernel, we use a fixed deterministic seed to represent this specific Node.
        let seed = Seed::new([99u8; 32]); 
        let keypair = KeyPair::from_seed(seed);
        
        let mut node_id = [0u8; 32];
        node_id.copy_from_slice(keypair.pk.as_ref());
        
        crate::graphics::write_result_to_screen(13, "SEC: ZERO-TRUST NODE IDENTITY ESTABLISHED.      ", 0x0A);
        
        NodeIdentity { keypair, node_id }
    }

    // 🚀 SIGN THE PROOF-OF-USEFUL-COMPUTE (PoUC)
    pub fn sign_pouc(&self, task_id: u64, result: u32) -> Signature {
        let mut payload = Vec::new();
        payload.extend_from_slice(&task_id.to_le_bytes());
        payload.extend_from_slice(&result.to_le_bytes());
        self.keypair.sk.sign(&payload, None)
    }

    // 🚀 VERIFY INCOMING MESH PACKETS
    pub fn verify_signature(pub_key: &[u8], payload: &[u8], signature: &[u8]) -> bool {
        if let Ok(pk) = PublicKey::from_slice(pub_key) {
            if let Ok(sig) = Signature::from_slice(signature) {
                return pk.verify(payload, &sig).is_ok();
            }
        }
        false
    }
}

// Global state so the Fabric network can access the node's keys
lazy_static! {
    pub static ref NODE_IDENTITY: Mutex<Option<NodeIdentity>> = Mutex::new(None);
}

pub fn init_identity() {
    let identity = NodeIdentity::generate();
    *NODE_IDENTITY.lock() = Some(identity);
}