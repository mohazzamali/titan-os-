// nexus-core/src/syscall.rs
use x86_64::registers::model_specific::{Efer, EferFlags, LStar, Star, SFMask};
use x86_64::registers::rflags::RFlags;
use x86_64::structures::gdt::SegmentSelector;
use x86_64::PrivilegeLevel;
use core::arch::global_asm;

pub fn init_syscalls() {
    let selectors = &crate::gdt::GDT.1;
    unsafe {
        Efer::update(|flags| flags.insert(EferFlags::SYSTEM_CALL_EXTENSIONS));

        let user_code_r3 = SegmentSelector::new(selectors.user_code_selector.index(), PrivilegeLevel::Ring3);
        let user_data_r3 = SegmentSelector::new(selectors.user_data_selector.index(), PrivilegeLevel::Ring3);

        Star::write(user_code_r3, user_data_r3, selectors.code_selector, selectors.data_selector).unwrap();
        LStar::write(x86_64::VirtAddr::new(syscall_entry as *const () as u64));
        SFMask::write(RFlags::INTERRUPT_FLAG); 
    }
}

#[no_mangle]
pub extern "C" fn handle_syscall_rust(sys_num: u64, _arg1: u64) {
    if sys_num == 99 {
        crate::graphics::write_result_to_screen(16, "SEC: SYSCALL 99 CAUGHT! ELEVATING TO RING-0.", 0x0B); // Cyan
        // 🚀 ONLY NOW is it safe to execute the Wasm Hypervisor!
        crate::wasm_engine::execute_smart_contract("smart_contract.wasm");
    }
}

// Low-level assembly to handle the CPU transition safely
global_asm!(
    ".global syscall_entry",
    "syscall_entry:",
    "push rcx", // CPU saved Return RIP here
    "push r11", // CPU saved RFLAGS here
    "push rbp",
    "push rbx",

    "call handle_syscall_rust",

    "pop rbx",
    "pop rbp",
    "pop r11",
    "pop rcx",
    "sysretq" // Hardware instruction to jump back to Ring-3
);

extern "C" { fn syscall_entry(); }
