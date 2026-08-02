// nexus-core/src/graphics.rs

extern crate alloc;
use core::ptr;
use crate::spinlock::SpinLock;

// 🚀 THE DOUBLE BUFFER: 80x25x2 = 4000 bytes in RAM (Off-Screen)
pub static mut OFF_SCREEN_BUFFER: [u8; 4000] = [0; 4000];

// 🚀 THE TRAFFIC POLICE: Thread safety for 4 Cores
pub static DISPLAY_LOCK: SpinLock<()> = SpinLock::new(());

const VGA_WIDTH: usize = 80;
const VGA_HEIGHT: usize = 25;

pub fn write_result_to_screen(row: usize, text: &str, color: u8) {
    let _guard = DISPLAY_LOCK.lock(); 
    
    if row >= VGA_HEIGHT { return; }
    
    let vga = unsafe { OFF_SCREEN_BUFFER.as_mut_ptr() };
    let mut col = 0;
    
    // 1. Write the new text
    for byte in text.bytes() {
        if col >= VGA_WIDTH { break; }
        let offset = (row * VGA_WIDTH + col) * 2;
        unsafe {
            ptr::write_volatile(vga.add(offset), byte);
            ptr::write_volatile(vga.add(offset + 1), color);
        }
        col += 1;
    }
    
    // 2. 🚀 THE FIX: Sweep the rest of the row with blank spaces to kill ghost text!
    while col < VGA_WIDTH {
        let offset = (row * VGA_WIDTH + col) * 2;
        unsafe {
            ptr::write_volatile(vga.add(offset), b' ');
            ptr::write_volatile(vga.add(offset + 1), 0x00); // Black background
        }
        col += 1;
    }
    
    // 3. Flush to monitor instantly
    let hardware_vga = 0xb8000 as *mut u8;
    unsafe {
        core::ptr::copy_nonoverlapping(OFF_SCREEN_BUFFER.as_ptr(), hardware_vga, 4000);
    }
}

pub fn flush_to_monitor() {
    let _guard = DISPLAY_LOCK.lock();
    let hardware_vga = 0xb8000 as *mut u8;
    unsafe {
        core::ptr::copy_nonoverlapping(OFF_SCREEN_BUFFER.as_ptr(), hardware_vga, 4000);
    }
}