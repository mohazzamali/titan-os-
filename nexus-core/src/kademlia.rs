// nexus-core/src/kademlia.rs
#![allow(dead_code)]
extern crate alloc;
use alloc::vec::Vec;

pub const K_BUCKET_SIZE: usize = 20;
pub const ID_LENGTH: usize = 32; // 256-bit Ed25519 Public Key Node IDs

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NodeId(pub [u8; ID_LENGTH]);

impl NodeId {
    // 🚀 THE XOR METRIC: d(x,y) = x ⊕ y
    pub fn xor_distance(&self, other: &NodeId) -> [u8; ID_LENGTH] {
        let mut dist = [0u8; ID_LENGTH];
        for i in 0..ID_LENGTH {
            dist[i] = self.0[i] ^ other.0[i];
        }
        dist
    }

    // Determine the bucket index based on the leading zeros of the XOR distance
    pub fn bucket_index(&self, other: &NodeId) -> usize {
        let dist = self.xor_distance(other);
        for i in 0..ID_LENGTH {
            if dist[i] != 0 {
                let leading_zeros = dist[i].leading_zeros() as usize;
                return (ID_LENGTH - 1 - i) * 8 + (7 - leading_zeros);
            }
        }
        0
    }
}

pub struct KBucket {
    pub nodes: Vec<NodeId>,
}

impl KBucket {
    pub const fn new() -> Self {
        Self { nodes: Vec::new() }
    }

    // Add node or refresh position if it already exists (LRU behavior)
    pub fn insert_node(&mut self, node: NodeId) -> bool {
        if let Some(pos) = self.nodes.iter().position(|&n| n == node) {
            self.nodes.remove(pos);
            self.nodes.push(node);
            true
        } else if self.nodes.len() < K_BUCKET_SIZE {
            self.nodes.push(node);
            true
        } else {
            false // Bucket is full; ping least-seen node before eviction
        }
    }
}

pub struct KademliaRoutingTable {
    pub local_id: NodeId,
    pub buckets: [KBucket; 256],
}

impl KademliaRoutingTable {
    pub fn new(local_id: NodeId) -> Self {
        // Create an array of 256 empty K-Buckets
        const EMPTY_BUCKET: KBucket = KBucket::new();
        Self {
            local_id,
            buckets: [EMPTY_BUCKET; 256],
        }
    }

    pub fn add_peer(&mut self, peer_id: NodeId) {
        if peer_id == self.local_id { return; }
        let idx = self.local_id.bucket_index(&peer_id);
        if self.buckets[idx].insert_node(peer_id) {
            crate::graphics::write_result_to_screen(
                18, 
                "DHT: PEER MAPPED INTO K-BUCKET VIA XOR METRIC.  ", 
                0x0A
            );
        }
    }
}

pub fn init_dht_routing() {
    crate::graphics::write_result_to_screen(10, "DHT: KADEMLIA 256 K-BUCKETS INITIALIZED...    ", 0x09);
}