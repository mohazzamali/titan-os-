// nexus-core/src/switch.rs

use core::arch::global_asm;

global_asm!(
    ".global perform_context_switch",
    "perform_context_switch:",
    
    "push rax", "push rbx", "push rcx", "push rdx",
    "push rsi", "push rdi", "push rbp",
    "push r8", "push r9", "push r10", "push r11",
    "push r12", "push r13", "push r14", "push r15",

    "mov rdi, rsp",       // Pass current stack pointer to Rust
    "and rsp, -16",       // 🚀 THE ALIGNMENT FIX: Force 16-byte boundary!
    "call schedule_next_task",
    "mov rsp, rax",       // Load new stack pointer returned by Rust

    "pop r15", "pop r14", "pop r13", "pop r12",
    "pop r11", "pop r10", "pop r9", "pop r8",
    "pop rbp", "pop rdi", "pop rsi", "pop rdx",
    "pop rcx", "pop rbx", "pop rax",

    "iretq"
);

extern "C" {
    pub fn perform_context_switch();
}