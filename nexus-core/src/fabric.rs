#![allow(dead_code)]
extern crate alloc;
use alloc::format;
use alloc::string::String;

pub fn process_incoming_frame(frame: &[u8]) {
    if frame.len() < 15 { return; }
    
    let _is_broadcast = frame[0..6] == [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
    
    if frame[12] == 0x88 && frame[13] == 0xB5 {
        let cmd = frame[14];
        if cmd == 0x03 {
            crate::graphics::write_result_to_screen(22, "FABRIC: [RX] INCOMING COMPUTE PAYLOAD!          ", 0x0D);
            
            // Fixed function names based on compiler hints:
            crate::wasm_engine::execute_ota_payload(&[]);
            crate::consensus::verify_compute(0);
            
            let instructions_used = 85_400; 
            let memory_pages_used = 12;
            let node_trust = 9999; 
            
            crate::tokenomics::execute_payout("MATRIX", instructions_used, memory_pages_used, node_trust);
        }
    }
}

// Added to satisfy wasm_engine.rs dependency
pub fn send_compute_result(_node: u32, _res: u32) {}
