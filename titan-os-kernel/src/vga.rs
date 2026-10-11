pub fn clear_screen() {
    let vga_buffer = 0xb8000 as *mut u8;
    for i in 0..4000 { unsafe { *vga_buffer.offset(i) = 0; } }
}

pub fn print(row: isize, text: &str, color: u8) {
    let vga_buffer = 0xb8000 as *mut u8;
    for (i, &byte) in text.as_bytes().iter().enumerate() {
        unsafe {
            *vga_buffer.offset((row * 160) + (i as isize * 2)) = byte;
            *vga_buffer.offset((row * 160) + (i as isize * 2) + 1) = color;
        }
    }
}
