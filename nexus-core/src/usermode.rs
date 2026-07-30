use crate::gdt;
use crate::println;

// 🎯 THE FIX 1: Allocate a REAL 4KB Stack in RAM for User Mode
static mut USER_STACK: [u8; 4096] = [0; 4096];

pub unsafe fn enter_user_mode() -> ! {
    // Point RSP to the top of our newly allocated real memory stack
    let user_stack = core::ptr::addr_of!(USER_STACK) as u64 + 4096; 
    
    let ss = gdt::GDT.1.user_data.0 as u64;
    let cs = gdt::GDT.1.user_code.0 as u64;
    
    // 🎯 THE FIX 2: Disable Hardware Interrupts in Ring 3 (0x002 instead of 0x202)
    // Yeh APIC timer ko Ring 3 mein CPU crash karne se rokega
    let rflags = 0x002u64; 
    
    let rip = user_task as *const () as u64;

    println!("\n[ KERNEL ] Jumping into Ring 3 (User Space)...");

    core::arch::asm!(
        "push rax", "push rcx", "push rdx", "push r15", "push rdi", "iretq",
        in("rax") ss, in("rcx") user_stack, in("rdx") rflags, in("r15") cs, in("rdi") rip,
        options(noreturn)
    );
}

#[no_mangle]
pub extern "C" fn user_task() -> ! {
    // 🎯 WE ARE IN RING 3! 
    // Firing a System Call to knock on the Kernel's door.
    unsafe {
        core::arch::asm!(
            "syscall",
            out("rcx") _, 
            out("r11") _, 
        );
    }
    
    // Mission Accomplished. Rest here safely.
    loop { core::hint::spin_loop(); }
}
