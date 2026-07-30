use alloc::vec::Vec;
use crate::network::get_mac_address;
use crate::println;

pub fn build_dhcp_discover() -> Vec<u8> {
    let my_mac = get_mac_address();
    let mut packet = Vec::new();
    
    // 1. ETHERNET HEADER
    packet.extend_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); 
    packet.extend_from_slice(&my_mac);
    packet.extend_from_slice(&[0x08, 0x00]);
    
    // 2. IPV4 HEADER (With Valid Checksum)
    let ip_header: [u8; 20] = [
        0x45, 0x00, 0x01, 0x48, 
        0x00, 0x00, 0x00, 0x00,
        0x40, 0x11, 0x79, 0xA6, // 🎯 ENTERPRISE FIX 1: Calculated IPv4 Checksum!
        0x00, 0x00, 0x00, 0x00, 
        0xFF, 0xFF, 0xFF, 0xFF  
    ];
    packet.extend_from_slice(&ip_header);
    
    // 3. UDP HEADER
    let udp_header: [u8; 8] = [
        0x00, 0x44, 0x00, 0x43, 
        0x01, 0x34, 0x00, 0x00  
    ];
    packet.extend_from_slice(&udp_header);
    
    // 4. DHCP PAYLOAD
    let mut dhcp = alloc::vec![0u8; 300];
    dhcp[0] = 0x01; dhcp[1] = 0x01; dhcp[2] = 0x06; 
    dhcp[4] = 0xAA; dhcp[5] = 0xBB; dhcp[6] = 0xCC; dhcp[7] = 0xDD; 
    
    // 🎯 ENTERPRISE FIX 2: Request Broadcast Reply (Fixes un-ARP'd Unicast drops)
    dhcp[10] = 0x80; dhcp[11] = 0x00; 

    dhcp[28..34].copy_from_slice(&my_mac);
    dhcp[236] = 0x63; dhcp[237] = 0x82; dhcp[238] = 0x53; dhcp[239] = 0x63;
    dhcp[240] = 53; dhcp[241] = 1; dhcp[242] = 1; 
    dhcp[243] = 255;
    
    packet.extend_from_slice(&dhcp);
    
    println!("\n🌍 [ NETWORK ] Assembled Enterprise DHCP Discover Packet.");
    packet
}
