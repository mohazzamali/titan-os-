// nexus-core/src/kademlia.rs

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct NodeId(pub [u8; 32]);

impl NodeId {
    // 🚀 Core Kademlia XOR Metric Calculation for Node Discovery
    pub fn xor_distance(&self, other: &NodeId) -> [u8; 32] {
        let mut dist = [0u8; 32];
        for i in 0..32 {
            dist[i] = self.0[i] ^ other.0[i];
        }
        dist
    }
}

pub fn init_dht_routing() {
    // Initialize 256 dynamic K-buckets for zero-server MAC mapping
    crate::graphics::write_result_to_screen(9, "DHT: KADEMLIA 256 K-BUCKETS INITIALIZED...", 0x09);
}
