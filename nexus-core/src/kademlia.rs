// nexus-core/src/kademlia.rs

extern crate alloc;
use alloc::vec::Vec;
use crate::spinlock::SpinLock;

// 160-bit Kademlia Node ID
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct NodeId(pub [u8; 20]);

#[derive(Clone)]
pub struct PeerNode {
    pub id: NodeId,
    pub ip: [u8; 4],
    pub port: u16,
}

// 🚀 THE SMP FIX: The Global Thread-Safe Routing Table
pub static ROUTING_TABLE: SpinLock<Vec<PeerNode>> = SpinLock::new(Vec::new());

// Mathematical XOR distance calculation
pub fn xor_distance(a: &NodeId, b: &NodeId) -> NodeId {
    let mut result = [0; 20];
    for i in 0..20 {
        result[i] = a.0[i] ^ b.0[i];
    }
    NodeId(result)
}

// Thread-safe peer insertion
pub fn add_peer(new_peer: PeerNode) {
    let mut table = ROUTING_TABLE.lock(); // Hardware lock engaged!
    
    let mut exists = false;
    for peer in table.iter() {
        if peer.id.0 == new_peer.id.0 {
            exists = true;
            break;
        }
    }
    
    if !exists {
        table.push(new_peer);
    }
    // Hardware lock automatically releases here when 'table' goes out of scope
}

// Thread-safe peer counter for the dashboard
pub fn get_peer_count() -> usize {
    let table = ROUTING_TABLE.lock();
    table.len()
}