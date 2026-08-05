// nexus-core/src/interrupts.rs
#![allow(dead_code)]

use x86_64::structures::idt::{InterruptDescriptorTable, InterruptStackFrame, PageFaultErrorCode};
use spin::Mutex;
use lazy_static::lazy_static;

pub const PIC_1_OFFSET: u8 = 32;
pub const PIC_2_OFFSET: u8 = PIC_1_OFFSET + 8;

#[derive(Debug, Clone, Copy)]
#[repr(u8)]
pub enum InterruptIndex {
    Timer = PIC_1_OFFSET,
    Keyboard, // 🚀 IRQ 1: The PS/2 Keyboard Interrupt
    E1000Network = PIC_2_OFFSET + 3,
}

impl InterruptIndex {
    pub fn as_u8(self) -> u8 { self as u8 }
    pub fn as_usize(self) -> usize { usize::from(self.as_u8()) }
}

lazy_static! {
    static ref IDT: InterruptDescriptorTable = {
        let mut idt = InterruptDescriptorTable::new();
        
        // Exceptions
        idt.breakpoint.set_handler_fn(breakpoint_handler);
        unsafe {
            idt.double_fault
                .set_handler_fn(double_fault_handler)
                .set_stack_index(crate::gdt::DOUBLE_FAULT_IST_INDEX);
        }
        idt.page_fault.set_handler_fn(page_fault_handler);
        idt.general_protection_fault.set_handler_fn(general_protection_fault_handler);

        // Hardware IRQs
        idt[InterruptIndex::Timer.as_usize()].set_handler_fn(timer_interrupt_handler);
        idt[InterruptIndex::E1000Network.as_usize()].set_handler_fn(e1000_interrupt_handler);
        
        // 🚀 THE REAL FIX: Linking the Keyboard Handler to the CPU
        idt[InterruptIndex::Keyboard.as_usize()].set_handler_fn(keyboard_interrupt_handler);

        idt
    };
}

pub fn init_idt() { IDT.load(); }

// --- CPU Exception Handlers ---
extern "x86-interrupt" fn breakpoint_handler(_stack_frame: InterruptStackFrame) {}
extern "x86-interrupt" fn double_fault_handler(_stack_frame: InterruptStackFrame, _error_code: u64) -> ! { panic!("DOUBLE FAULT"); }
extern "x86-interrupt" fn page_fault_handler(_stack_frame: InterruptStackFrame, _error_code: PageFaultErrorCode) { panic!("PAGE FAULT"); }
extern "x86-interrupt" fn general_protection_fault_handler(_stack_frame: InterruptStackFrame, _error_code: u64) { panic!("GP FAULT"); }

// --- Hardware IRQ Handlers ---
extern "x86-interrupt" fn timer_interrupt_handler(_stack_frame: InterruptStackFrame) {
    crate::network::TICK_COUNTER.fetch_add(1, core::sync::atomic::Ordering::Relaxed);
    unsafe { PICS.lock().notify_end_of_interrupt(InterruptIndex::Timer.as_u8()); }
}

// 🚀 THE NEW NO-SHORTCUT KEYBOARD DRIVER
extern "x86-interrupt" fn keyboard_interrupt_handler(_stack_frame: InterruptStackFrame) {
    use x86_64::instructions::port::Port;
    
    // Read the keystroke from the physical PS/2 port to clear the hardware buffer
    let mut port = Port::new(0x60);
    let _scancode: u8 = unsafe { port.read() };
    
    // Acknowledge the interrupt to the PIC so it doesn't freeze the OS!
    unsafe {
        PICS.lock().notify_end_of_interrupt(InterruptIndex::Keyboard.as_u8());
    }
}

extern "x86-interrupt" fn e1000_interrupt_handler(_stack_frame: InterruptStackFrame) {
    crate::e1000::handle_hardware_interrupt();
    unsafe { PICS.lock().notify_end_of_interrupt(InterruptIndex::E1000Network.as_u8()); }
}

// --- Programmable Interrupt Controller (8259 PIC) ---
use pic8259::ChainedPics;
pub static PICS: Mutex<ChainedPics> = Mutex::new(unsafe { ChainedPics::new(PIC_1_OFFSET, PIC_2_OFFSET) });

pub fn init_pics() {
    unsafe { PICS.lock().initialize(); }
    x86_64::instructions::interrupts::enable();
}
