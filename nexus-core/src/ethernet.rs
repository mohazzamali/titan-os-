use alloc::format;
use crate::nic_driver::transmit_raw_packet;
use crate::spinlock::SpinLock;
use core::fmt::Write;
use x86_64::instructions::port::Port;

pub static PRINT_LOCK: SpinLock<()> = SpinLock::new(());

struct SerialPort;
impl Write for SerialPort {
    fn write_str(&mut self, s: &str) -> core::fmt::Result {
        let mut port = Port::new(0x3F8); 
        for byte in s.bytes() { unsafe { port.write(byte); } }
        Ok(())
    }
}

pub fn process_rx_packet(packet: &[u8]) {
    if packet.len() < 14 { return; }
    let ethertype = (packet[12] as u16) << 8 | (packet[13] as u16);
    match ethertype {
        0x0806 => handle_arp(packet),  
        0x0800 => handle_ipv4(packet), 
        _ => {} 
    }
}

fn handle_arp(packet: &[u8]) {
    if packet.len() < 42 { return; }
    let opcode = (packet[20] as u16) << 8 | (packet[21] as u16);
    if opcode == 1 { 
        let mut sender_mac = [0u8; 6]; sender_mac.copy_from_slice(&packet[22..28]);
        let mut sender_ip = [0u8; 4]; sender_ip.copy_from_slice(&packet[28..32]);
        let mut target_ip = [0u8; 4]; target_ip.copy_from_slice(&packet[38..42]);

        if target_ip == [192, 168, 1, 100] || target_ip == [10, 0, 2, 15] {
            host_log("   📡 [ ARP ] Router Request Accepted. Sending MAC identity...");
            let my_mac = [0x52, 0x54, 0x00, 0x12, 0x34, 0x56];
            let mut reply = [0u8; 64]; 
            reply[0..6].copy_from_slice(&sender_mac);
            reply[6..12].copy_from_slice(&my_mac);
            reply[12..14].copy_from_slice(&[0x08, 0x06]);
            reply[14..20].copy_from_slice(&[0x00, 0x01, 0x08, 0x00, 0x06, 0x04]);
            reply[20..22].copy_from_slice(&[0x00, 0x02]); 
            reply[22..28].copy_from_slice(&my_mac);
            reply[28..32].copy_from_slice(&target_ip);
            reply[32..38].copy_from_slice(&sender_mac);
            reply[38..42].copy_from_slice(&sender_ip);
            transmit_raw_packet(&reply);
        }
    }
}

fn handle_ipv4(packet: &[u8]) {
    if packet.len() < 34 { return; }
    let protocol = packet[23];

    if protocol == 1 { 
        let icmp_type = packet[34];
        if icmp_type == 8 { 
            host_log("   ⚡ [ ICMP ] PING Received! Sending Echo Reply...");
            let mut reply = [0u8; 128]; 
            let len = packet.len();
            if len > 128 { return; }
            reply[0..len].copy_from_slice(&packet[0..len]);
            for i in 0..6 { reply[i] = packet[i+6]; reply[i+6] = packet[i]; }
            for i in 0..4 { reply[26+i] = packet[30+i]; reply[30+i] = packet[26+i]; }
            reply[34] = 0; reply[36] = 0; reply[37] = 0; 
            let mut sum: u32 = 0;
            for i in (34..len).step_by(2) {
                let word = (reply[i] as u32) << 8 | (reply[i+1] as u32);
                sum = sum.wrapping_add(word);
            }
            while (sum >> 16) > 0 { sum = (sum & 0xFFFF) + (sum >> 16); }
            let checksum = !(sum as u16);
            reply[36] = (checksum >> 8) as u8;
            reply[37] = (checksum & 0xFF) as u8;
            transmit_raw_packet(&reply[0..len]);
        }
    } 
    else if protocol == 17 { 
        let ip_header_len = (packet[14] & 0x0F) as usize * 4;
        let udp_header_start = 14 + ip_header_len;
        
        if packet.len() >= udp_header_start + 8 {
            let dst_port = (packet[udp_header_start + 2] as u16) << 8 | (packet[udp_header_start + 3] as u16);
            
            if dst_port == 7777 {
                let payload_start = udp_header_start + 8;
                
                // 🎯 THE NEW MAGIC: Cloud RPC (Remote Procedure Call) Engine
                if packet.len() >= payload_start + 6 && &packet[payload_start..payload_start+4] == b"CMPT" {
                    let num1 = packet[payload_start+4];
                    let num2 = packet[payload_start+5];
                    host_log(&format!("   ☁️ [ CLOUD RPC ] Remote Compute Task Received over Network: {} + {}", num1, num2));
                    
                    let wasm_payload = alloc::vec![
                        crate::wasm::OP_I32_CONST, num1,
                        crate::wasm::OP_I32_CONST, num2,
                        crate::wasm::OP_I32_ADD,
                        crate::wasm::OP_END
                    ];
                    crate::task::SCHEDULER.lock().spawn(wasm_payload, 0);
                }
                // Mesh Discovery Fallback
                else if packet.len() >= payload_start + 8 {
                    host_log("   📡 [ UDP ] P2P Mesh Handshake Received on Port 7777!");
                    let mut sender_mac = [0u8; 6]; sender_mac.copy_from_slice(&packet[6..12]);
                    let mut sender_ip = [0u8; 4]; sender_ip.copy_from_slice(&packet[26..30]);
                    let mut id_bytes = [0u8; 8]; id_bytes.copy_from_slice(&packet[payload_start..payload_start+8]);
                    crate::routing::MESH_NETWORK.lock().add_peer(u64::from_le_bytes(id_bytes), sender_ip, sender_mac);
                } else {
                    host_log(&format!("   🔍 [ RADAR ] Unknown UDP Packet Detected! Target Port: {}", dst_port));
                }
            }
        }
    }
}

pub fn host_log(msg: &str) {
    let _lock = PRINT_LOCK.lock(); 
    let mut serial = SerialPort;
    let _ = core::fmt::write(&mut serial, format_args!("{}\n", msg));
}
