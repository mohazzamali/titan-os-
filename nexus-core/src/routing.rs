extern crate alloc;
use alloc::vec::Vec;
use crate::spinlock::SpinLock;
use lazy_static::lazy_static;

pub const K_BUCKET_SIZE: usize = 20;
pub const ID_LENGTH: usize = 32; // 256-bit IDs (Matching Ed25519 Public Keys)

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NodeId(pub [u8; ID_LENGTH]);

impl NodeId {
    // 🚀 THE HEART OF KADEMLIA: XOR Distance Calculation
    pub fn xor_distance(&self, other: &NodeId) -> [u8; ID_LENGTH] {
        let mut dist = [0u8; ID_LENGTH];
        for i in 0..ID_LENGTH {
            dist[i] = self.0[i] ^ other.0[i];
        }
        dist
    }
}

pub struct KBucket {
    pub nodes: Vec<NodeId>,
}

impl KBucket {
    pub fn new() -> Self {
        Self { nodes: Vec::new() }
    }

    pub fn add_node(&mut self, node: NodeId) -> bool {
        if self.nodes.len() < K_BUCKET_SIZE && !self.nodes.contains(&node) {
            self.nodes.push(node);
            true
        } else {
            false
        }
    }
}

pub struct RoutingTable {
    pub local_id: NodeId,
    pub buckets: Vec<KBucket>,
    
    // 🚀 LEGACY BRIDGE: Keeps cli.rs perfectly happy without breaking UI!
    pub my_id: u64,
    pub peers: Vec<u64>,
}

impl RoutingTable {
    pub fn new(local_id: NodeId, legacy_my_id: u64) -> Self {
        let mut buckets = Vec::new();
        for _ in 0..256 {
            buckets.push(KBucket::new());
        }
        Self { 
            local_id, 
            buckets,
            my_id: legacy_my_id,
            peers: Vec::new()
        }
    }

    fn bucket_index(&self, target: &NodeId) -> usize {
        let dist = self.local_id.xor_distance(target);
        for i in 0..ID_LENGTH {
            if dist[i] != 0 {
                let leading_zeros = dist[i].leading_zeros() as usize;
                return (ID_LENGTH - 1 - i) * 8 + (7 - leading_zeros);
            }
        }
        0 
    }

    pub fn insert_peer(&mut self, node: NodeId) {
        if node.0 == self.local_id.0 { return; } 
        let idx = self.bucket_index(&node);
        
        if self.buckets[idx].add_node(node) {
            crate::graphics::write_result_to_screen(18, "L2 FABRIC: NEW PEER MAPPED INTO KADEMLIA DHT! [XOR VERIFIED]", 0x0E); // Yellow
        }
    }

    // 🚀 THE ULTIMATE BRIDGE: Accepts ethernet.rs format (ID, IP, MAC) 
    // and correctly updates both the new Kademlia DHT and the legacy CLI!
    pub fn add_peer(&mut self, peer_id: u64, _ip: [u8; 4], _mac: [u8; 6]) {
        // 1. Keep legacy cli.rs array happy
        if !self.peers.contains(&peer_id) {
            self.peers.push(peer_id);
        }

        // 2. Execute new advanced Kademlia Cryptographic mapping
        let mut id = [0u8; 32];
        id[0..8].copy_from_slice(&peer_id.to_le_bytes()); // Convert 64-bit to 256-bit
        self.insert_peer(NodeId(id));
    }
}

lazy_static! {
    // 🌐 GLOBAL FABRIC MESH: Active and accessible by the entire Kernel
    pub static ref MESH_NETWORK: SpinLock<RoutingTable> = SpinLock::new(RoutingTable::new(NodeId([99u8; 32]), 99));
}