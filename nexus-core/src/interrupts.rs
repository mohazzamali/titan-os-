// nexus-core/src/interrupts.rs
#![allow(dead_code)]
extern crate alloc;

use x86_64::structures::idt::{InterruptDescriptorTable, InterruptStackFrame, PageFaultErrorCode};
use spin::Mutex;
use lazy_static::lazy_static;

pub const PIC_1_OFFSET: u8 = 32;
pub const PIC_2_OFFSET: u8 = PIC_1_OFFSET + 8;

#[derive(Debug, Clone, Copy)]
#[repr(u8)]
pub enum InterruptIndex {
    Timer = PIC_1_OFFSET,
    Keyboard, 
    E1000Network = PIC_2_OFFSET + 3,
    // 🚀 THE FIX: Mapping the Hard Disk Interrupts!
    AtaPrimary = PIC_2_OFFSET + 6,
    AtaSecondary = PIC_2_OFFSET + 7,
}

impl InterruptIndex {
    pub fn as_u8(self) -> u8 { self as u8 }
    pub fn as_usize(self) -> usize { usize::from(self.as_u8()) }
}

lazy_static! {
    static ref IDT: InterruptDescriptorTable = {
        let mut idt = InterruptDescriptorTable::new();
        
        idt.breakpoint.set_handler_fn(breakpoint_handler);
        unsafe {
            idt.double_fault
                .set_handler_fn(double_fault_handler)
                .set_stack_index(crate::gdt::DOUBLE_FAULT_IST_INDEX);
        }
        idt.page_fault.set_handler_fn(page_fault_handler);
        idt.general_protection_fault.set_handler_fn(general_protection_fault_handler);

        idt[InterruptIndex::Timer.as_usize()].set_handler_fn(timer_interrupt_handler);
        idt[InterruptIndex::E1000Network.as_usize()].set_handler_fn(e1000_interrupt_handler);
        idt[InterruptIndex::Keyboard.as_usize()].set_handler_fn(keyboard_interrupt_handler);
        
        // 🚀 THE FIX: Attaching the handlers
        idt[InterruptIndex::AtaPrimary.as_usize()].set_handler_fn(ata_primary_interrupt_handler);
        idt[InterruptIndex::AtaSecondary.as_usize()].set_handler_fn(ata_secondary_interrupt_handler);

        idt
    };
}

pub fn init_idt() { IDT.load(); }

extern "x86-interrupt" fn breakpoint_handler(_stack_frame: InterruptStackFrame) {}
extern "x86-interrupt" fn double_fault_handler(_stack_frame: InterruptStackFrame, _error_code: u64) -> ! { panic!("DOUBLE FAULT"); }
extern "x86-interrupt" fn general_protection_fault_handler(_stack_frame: InterruptStackFrame, _error_code: u64) { panic!("GP FAULT"); }

extern "x86-interrupt" fn page_fault_handler(_stack_frame: InterruptStackFrame, _error_code: PageFaultErrorCode) {
    use x86_64::registers::control::Cr2;
    let fault_addr = Cr2::read();
    let msg = alloc::format!("SEC: ILLEGAL ACCESS AT {:#X} BLOCKED! TASK KILLED.", fault_addr);
    let mut padded_msg = alloc::string::String::from(msg);
    while padded_msg.len() < 80 { padded_msg.push(' '); }
    crate::graphics::write_result_to_screen(24, &padded_msg, 0x0C); 
    loop { x86_64::instructions::hlt(); }
}

extern "x86-interrupt" fn timer_interrupt_handler(_stack_frame: InterruptStackFrame) {
    crate::network::TICK_COUNTER.fetch_add(1, core::sync::atomic::Ordering::Relaxed);
    unsafe { PICS.lock().notify_end_of_interrupt(InterruptIndex::Timer.as_u8()); }
}

extern "x86-interrupt" fn keyboard_interrupt_handler(_stack_frame: InterruptStackFrame) {
    use x86_64::instructions::port::Port;
    let mut port = Port::new(0x60);
    let _scancode: u8 = unsafe { port.read() };
    unsafe { PICS.lock().notify_end_of_interrupt(InterruptIndex::Keyboard.as_u8()); }
}

extern "x86-interrupt" fn e1000_interrupt_handler(_stack_frame: InterruptStackFrame) {
    crate::e1000::handle_hardware_interrupt();
    unsafe { PICS.lock().notify_end_of_interrupt(InterruptIndex::E1000Network.as_u8()); }
}

// 🚀 THE FIX: Acknowledge the hard drive so it doesn't cause a Double Fault
extern "x86-interrupt" fn ata_primary_interrupt_handler(_stack_frame: InterruptStackFrame) {
    unsafe { PICS.lock().notify_end_of_interrupt(InterruptIndex::AtaPrimary.as_u8()); }
}
extern "x86-interrupt" fn ata_secondary_interrupt_handler(_stack_frame: InterruptStackFrame) {
    unsafe { PICS.lock().notify_end_of_interrupt(InterruptIndex::AtaSecondary.as_u8()); }
}

use pic8259::ChainedPics;
pub static PICS: Mutex<ChainedPics> = Mutex::new(unsafe { ChainedPics::new(PIC_1_OFFSET, PIC_2_OFFSET) });

pub fn init_pics() {
    unsafe { PICS.lock().initialize(); }
    x86_64::instructions::interrupts::enable();
}