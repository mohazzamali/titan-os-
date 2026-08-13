#![allow(dead_code)]
use alloc::vec::Vec;

pub fn build_dhcp_discover() -> Vec<u8> {
    // 🚀 Directly extracting MAC without circular dependencies
    let my_mac = [0x52, 0x54, 0x00, 0x12, 0x34, 0x56]; 
    let mut packet = Vec::new();
    
    packet.extend_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); 
    packet.extend_from_slice(&my_mac);
    packet.extend_from_slice(&[0x08, 0x00]);
    
    let ip_header: [u8; 20] = [ 0x45, 0x00, 0x01, 0x48, 0x00, 0x00, 0x00, 0x00, 0x40, 0x11, 0x79, 0xA6, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF ];
    packet.extend_from_slice(&ip_header);
    
    let udp_header: [u8; 8] = [ 0x00, 0x44, 0x00, 0x43, 0x01, 0x34, 0x00, 0x00 ];
    packet.extend_from_slice(&udp_header);
    
    let mut dhcp = alloc::vec![0u8; 300];
    dhcp[0] = 0x01; dhcp[1] = 0x01; dhcp[2] = 0x06; 
    dhcp[4] = 0xAA; dhcp[5] = 0xBB; dhcp[6] = 0xCC; dhcp[7] = 0xDD; 
    dhcp[10] = 0x80; dhcp[11] = 0x00; 
    dhcp[28..34].copy_from_slice(&my_mac);
    dhcp[236] = 0x63; dhcp[237] = 0x82; dhcp[238] = 0x53; dhcp[239] = 0x63;
    dhcp[240] = 53; dhcp[241] = 1; dhcp[242] = 1; dhcp[243] = 255;
    
    packet.extend_from_slice(&dhcp);
    crate::println!("\n🌍 [ NETWORK ] Assembled Enterprise DHCP Discover Packet.");
    packet
}