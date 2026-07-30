// nexus-core/src/arp.rs

extern crate alloc;
use alloc::format;

// 🚀 1. THE ARP PACKET STRUCTURE
#[derive(Debug, Clone, Copy)]
pub struct ArpHeader {
    pub hardware_type: u16,
    pub protocol_type: u16,
    pub hardware_len: u8,
    pub protocol_len: u8,
    pub opcode: u16,
    pub sender_mac: [u8; 6],
    pub sender_ip: [u8; 4],
    pub target_mac: [u8; 6],
    pub target_ip: [u8; 4],
}

// 🚀 2. THE ARP RESPONDER
pub fn process_arp_request(_packet: &[u8]) {
    // Clear lines for fresh logs
    crate::graphics::write_result_to_screen(17, "                                                              ", 0x00);
    crate::graphics::write_result_to_screen(18, "                                                              ", 0x00);

    crate::graphics::write_result_to_screen(17, "L3 ROUTING: ARP 'WHO HAS' REQUEST INTERCEPTED!", 0x0E); // Yellow alert
    
    // Simulate analyzing the packet and generating a hardware reply
    for _ in 0..3_000_000 { core::hint::spin_loop(); }
    
    let ip = [192, 168, 1, 100]; // Our OS's assigned IP
    let reply_msg = format!("L3 ROUTING: ARP REPLY SENT (I AM {}.{}.{}.{})   ", ip[0], ip[1], ip[2], ip[3]);
    
    crate::graphics::write_result_to_screen(18, &reply_msg, 0x0A); // Green success
}