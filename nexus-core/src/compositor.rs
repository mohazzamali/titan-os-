// nexus-core/src/compositor.rs

use crate::spinlock::SpinLock;

// 80 columns * 25 rows * 2 bytes (character + color) = 4000 bytes in RAM
pub static OFF_SCREEN_BUFFER: SpinLock<[u8; 4000]> = SpinLock::new([0; 4000]);

pub fn write_to_buffer(row: isize, text: &str, color: u8) {
    if row < 0 || row >= 25 { return; } // Boundary check
    
    let mut buffer = OFF_SCREEN_BUFFER.lock();
    let mut current_col = 0;
    
    for byte in text.bytes() {
        if current_col >= 80 { break; } // Prevent line overflow
        let offset = (row as usize * 80 + current_col) * 2;
        
        // Write to RAM, NOT directly to hardware VGA
        if offset + 1 < 4000 {
            buffer[offset] = byte;
            buffer[offset + 1] = color;
        }
        current_col += 1;
    }
}

// Only the UI thread will call this to blast the RAM frame to the Monitor
pub fn flush_to_monitor() {
    let buffer = OFF_SCREEN_BUFFER.lock();
    let hardware_vga = 0xb8000 as *mut u8;
    
    unsafe {
        // Blazing fast DMA-style memory copy (Zero Tearing)
        core::ptr::copy_nonoverlapping(buffer.as_ptr(), hardware_vga, 4000);
    }
}