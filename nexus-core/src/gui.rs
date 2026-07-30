// nexus-core/src/gui.rs

use x86_64::instructions::port::Port;

// We use this to track which 64KB block of VRAM we are currently writing to
static mut CURRENT_BANK: u16 = 0xFFFF;

pub fn init_pixel_gui() {
    // 1. Disable standard VGA to prevent conflicts
    let mut index_port = Port::<u16>::new(0x01CE);
    let mut data_port = Port::<u16>::new(0x01CF);

    unsafe {
        index_port.write(4);
        data_port.write(0); // Disable

        // 2. Set X Resolution (800) and Y Resolution (600)
        index_port.write(1); data_port.write(800);
        index_port.write(2); data_port.write(600);
        
        // 3. Set Color Depth (32-bit True Color)
        index_port.write(3); data_port.write(32);

        // 🚀 4. THE HACK: Enable VBE in BANK SWITCHING MODE (0x01) 
        // We do NOT use LFB (0x41). This forces GPU to map to the safe 0xA0000 address!
        index_port.write(4);
        data_port.write(0x01); 
    }

    draw_desktop();
}

// Write a single byte to the 64KB VGA Window, switching hardware banks dynamically
pub fn write_vram(byte_offset: usize, value: u8) {
    let bank = (byte_offset / 65536) as u16;
    let local_offset = byte_offset % 65536;
    
    unsafe {
        // Only trigger the hardware port if the bank actually changes (Massive Performance Boost)
        if bank != CURRENT_BANK {
            let mut index_port = Port::<u16>::new(0x01CE);
            let mut data_port = Port::<u16>::new(0x01CF);
            index_port.write(5); // Bank Selection Register
            data_port.write(bank);
            CURRENT_BANK = bank;
        }
        
        // 0xA0000 is the legendary safe memory address from the MS-DOS era!
        let vram = 0xA0000 as *mut u8;
        core::ptr::write_volatile(vram.add(local_offset), value);
    }
}

// Draw a single 32-bit Pixel
pub fn draw_pixel(x: usize, y: usize, color: u32) {
    if x >= 800 || y >= 600 { return; }
    
    let offset = (y * 800 + x) * 4;
    let bytes = color.to_le_bytes(); // Extracts B, G, R channels
    
    write_vram(offset, bytes[0]);     // Blue
    write_vram(offset + 1, bytes[1]); // Green
    write_vram(offset + 2, bytes[2]); // Red
    // Ignoring Alpha channel for performance
}

pub fn draw_rect(x: usize, y: usize, w: usize, h: usize, color: u32) {
    // Outer loop must be Y (Rows) for hardware cache efficiency
    for j in 0..h {
        for i in 0..w {
            draw_pixel(x + i, y + j, color);
        }
    }
}

pub fn draw_desktop() {
    // 1. Draw Deep Cyberpunk Background (Dark Blue)
    draw_rect(0, 0, 800, 600, 0x000510);

    // 2. Draw Taskbar at the bottom
    draw_rect(0, 560, 800, 40, 0x001A33);

    // 3. Draw Start Button (Cyan)
    draw_rect(10, 565, 80, 30, 0x00FFFF);

    // 4. Draw Main Application Window Shadow
    draw_rect(205, 105, 400, 300, 0x000000); 

    // 5. Draw Main Application Window Base
    draw_rect(200, 100, 400, 300, 0x1A1A1A); 

    // 6. Draw Window Title Bar (Cyan)
    draw_rect(200, 100, 400, 30, 0x00FFCC); 

    // 7. Draw Window Content (Simulating Code/Text blocks)
    draw_rect(220, 150, 200, 10, 0x00FF00); // Green Data Line
    draw_rect(220, 170, 300, 10, 0x00FF00); // Green Data Line
    draw_rect(220, 190, 150, 10, 0x00FF00); // Green Data Line
    draw_rect(220, 230, 250, 10, 0xFF00FF); // Pink Alert Line
}