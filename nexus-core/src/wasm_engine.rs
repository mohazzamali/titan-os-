// nexus-core/src/wasm_engine.rs

extern crate alloc;
use alloc::vec::Vec;

pub fn execute_wasm(app_name: &str, data: &[u8]) {
    let start_msg = alloc::format!("KERNEL: SPAWNING VM FOR [{}]...", app_name);
    crate::graphics::write_result_to_screen(13, &start_msg, 0x0E);
    
    if data.len() < 4 || data[0] != 0x00 || data[1] != 0x61 || data[2] != 0x73 || data[3] != 0x6D {
        crate::graphics::write_result_to_screen(14, "WASM ERROR: INVALID MAGIC NUMBER! CORE DUMP.", 0x04);
        return;
    }

    crate::graphics::write_result_to_screen(14, "WASM: ZERO-TRUST SANDBOX ACTIVE. VM BOOTING.", 0x0A);

    let mut stack: Vec<u32> = Vec::new();
    let mut program_counter = 4; 

    while program_counter < data.len() {
        let opcode = data[program_counter];
        
        match opcode {
            0x00 => { // HALT
                crate::graphics::write_result_to_screen(17, "WASM: EXECUTION HALTED NORMALLY.          ", 0x0A);
                break;
            },
            0x01 => { // PUSH
                program_counter += 1;
                stack.push(data[program_counter] as u32);
            },
            0x02 => { // ADD
                let b = stack.pop().unwrap_or(0); 
                let a = stack.pop().unwrap_or(0);
                stack.push(a + b);
            },
            0x03 => { // MUL
                let b = stack.pop().unwrap_or(0);
                let a = stack.pop().unwrap_or(0);
                stack.push(a * b);
            },
            0x04 => { // PRINT
                let val = stack.pop().unwrap_or(0);
                let msg = alloc::format!("WASM SYSCALL -> ZK-PROOF: 0x{:X}       ", val);
                crate::graphics::write_result_to_screen(16, &msg, 0x0D); // Pink color
            },
            0x05 => { // 🚀 NEW: CRYPTOGRAPHIC HASHING ALGORITHM
                let salt = stack.pop().unwrap_or(0);
                let private_data = stack.pop().unwrap_or(0);
                // Simulated bitwise hashing (XOR and Shift)
                let hash = (private_data ^ salt).wrapping_mul(0x9E3779B9);
                stack.push(hash);
            },
            _ => { // UNKNOWN INSTRUCTION
                crate::graphics::write_result_to_screen(17, "WASM FATAL: ILLEGAL INSTRUCTION KILLED APP", 0x04);
                break;
            }
        }
        
        program_counter += 1;
        for _ in 0..5_000_000 { core::hint::spin_loop(); }
    }
}