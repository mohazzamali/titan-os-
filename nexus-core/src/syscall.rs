// nexus-core/src/syscall.rs
#![allow(dead_code)]
use x86_64::registers::model_specific::{Efer, EferFlags, LStar, Star, SFMask};
use x86_64::registers::rflags::RFlags;
use x86_64::structures::gdt::SegmentSelector;
use x86_64::{PrivilegeLevel, VirtAddr};
use core::arch::global_asm;

pub fn init_syscalls() {
    let selectors = &crate::gdt::GDT.1;
    unsafe {
        // 1. Enable System Call Extensions in CPU
        Efer::update(|flags| flags.insert(EferFlags::SYSTEM_CALL_EXTENSIONS));
        
        // 2. Set Segments for Syscall (Ring-0) and Sysret (Ring-3)
        let user_code_r3 = SegmentSelector::new(selectors.user_code.index(), PrivilegeLevel::Ring3);
        let user_data_r3 = SegmentSelector::new(selectors.user_data.index(), PrivilegeLevel::Ring3);
        
        Star::write(user_code_r3, user_data_r3, selectors.kernel_code, selectors.kernel_data).unwrap();
        
        // 3. Point LSTAR to our Assembly Entry Stub
        LStar::write(VirtAddr::new(syscall_entry as *const () as u64));
        
        // 4. Mask Interrupts while in Syscall to prevent race conditions
        SFMask::write(RFlags::INTERRUPT_FLAG); 
    }
    crate::graphics::write_result_to_screen(12, "SEC: FAST SYSCALLS (MSR LSTAR) ARMED & READY. ", 0x0A);
}

// 🚀 THE SYSTEM CALL DISPATCHER (Called from Assembly)
#[no_mangle]
pub extern "C" fn handle_syscall_rust(sys_num: u64, arg1: u64, arg2: u64, arg3: u64) -> u64 {
    match sys_num {
        1 => {
            crate::graphics::write_result_to_screen(13, "SYS: [1] RING-3 REQUESTED COMPUTE EXECUTION.  ", 0x0B);
            // Example: arg1 could be pointer to WASM payload
            crate::consensus::verify_compute(0x811C9DC5, 100);
            1 // Success
        },
        99 => {
            crate::graphics::write_result_to_screen(13, "SYS: [99] RING-3 TRIGGERED NETWORK BROADCAST. ", 0x0E);
            crate::network::broadcast_gossip(arg1 as u32);
            1 // Success
        },
        _ => {
            crate::graphics::write_result_to_screen(14, "SEC: FATAL - INVALID SYSCALL ATTEMPT BLOCKED! ", 0x0C);
            0 // Fail / Blocked
        }
    }
}

// 🚀 BARE-METAL ASSEMBLY STUB: Saves Registers before jumping to Rust
global_asm!(
    ".global syscall_entry",
    "syscall_entry:",
    // Save User-Space Registers
    "push rcx", // Stores RIP for sysret
    "push r11", // Stores RFLAGS for sysret
    "push rbp", 
    "push rbx",
    "push r12",
    "push r13",
    "push r14",
    "push r15",

    // Move arguments for System V ABI (sys_num is in RAX)
    "mov rdi, rax", // sys_num
    "mov rsi, rdi", // arg1
    "mov rdx, rsi", // arg2
    "mov rcx, rdx", // arg3

    "call handle_syscall_rust", // Jump to our Rust brain!

    // Restore User-Space Registers
    "pop r15",
    "pop r14",
    "pop r13",
    "pop r12",
    "pop rbx",
    "pop rbp",
    "pop r11",
    "pop rcx",
    "sysretq" // Return to Ring-3 at light-speed!
);
extern "C" { fn syscall_entry(); }