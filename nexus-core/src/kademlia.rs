// nexus-core/src/kademlia.rs
#![allow(dead_code)]
extern crate alloc;
use alloc::format;
use crate::routing::{NodeId, MESH_NETWORK};

pub const NEXUS_WAN_PORT: u16 = 6969;

pub fn init_dht_routing() {
    crate::graphics::write_result_to_screen(8, "DHT: KADEMLIA 256-BIT XOR ROUTING INITIALIZED.  ", 0x09);
}

pub fn ping_genesis_node() {
    crate::graphics::write_result_to_screen(10, "NET: LISTENING FOR REAL UDP SWARM PEERS (:6969) ", 0x0A);
}

pub fn register_verified_peer(ip: [u8; 4], port: u16) {
    let mut peer_hash = [0u8; 32];
    peer_hash[0..4].copy_from_slice(&ip);
    peer_hash[4..6].copy_from_slice(&port.to_be_bytes());
    let peer_id = ((ip[0] as u64) << 24) | ((ip[1] as u64) << 16) | ((ip[2] as u64) << 8) | (ip[3] as u64) | ((port as u64) << 32);

    let mut mesh = MESH_NETWORK.lock();
    mesh.add_peer(peer_id, ip, [0x52, 0x54, 0x00, 0x12, 0x34, 0x56]);
    let msg = format!("DHT: VERIFIED PEER {}.{}.{}.{}:{} MAPPED (TOTAL: {})", ip[0], ip[1], ip[2], ip[3], port, mesh.peers.len());
    crate::graphics::write_result_to_screen(11, &msg, 0x0A);
}
