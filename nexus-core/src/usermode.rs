// nexus-core/src/usermode.rs
#![allow(dead_code)]

use core::arch::asm;

/// Transitions the CPU to Ring-3 (User Mode) safely using iretq
pub unsafe fn enter_usermode(entry_point: u64, user_stack_top: u64) -> ! {
    // Standard segment selectors for User Data and User Code in a 64-bit GDT
    // The '| 3' sets the Requested Privilege Level (RPL) to Ring-3
    let user_data = 0x20 | 3; 
    let user_code = 0x18 | 3; 

    // To drop to Ring-3, we fake an interrupt stack frame and call 'iretq'.
    // The CPU expects: SS, RSP, RFLAGS, CS, RIP on the stack.
    asm!(
        "push {0}",      // Push SS (User Data Segment)
        "push {1}",      // Push RSP (User Stack Top)
        "pushf",         // Push RFLAGS
        "pop rax",       
        "or rax, 0x200", // Enable interrupts in RFLAGS (Set IF bit)
        "push rax",      // Push modified RFLAGS back
        "push {2}",      // Push CS (User Code Segment)
        "push {3}",      // Push RIP (Entry Point)
        "iretq",         // Execute interrupt return, dropping to Ring-3
        in(reg) user_data,
        in(reg) user_stack_top,
        in(reg) user_code,
        in(reg) entry_point,
        options(noreturn) // Crucial: tells the compiler this block never returns
    );
}

/// The untrusted payload that runs inside the Ring-3 Sandbox.
/// It MUST NEVER RETURN naturally, otherwise it jumps to a garbage memory address.
pub extern "C" fn untrusted_wasm_runner() -> ! {
    
    // Yahan hum Ring-3 se Ring-0 (Kernel) ko system call bhejte hain
    // For example, triggering software interrupt 0x80 with syscall number 99
    unsafe {
        asm!(
            "mov rax, 99",
            "int 0x80",
            // Hum out("rax") nahi likh sakte kyunki loop aage jayega
        );
    }

    // 🚀 THE FIX: This infinite loop prevents the CPU from returning to a garbage address (Triple Fault)
    loop {
        core::hint::spin_loop(); 
    }
}