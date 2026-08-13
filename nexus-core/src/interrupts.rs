// nexus-core/src/interrupts.rs
#![allow(dead_code)]

use lazy_static::lazy_static;
use spin::Mutex;
use x86_64::structures::idt::{InterruptDescriptorTable, InterruptStackFrame, PageFaultErrorCode};
use pic8259::ChainedPics;
use pc_keyboard::{layouts, DecodedKey, HandleControl, Keyboard, ScancodeSet1};
use core::sync::atomic::{AtomicBool, Ordering, AtomicU64};

pub const PIC_1_OFFSET: u8 = 32;
pub const PIC_2_OFFSET: u8 = PIC_1_OFFSET + 8;
pub static PICS: Mutex<ChainedPics> = Mutex::new(unsafe { ChainedPics::new(PIC_1_OFFSET, PIC_2_OFFSET) });

pub static OS_TICK: AtomicU64 = AtomicU64::new(0);
pub static DESKTOP_MODE: AtomicBool = AtomicBool::new(false);
pub static COMMAND_READY: AtomicBool = AtomicBool::new(false);

lazy_static! {
    pub static ref COMMAND_BUFFER: Mutex<alloc::string::String> = Mutex::new(alloc::string::String::new());
    static ref KEYBOARD: Mutex<Keyboard<layouts::Us104Key, ScancodeSet1>> = Mutex::new(Keyboard::new(layouts::Us104Key, ScancodeSet1, HandleControl::Ignore));
    static ref IDT: InterruptDescriptorTable = {
        let mut idt = InterruptDescriptorTable::new();
        idt.breakpoint.set_handler_fn(breakpoint_handler);
        idt.page_fault.set_handler_fn(page_fault_handler);
        idt.general_protection_fault.set_handler_fn(gpf_handler);
        idt.double_fault.set_handler_fn(double_fault_handler);
        
        idt[32].set_handler_fn(timer_interrupt_handler); 
        idt[33].set_handler_fn(keyboard_interrupt_handler); 
        idt[44].set_handler_fn(mouse_interrupt_handler); 
        idt[43].set_handler_fn(network_interrupt_handler); // 🚀 THE NIC INTERRUPT CATCHER
        idt
    };
}

pub fn init() {
    IDT.load();
    unsafe { PICS.lock().initialize(); }
    unsafe {
        use x86_64::instructions::port::Port;
        let mut m = Port::<u8>::new(0x21); let mut s = Port::<u8>::new(0xA1);
        m.write(0b1111_1000); s.write(0b1110_1111);
    }
    x86_64::instructions::interrupts::enable();
}

extern "x86-interrupt" fn breakpoint_handler(_sf: InterruptStackFrame) {}
extern "x86-interrupt" fn double_fault_handler(_sf: InterruptStackFrame, _ec: u64) -> ! { panic!("\n[FATAL] DOUBLE FAULT"); }
extern "x86-interrupt" fn page_fault_handler(_sf: InterruptStackFrame, _ec: PageFaultErrorCode) { loop { core::hint::spin_loop(); } }
extern "x86-interrupt" fn gpf_handler(_sf: InterruptStackFrame, _ec: u64) { loop { core::hint::spin_loop(); } }

extern "x86-interrupt" fn timer_interrupt_handler(_stack_frame: InterruptStackFrame) {
    OS_TICK.fetch_add(1, Ordering::Relaxed);
    unsafe { PICS.lock().notify_end_of_interrupt(32); }
}

extern "x86-interrupt" fn mouse_interrupt_handler(_stack_frame: InterruptStackFrame) {
    crate::mouse::handle_interrupt();
    unsafe { PICS.lock().notify_end_of_interrupt(44); } 
}

extern "x86-interrupt" fn keyboard_interrupt_handler(_stack_frame: InterruptStackFrame) {
    use x86_64::instructions::port::Port;
    let byte = unsafe { Port::<u8>::new(0x60).read() };
    let mut key_char = None;
    {
        let mut keyboard = KEYBOARD.lock();
        if let Ok(Some(ev)) = keyboard.add_byte(byte) {
            if let Some(DecodedKey::Unicode(c)) = keyboard.process_keyevent(ev) { key_char = Some(c); }
        }
    }
    if let Some(c) = key_char {
        if c == '\n' {
            if !DESKTOP_MODE.load(Ordering::Relaxed) { crate::println!(); }
            COMMAND_READY.store(true, Ordering::Relaxed);
        } else if c == '\x08' {
            let mut buf = COMMAND_BUFFER.lock();
            if buf.pop().is_some() {
                if !DESKTOP_MODE.load(Ordering::Relaxed) {
                    if let Some(t) = crate::TERMINAL.lock().as_mut() { t.backspace(); }
                } else {
                    let msg = alloc::format!("> {}_ ", *buf);
                    crate::graphics::update_terminal_log(&msg, 14);
                }
            }
        } else {
            let mut buf = COMMAND_BUFFER.lock();
            buf.push(c);
            if !DESKTOP_MODE.load(Ordering::Relaxed) {
                crate::print!("{}", c);
            } else {
                let msg = alloc::format!("> {}_ ", *buf);
                crate::graphics::update_terminal_log(&msg, 14);
            }
        }
    }
    unsafe { PICS.lock().notify_end_of_interrupt(33); }
}

// 🚀 ZERO-LATENCY NETWORK HANDLER: Executes only when silicon receives a packet!
extern "x86-interrupt" fn network_interrupt_handler(_stack_frame: InterruptStackFrame) {
    crate::network::poll_network(); 
    crate::e1000::ack_interrupt();
    unsafe { PICS.lock().notify_end_of_interrupt(43); }
}