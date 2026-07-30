// 🎯 BARE-METAL WEBASSEMBLY (WASM) INTERPRETER

pub const OP_I32_CONST: u8 = 0x41; // Push a 32-bit integer to the stack
pub const OP_I32_ADD: u8   = 0x6A; // Pop two numbers, add them, push result
pub const OP_I32_MUL: u8   = 0x6C; // Pop two numbers, multiply them, push result
pub const OP_END: u8       = 0x0B; // End of function/execution

pub fn validate_and_execute(bytecode: &[u8]) -> Option<i32> {
    let mut stack: [i32; 64] = [0; 64]; // Secure Fixed-Size Stack
    let mut sp = 0; // Stack Pointer
    let mut pc = 0; // Program Counter

    while pc < bytecode.len() {
        let op = bytecode[pc];
        pc += 1;

        match op {
            OP_I32_CONST => {
                if pc >= bytecode.len() { return None; } // Sandbox Protection: Out of bounds
                stack[sp] = bytecode[pc] as i32;
                sp += 1;
                pc += 1;
            },
            OP_I32_ADD => {
                if sp < 2 { return None; } // Sandbox Protection: Stack Underflow
                let b = stack[sp - 1];
                let a = stack[sp - 2];
                stack[sp - 2] = a.wrapping_add(b); // Prevent overflow crashes
                sp -= 1;
            },
            OP_I32_MUL => {
                if sp < 2 { return None; }
                let b = stack[sp - 1];
                let a = stack[sp - 2];
                stack[sp - 2] = a.wrapping_mul(b);
                sp -= 1;
            },
            OP_END => {
                if sp > 0 { return Some(stack[sp - 1]); }
                return Some(0);
            },
            _ => return None, // Invalid Opcode: Kill the execution safely
        }
    }
    None // Execution finished without END opcode
}