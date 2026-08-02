// nexus-core/src/fabric.rs

extern crate alloc;

pub const RPC_PING: u8   = 0x01;
pub const RPC_PONG: u8   = 0x02;
pub const RPC_EXEC: u8   = 0x03; 
pub const RPC_RESULT: u8 = 0x04; 

pub fn broadcast_kademlia_ping() {
    let mut frame: [u8; 64] = [0; 64];
    frame[0..6].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
    frame[6..12].copy_from_slice(&[0x52, 0x54, 0x00, 0x12, 0x34, 0x56]);
    frame[12] = 0x88; frame[13] = 0xB5;
    frame[14] = RPC_PING;
    let my_id = [0x52, 0x54, 0x00, 0x12, 0x34, 0x56, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    frame[15..35].copy_from_slice(&my_id);
    crate::graphics::write_result_to_screen(23, "FABRIC: BROADCASTING KADEMLIA PING...    ", 0x0E);
    crate::e1000::send_packet(&frame);
}

pub fn send_kademlia_pong() {
    let mut frame: [u8; 64] = [0; 64];
    frame[0..6].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); 
    frame[6..12].copy_from_slice(&[0x52, 0x54, 0x00, 0x12, 0x34, 0x56]);
    frame[12] = 0x88; frame[13] = 0xB5;
    frame[14] = RPC_PONG;
    crate::e1000::send_packet(&frame);
}

pub fn deploy_compute_task(bytecode: &[u8]) {
    let mut frame: [u8; 128] = [0; 128]; 
    frame[0..6].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
    frame[6..12].copy_from_slice(&[0x52, 0x54, 0x00, 0x12, 0x34, 0x56]);
    frame[12] = 0x88; frame[13] = 0xB5;
    frame[14] = RPC_EXEC;
    
    for (i, &byte) in bytecode.iter().enumerate() {
        if 15 + i < 128 { frame[15 + i] = byte; }
    }
    
    crate::graphics::write_result_to_screen(23, "FABRIC: DEPLOYING TASK TO DISTRIBUTED MESH", 0x0E);
    crate::e1000::send_packet(&frame);
}

pub fn send_compute_result(result: u32) {
    let mut frame: [u8; 64] = [0; 64];
    frame[0..6].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); 
    frame[6..12].copy_from_slice(&[0x52, 0x54, 0x00, 0x12, 0x34, 0x56]);
    frame[12] = 0x88; frame[13] = 0xB5;
    frame[14] = RPC_RESULT;
    
    // 🚀 UPGRADED: 32-bit full payload serialization for large hashes
    frame[15] = (result & 0xFF) as u8;
    frame[16] = ((result >> 8) & 0xFF) as u8;
    frame[17] = ((result >> 16) & 0xFF) as u8;
    frame[18] = ((result >> 24) & 0xFF) as u8;
    
    crate::e1000::send_packet(&frame);
}

pub fn process_incoming_frame(frame: &[u8]) {
    if frame.len() < 60 { return; }
    if frame[12] == 0x88 && frame[13] == 0xB5 {
        let rpc_command = frame[14];
        
        match rpc_command {
            RPC_PING => {
                crate::graphics::write_result_to_screen(23, "FABRIC: [RX] KADEMLIA PING RECEIVED!     ", 0x0A);
                let mut node_id = crate::kademlia::NodeId([0; 20]);
                node_id.0.copy_from_slice(&frame[15..35]); 
                crate::kademlia::add_peer(crate::kademlia::PeerNode { id: node_id, ip: [192, 168, 1, frame[20]], port: 9999 });
                crate::graphics::write_result_to_screen(24, "FABRIC: [TX] SENDING PONG REPLY...       ", 0x0D);
                send_kademlia_pong();
            },
            RPC_PONG => {
                crate::graphics::write_result_to_screen(23, "FABRIC: [RX] KADEMLIA PONG RECEIVED!     ", 0x0B);
                crate::graphics::write_result_to_screen(24, "SYS: 2-WAY P2P HANDSHAKE COMPLETE.       ", 0x0A);
            },
            RPC_EXEC => {
                crate::graphics::write_result_to_screen(22, "FABRIC: [RX] INCOMING COMPUTE PAYLOAD!   ", 0x0D);
                let bytecode = &frame[15..30]; 
                if let Some(result) = crate::wasm_engine::execute_bytecode(bytecode) {
                    send_compute_result(result);
                }
            },
            RPC_RESULT => {
                // 🚀 UPGRADED: 32-bit deserialization
                let result = (frame[15] as u32) | ((frame[16] as u32) << 8) | ((frame[17] as u32) << 16) | ((frame[18] as u32) << 24);
                crate::graphics::write_result_to_screen(22, &alloc::format!("FABRIC: [RX] COMPUTATION RESULT: {}      ", result), 0x0A);
                
                // 🚀 THE CONSENSUS HOOK
                if crate::consensus::verify_zk_proof(result) {
                    crate::graphics::write_result_to_screen(23, "CONSENSUS: ZK-PROOF VERIFIED! TRUST +5%  ", 0x0A);
                } else {
                    crate::graphics::write_result_to_screen(23, "CONSENSUS: INVALID PROOF. NODE REJECTED. ", 0x04);
                }
            },
            _ => {}
        }
    }
}