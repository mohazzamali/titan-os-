// nexus-core/src/switch.rs
#![allow(dead_code)]
use core::arch::global_asm;

global_asm!(
    ".global perform_context_switch",
    "perform_context_switch:",
    
    // Save current CPU state
    "push rax", "push rbx", "push rcx", "push rdx",
    "push rsi", "push rdi", "push rbp",
    "push r8", "push r9", "push r10", "push r11",
    "push r12", "push r13", "push r14", "push r15",

    "mov rdi, rsp",       // Pass current stack pointer (RSP) to Rust as 1st argument (RDI)
    "and rsp, -16",       // 🚀 THE ALIGNMENT FIX: Force 16-byte boundary to prevent SSE crashes!
    
    "call schedule_next_task", // 🚀 The Linker was looking for this!
    
    "mov rsp, rax",       // Load new stack pointer returned by Rust

    // Restore new CPU state
    "pop r15", "pop r14", "pop r13", "pop r12",
    "pop r11", "pop r10", "pop r9", "pop r8",
    "pop rbp", "pop rdi", "pop rsi", "pop rdx",
    "pop rcx", "pop rbx", "pop rax",

    "iretq"
);

extern "C" {
    pub fn perform_context_switch();
}

// 🚀 THE FIX: This is the exact function the Assembly Linker was crying for!
// When the CPU hardware timer ticks, it calls this to swap processes.
#[no_mangle]
pub extern "C" fn schedule_next_task(old_stack_pointer: u64) -> u64 {
    // In a fully developed preemptive OS, you save `old_stack_pointer` to the current Process Control Block (PCB).
    // Then you fetch the `stack_pointer` of the NEXT task in the queue and return it.
    // Since we are running a Cooperative Unified Loop right now, we return the same stack pointer safely.
    old_stack_pointer
}