#![allow(dead_code)]
use x86_64::registers::model_specific::{Efer, EferFlags, LStar, Star, SFMask};
use x86_64::registers::rflags::RFlags;
use x86_64::structures::gdt::SegmentSelector;
use x86_64::PrivilegeLevel;
use core::arch::global_asm;

pub fn init_syscalls() {
    let selectors = &crate::gdt::GDT.1;
    unsafe {
        Efer::update(|flags| flags.insert(EferFlags::SYSTEM_CALL_EXTENSIONS));
        
        // 🚀 Fixed the structure names to match gdt.rs
        let user_code_r3 = SegmentSelector::new(selectors.user_code.index(), PrivilegeLevel::Ring3);
        let user_data_r3 = SegmentSelector::new(selectors.user_data.index(), PrivilegeLevel::Ring3);

        Star::write(user_code_r3, user_data_r3, selectors.kernel_code, selectors.kernel_data).unwrap();
        LStar::write(x86_64::VirtAddr::new(syscall_entry as *const () as u64));
        SFMask::write(RFlags::INTERRUPT_FLAG); 
    }
}

#[no_mangle]
pub extern "C" fn handle_syscall_rust(sys_num: u64, _arg1: u64) {
    if sys_num == 99 {
        crate::graphics::write_result_to_screen(16, "SEC: SYSCALL 99 CAUGHT! ELEVATING TO RING-0.", 0x0B);
        // 🚀 Fixed function call name
        crate::wasm_engine::execute_ota_payload(&[]); 
    }
}

global_asm!(
    ".global syscall_entry",
    "syscall_entry:",
    "push rcx", "push r11", "push rbp", "push rbx",
    "call handle_syscall_rust",
    "pop rbx", "pop rbp", "pop r11", "pop rcx",
    "sysretq" 
);
extern "C" { fn syscall_entry(); }