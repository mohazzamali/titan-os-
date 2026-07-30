// nexus-core/src/interrupts.rs

use x86_64::structures::idt::{InterruptDescriptorTable, InterruptStackFrame};
use lazy_static::lazy_static;
use pic8259::ChainedPics;
use spin::Mutex;
extern crate alloc;

pub const PIC_1_OFFSET: u8 = 32;
pub const PIC_2_OFFSET: u8 = PIC_1_OFFSET + 8;

pub static PICS: Mutex<ChainedPics> = Mutex::new(unsafe { ChainedPics::new(PIC_1_OFFSET, PIC_2_OFFSET) });

#[derive(Debug, Clone, Copy)]
#[repr(u8)]
pub enum InterruptIndex { Timer = PIC_1_OFFSET, Keyboard, Mouse = PIC_2_OFFSET + 4 }

impl InterruptIndex {
    fn as_u8(self) -> u8 { self as u8 }
    fn as_usize(self) -> usize { usize::from(self.as_u8()) }
}

lazy_static! {
    static ref IDT: InterruptDescriptorTable = {
        let mut idt = InterruptDescriptorTable::new();
        idt.breakpoint.set_handler_fn(breakpoint_handler);
        idt.double_fault.set_handler_fn(double_fault_handler); 
        
        // 🚀 THE MAGIC HOOK: Assembly Context Switcher (Tasks Alpha/Beta)
        unsafe {
            idt[InterruptIndex::Timer.as_usize()]
                .set_handler_fn(core::mem::transmute(crate::switch::perform_context_switch as *const ()));
        }
        
        idt[InterruptIndex::Keyboard.as_usize()].set_handler_fn(keyboard_interrupt_handler);
        idt[InterruptIndex::Mouse.as_usize()].set_handler_fn(mouse_interrupt_handler);
        idt
    };
}

pub fn init_idt() { IDT.load(); }

extern "x86-interrupt" fn breakpoint_handler(_stack_frame: InterruptStackFrame) {
    crate::graphics::write_result_to_screen(22, "EXCEPTION: BREAKPOINT DETECTED", 0x0C);
}

extern "x86-interrupt" fn double_fault_handler(_stack_frame: InterruptStackFrame, _error_code: u64) -> ! {
    panic!("EXCEPTION: DOUBLE FAULT! SYSTEM HALTED.");
}

// 🚀 THE NEW, SINGLE KEYBOARD HANDLER (Routing to the Shell)
extern "x86-interrupt" fn keyboard_interrupt_handler(_stack_frame: InterruptStackFrame) {
    crate::keyboard::read_scancode_from_hardware();
    unsafe { PICS.lock().notify_end_of_interrupt(InterruptIndex::Keyboard.as_u8()); }
}

// 🐭 MOUSE HANDLER REMAINS ACTIVE
extern "x86-interrupt" fn mouse_interrupt_handler(_stack_frame: InterruptStackFrame) {
    use x86_64::instructions::port::Port;
    let mut port = Port::new(0x60);
    let _packet: u8 = unsafe { port.read() };
    unsafe { PICS.lock().notify_end_of_interrupt(InterruptIndex::Mouse.as_u8()); }
}