// nexus-core/src/usermode.rs
use x86_64::registers::model_specific::{Efer, EferFlags, LStar, Star, SFMask};
use x86_64::registers::rflags::RFlags;
use x86_64::VirtAddr;
use core::arch::naked_asm;

// 🚀 Hardware Syscall Entry Point (Fires when Ring-3 requests Kernel action)
#[unsafe(naked)]
pub extern "C" fn syscall_handler() {
    naked_asm!(
        // Syscall clobbers RCX and R11. We must save state manually.
        "push rcx",
        "push r11",
        "push rdi",
        "push rsi",
        
        // Dummy handler logic for now
        "mov al, 0x20", 
        
        "pop rsi",
        "pop rdi",
        "pop r11",
        "pop rcx",
        "sysretq" // 🚀 Return securely back to Ring-3
    );
}

// 🚀 Configuring Model Specific Registers for Fast Syscalls
pub fn init_syscall_hardware() {
    let selectors = &crate::gdt::GDT.1;

    unsafe {
        // Enable System Call Extensions in the CPU
        Efer::update(|efer| efer.insert(EferFlags::SYSTEM_CALL_EXTENSIONS));

        // Load the Star register with User and Kernel segment boundaries
        Star::write(
            selectors.user_code,
            selectors.user_data,
            selectors.kernel_code,
            selectors.kernel_data,
        ).unwrap();

        // Load LStar with the memory address of our Syscall Handler
        LStar::write(VirtAddr::new(syscall_handler as u64));

        // Mask interrupts when entering Ring-0 via syscall to prevent race conditions
        SFMask::write(RFlags::INTERRUPT_FLAG);
    }
    
    crate::graphics::write_result_to_screen(6, "SYS: CPU MSRs SECURED FOR RING-3 SYSCALLS...", 0x0A);
}
