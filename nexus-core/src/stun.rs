use crate::println;

// 🎯 STUN Packet Structure (20 Bytes Header)
pub fn create_binding_request() -> [u8; 20] {
    let mut packet = [0u8; 20];
    
    // 1. Message Type: Binding Request (0x0001)
    packet[0] = 0x00; 
    packet[1] = 0x01; 
    
    // 2. Message Length: 0 (No attributes for a basic request)
    packet[2] = 0x00; 
    packet[3] = 0x00; 
    
    // 3. Magic Cookie: 0x2112A442 (Mandatory WebRTC standard)
    packet[4] = 0x21; 
    packet[5] = 0x12; 
    packet[6] = 0xA4; 
    packet[7] = 0x42;
    
    // 4. Transaction ID (12 unique bytes to identify the response)
    let transaction_id: [u8; 12] = [
        0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 
        0x11, 0x22, 0x33, 0x44, 0x55, 0x66
    ];
    packet[8..20].copy_from_slice(&transaction_id);
    
    println!("\n📡 [ WebRTC ] Assembling STUN Binding Request (NAT Traversal Init)...");
    packet
}
