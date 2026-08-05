// nexus-core/src/graphics.rs
// INDUSTRIAL GRADE VGA BUFFER WITH AUTO-SCROLL

#![allow(dead_code)]

pub fn write_result_to_screen(mut row: usize, text: &str, color_code: u8) {
    let vga_buffer = 0xb8000 as *mut u8;

    unsafe {
        // 🚀 THE SCROLLING ENGINE
        if row >= 25 {
            let bytes_per_row = 80 * 2;
            
            // Shift rows 1-24 up by exactly 1 row
            core::ptr::copy(
                vga_buffer.add(bytes_per_row),
                vga_buffer,
                bytes_per_row * 24,
            );

            // Clear the bottom row (Row 24) to avoid text artifacting
            for col in 0..80 {
                let offset = (24 * 80 + col) * 2;
                core::ptr::write_volatile(vga_buffer.add(offset), b' ');
                core::ptr::write_volatile(vga_buffer.add(offset + 1), 0x0F); 
            }
            
            // Force the new log to print on the newly cleared bottom row
            row = 24; 
        }

        // 🚀 THE PRINT ENGINE
        for (i, byte) in text.bytes().enumerate() {
            if i >= 80 { break; } // Prevent overflow on a single line
            let offset = (row * 80 + i) * 2;
            core::ptr::write_volatile(vga_buffer.add(offset), byte);
            core::ptr::write_volatile(vga_buffer.add(offset + 1), color_code);
        }
    }
}
