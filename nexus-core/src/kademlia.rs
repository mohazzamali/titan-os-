#![allow(dead_code)]
extern crate alloc;
use alloc::format;
use alloc::string::String;

// 🚀 THE GENESIS NODE: Public IP for Initial Global Discovery
pub const GENESIS_BOOTSTRAP_IP: [u8; 4] = [198, 51, 100, 42]; 
pub const NEXUS_WAN_PORT: u16 = 8899;

pub struct KademliaNode {
    pub ip: [u8; 4],
    pub port: u16,
    pub node_id: [u8; 32], 
}

pub fn init_dht_routing() {
    crate::graphics::write_result_to_screen(8, "DHT: KADEMLIA WAN ROUTING INITIALIZED.          ", 0x09);
    crate::graphics::write_result_to_screen(9, "NET: SWITCHING FROM MULTICAST TO UNICAST UDP.   ", 0x0B);
}

pub fn ping_genesis_node() {
    let msg = format!("NET: PINGING GENESIS NODE AT {}.{}.{}.{}...", 
        GENESIS_BOOTSTRAP_IP[0], GENESIS_BOOTSTRAP_IP[1], 
        GENESIS_BOOTSTRAP_IP[2], GENESIS_BOOTSTRAP_IP[3]);
        
    let mut padded_msg = String::from(msg);
    while padded_msg.len() < 48 { padded_msg.push(' '); }
    
    crate::graphics::write_result_to_screen(10, &padded_msg, 0x0E);
    
    // Simulating WAN Latency & Handshake
    let mut delay = 0;
    while delay < 5000000 { delay += 1; } 
    
    crate::graphics::write_result_to_screen(11, "NET: GENESIS HANDSHAKE OK. DOWNLOADING PEERS... ", 0x0A);
}
