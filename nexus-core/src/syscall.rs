// nexus-core/src/syscall.rs

use x86_64::registers::model_specific::{Efer, EferFlags, LStar, Star, SFMask};
use x86_64::registers::rflags::RFlags;
use x86_64::structures::gdt::SegmentSelector; // 🚀 Imported explicitly
use x86_64::PrivilegeLevel;
use core::arch::global_asm;
extern crate alloc;

pub fn init_syscalls() {
    let selectors = &crate::gdt::GDT.1;
    unsafe {
        Efer::update(|flags| flags.insert(EferFlags::SYSTEM_CALL_EXTENSIONS));

        // 🚀 THE RPL FIX: Create new selectors using the correct index and Ring3 privilege
        let user_code_r3 = SegmentSelector::new(selectors.user_code.index(), PrivilegeLevel::Ring3);
        let user_data_r3 = SegmentSelector::new(selectors.user_data.index(), PrivilegeLevel::Ring3);

        Star::write(
            user_code_r3,
            user_data_r3,
            selectors.kernel_code,
            selectors.kernel_data,
        ).unwrap();

        LStar::write(x86_64::VirtAddr::new(syscall_entry as u64));
        SFMask::write(RFlags::INTERRUPT_FLAG); // Disable interrupts inside syscall
    }
}

#[no_mangle]
pub extern "C" fn handle_syscall_rust(sys_num: u64, arg1: u64) {
    if sys_num == 99 {
        let msg = alloc::format!("🛡️ SYSCALL 99: APP REQUESTED CPU TIME [{}] ", arg1);
        crate::graphics::write_result_to_screen(20, &msg, 0x0D); // Pink
    }
}

global_asm!(
    ".global syscall_entry",
    "syscall_entry:",
    "push rcx", // CPU saved return address here
    "push r11", // CPU saved RFLAGS here
    "push rbp",
    "push rbx",

    "call handle_syscall_rust",

    "pop rbx",
    "pop rbp",
    "pop r11",
    "pop rcx",
    
    // The Page Fault Bypass: Safely jump back to Kernel Thread
    "push r11",
    "popfq",    
    "jmp rcx"   
);

extern "C" {
    fn syscall_entry();
}