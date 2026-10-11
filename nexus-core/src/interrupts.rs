// nexus-core/src/interrupts.rs
#![allow(dead_code)]

use lazy_static::lazy_static;
use spin::Mutex;
use x86_64::structures::idt::{InterruptDescriptorTable, InterruptStackFrame, PageFaultErrorCode};
use pic8259::ChainedPics;
use core::sync::atomic::{AtomicBool, Ordering, AtomicU64, AtomicU8};

pub const PIC_1_OFFSET: u8 = 32;
pub const PIC_2_OFFSET: u8 = PIC_1_OFFSET + 8;
pub static PICS: Mutex<ChainedPics> = Mutex::new(unsafe { ChainedPics::new(PIC_1_OFFSET, PIC_2_OFFSET) });

pub static OS_TICK: AtomicU64 = AtomicU64::new(0);
pub static DESKTOP_MODE: AtomicBool = AtomicBool::new(false);

// 🚀 NEW: 100% Lock-Free Atomic Signal. (0 = Nothing, 1 = Sandbox, 2 = Boot)
pub static RUN_COMMAND: AtomicU8 = AtomicU8::new(0);

lazy_static! {
    static ref IDT: InterruptDescriptorTable = {
        let mut idt = InterruptDescriptorTable::new();
        idt.breakpoint.set_handler_fn(breakpoint_handler);
        idt.page_fault.set_handler_fn(page_fault_handler);
        idt.general_protection_fault.set_handler_fn(gpf_handler);
        
        unsafe { idt.double_fault.set_handler_fn(double_fault_handler); }
        
        idt[32].set_handler_fn(timer_interrupt_handler); 
        idt[33].set_handler_fn(keyboard_interrupt_handler); 
        idt[43].set_handler_fn(network_interrupt_handler); 
        idt
    };
}

// In nexus-core/src/interrupts.rs
pub fn init() {
    x86_64::instructions::interrupts::disable(); 
    IDT.load();
    unsafe { PICS.lock().initialize(); }
    unsafe {
        use x86_64::instructions::port::Port;
        let mut m = Port::<u8>::new(0x21); 
        let mut s = Port::<u8>::new(0xA1);
        
        // 🚀 MASTER STROKE: 0b1111_1111 masks (disables) ALL interrupts on both PICs
        m.write(0b1111_1111); 
        s.write(0b1111_1111); 
    }
    // Note: We leave interrupts disabled for maximum stability in polling mode
}

extern "x86-interrupt" fn breakpoint_handler(_sf: InterruptStackFrame) {}
extern "x86-interrupt" fn double_fault_handler(_sf: InterruptStackFrame, _ec: u64) -> ! { panic!("\n[FATAL] DOUBLE FAULT"); }
extern "x86-interrupt" fn page_fault_handler(_sf: InterruptStackFrame, _ec: PageFaultErrorCode) { loop { core::hint::spin_loop(); } }
extern "x86-interrupt" fn gpf_handler(_sf: InterruptStackFrame, _ec: u64) { loop { core::hint::spin_loop(); } }

extern "x86-interrupt" fn timer_interrupt_handler(_stack_frame: InterruptStackFrame) {
    OS_TICK.fetch_add(1, Ordering::Relaxed);
    unsafe { PICS.lock().notify_end_of_interrupt(32); }
}

// 🚀 ZERO MEMORY ALLOCATION KEYBOARD HANDLER
extern "x86-interrupt" fn keyboard_interrupt_handler(_stack_frame: InterruptStackFrame) {
    use x86_64::instructions::port::Port;
    let mut port = Port::<u8>::new(0x60);
    let scancode = unsafe { port.read() };
    
    // 's' Key (scancode 0x1F) -> Set signal to 1 (Sandbox)
    if scancode == 0x1F {
        RUN_COMMAND.store(1, Ordering::Relaxed);
    }
    // 'b' Key (scancode 0x30) -> Set signal to 2 (Boot)
    else if scancode == 0x30 {
        RUN_COMMAND.store(2, Ordering::Relaxed);
    }

    unsafe { PICS.lock().notify_end_of_interrupt(33); }
}

extern "x86-interrupt" fn network_interrupt_handler(_stack_frame: InterruptStackFrame) {
    crate::network::poll_network(); 
    crate::e1000::ack_interrupt();
    unsafe { PICS.lock().notify_end_of_interrupt(43); }
}