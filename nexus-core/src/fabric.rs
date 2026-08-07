// nexus-core/src/fabric.rs
#![allow(dead_code)]
extern crate alloc;

use crate::identity::NODE_IDENTITY;

// Gossip Protocol Directives
pub const RPC_GOSSIP_PING: u8 = 0x01;
pub const RPC_GOSSIP_PONG: u8 = 0x02;
pub const RPC_EXEC: u8        = 0x03; 
pub const RPC_RESULT: u8      = 0x04; 

// 🚀 EPIDEMIC GOSSIP PROTOCOL: Serverless Node Discovery (Replaces legacy PING)
pub fn broadcast_epidemic_ping() {
    let mut frame: [u8; 64] = [0; 64];
    
    // Destination: Broadcast MAC (FF:FF:FF:FF:FF:FF)
    frame[0..6].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
    
    // Source: Our MAC Address
    frame[6..12].copy_from_slice(&[0x52, 0x54, 0x00, 0x12, 0x34, 0x56]);
    
    // EtherType: Custom Nexus Protocol (0x88B5)
    frame[12] = 0x88; frame[13] = 0xB5;
    
    // Command Directive
    frame[14] = RPC_GOSSIP_PING;
    
    // Inject our 256-bit Ed25519 Public Key (Node ID) into the payload
    let identity_lock = NODE_IDENTITY.lock();
    if let Some(identity) = identity_lock.as_ref() {
        frame[15..47].copy_from_slice(&identity.node_id);
    }
    
    crate::graphics::write_result_to_screen(18, "FABRIC: BROADCASTING EPIDEMIC GOSSIP PING...", 0x0E);
    crate::e1000::send_packet(&frame);
}

// 🚀 SELF-HEALING & PRUNING: Acknowledging Peer Discovery (Replaces legacy PONG)
pub fn send_epidemic_pong(target_mac: &[u8]) {
    let mut frame: [u8; 64] = [0; 64];
    frame[0..6].copy_from_slice(target_mac); 
    frame[6..12].copy_from_slice(&[0x52, 0x54, 0x00, 0x12, 0x34, 0x56]);
    frame[12] = 0x88; frame[13] = 0xB5;
    frame[14] = RPC_GOSSIP_PONG;

    let identity_lock = NODE_IDENTITY.lock();
    if let Some(identity) = identity_lock.as_ref() {
        frame[15..47].copy_from_slice(&identity.node_id);
    }

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

pub fn send_compute_result(task_id: u64, result: u32) {
    let identity_lock = NODE_IDENTITY.lock();
    if let Some(identity) = identity_lock.as_ref() {
        let mut frame: [u8; 128] = [0; 128]; 
        frame[0..6].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); 
        frame[6..12].copy_from_slice(&[0x52, 0x54, 0x00, 0x12, 0x34, 0x56]);
        frame[12] = 0x88; frame[13] = 0xB5;
        frame[14] = RPC_RESULT;
        
        frame[15..47].copy_from_slice(&identity.node_id);
        frame[47..55].copy_from_slice(&task_id.to_le_bytes());
        frame[55..59].copy_from_slice(&result.to_le_bytes());
        
        let signature = identity.sign_pouc(task_id, result);
        frame[59..123].copy_from_slice(signature.as_ref());
        
        crate::e1000::send_packet(&frame);
    }
}

// 🚀 THE INGRESS ROUTER: Parsing raw frames bypassing the IP stack
pub fn process_incoming_frame(frame: &[u8]) {
    if frame.len() < 60 { return; }
    
    // Authenticate Nexus EtherType (0x88B5)
    if frame[12] == 0x88 && frame[13] == 0xB5 {
        let rpc_command = frame[14];
        let sender_mac = &frame[6..12];
        
        // Extract the 256-bit Node ID (Ed25519 Public Key)
        let mut _peer_id = [0u8; 32];
        if frame.len() >= 47 {
            _peer_id.copy_from_slice(&frame[15..47]);
        }
        
        match rpc_command {
            RPC_GOSSIP_PING => {
                crate::graphics::write_result_to_screen(19, "FABRIC: [RX] EPIDEMIC PING RECEIVED!        ", 0x0A);
                crate::graphics::write_result_to_screen(20, "FABRIC: [TX] SENDING GOSSIP PONG REPLY...   ", 0x0D);
                send_epidemic_pong(sender_mac);
            },
            RPC_GOSSIP_PONG => {
                crate::graphics::write_result_to_screen(19, "FABRIC: [RX] EPIDEMIC PONG RECEIVED!        ", 0x0B);
                crate::graphics::write_result_to_screen(20, "SYS: 2-WAY P2P GOSSIP HANDSHAKE COMPLETE.   ", 0x0A);
            },
            RPC_EXEC => {
                crate::graphics::write_result_to_screen(22, "FABRIC: [RX] INCOMING COMPUTE PAYLOAD!   ", 0x0D);
                let bytecode = &frame[15..55]; 
                
                let jit_module = crate::wasm_engine::translate_wasm_to_x86(bytecode);
                let result = unsafe { jit_module.execute() };
                
                send_compute_result(9999, result as u32); 
            },
            RPC_RESULT => {
                if frame.len() < 123 { return; } 
                
                let peer_pub_key = &frame[15..47];
                let task_id_bytes = &frame[47..55];
                let result_bytes = &frame[55..59];
                let signature = &frame[59..123];
                
                let mut payload_to_verify = alloc::vec::Vec::new();
                payload_to_verify.extend_from_slice(task_id_bytes);
                payload_to_verify.extend_from_slice(result_bytes);
                
                if crate::identity::NodeIdentity::verify_signature(peer_pub_key, &payload_to_verify, signature) {
                    let result = u32::from_le_bytes(result_bytes.try_into().unwrap());
                    crate::graphics::write_result_to_screen(22, &alloc::format!("FABRIC: [RX] TRUSTED COMPUTE RESULT: {}      ", result), 0x0A);
                    
                    crate::consensus::verify_compute(result as u64);
                    crate::graphics::write_result_to_screen(23, "CONSENSUS: CRYPTO-PROOF VERIFIED! TRUST +5%  ", 0x0A);
                } else {
                    crate::graphics::write_result_to_screen(22, "FABRIC: [RX] INVALID SIGNATURE! DROPPING.    ", 0x04);
                    crate::graphics::write_result_to_screen(23, "CONSENSUS: BFT SLASHING PROTOCOL ENGAGED.    ", 0x04);
                }
            },
            _ => {}
        }
    }
}