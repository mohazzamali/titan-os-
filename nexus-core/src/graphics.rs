// nexus-core/src/graphics.rs
#![allow(dead_code)]
extern crate alloc;
use spin::Mutex;
use font8x8::UnicodeFonts;
use core::ptr;

pub struct GraphicsEngine {
    pub framebuffer: *mut u8,
    pub width: usize,
    pub height: usize,
    pub stride: usize,
    pub cursor_x: usize,
    pub cursor_y: usize,
    
    // UI Box Boundaries
    pub box_x: usize,
    pub box_y: usize,
    pub box_w: usize,
    pub box_h: usize,
}

unsafe impl Send for GraphicsEngine {}
unsafe impl Sync for GraphicsEngine {}

pub static ENGINE: Mutex<Option<GraphicsEngine>> = Mutex::new(None);

pub fn init(fb_base: *mut u8, w: usize, h: usize, stride: usize) {
    let box_w = 800; // Perfect width for logs
    let box_h = 500; // Perfect height
    let box_x = if w > box_w { (w - box_w) / 2 } else { 0 };
    let box_y = if h > box_h { (h - box_h) / 2 } else { 0 };

    *ENGINE.lock() = Some(GraphicsEngine {
        framebuffer: fb_base,
        width: w,
        height: h,
        stride,
        box_x,
        box_y,
        box_w,
        box_h,
        cursor_x: box_x + 20,
        cursor_y: box_y + 40,
    });

    if let Some(engine) = ENGINE.lock().as_mut() {
        // 1. Draw outer desktop background
        engine.fill_rect(0, 0, w, h, 0x15, 0x1A, 0x22); 
        
        // 2. Draw Bottom Taskbar
        engine.fill_rect(0, h - 30, w, 30, 0x0A, 0x0E, 0x14); 
        engine.fill_rect(0, h - 30, 100, 30, 0x00, 0xFF, 0xCC); // Cyan Start Button
        
        engine.cursor_x = 25;
        engine.cursor_y = h - 20;
        engine.write_string("NEXUS", 0x00, 0x00, 0x00);
    }
}

pub fn draw_desktop() {
    if let Some(engine) = ENGINE.lock().as_mut() {
        // Main Window Body
        engine.fill_rect(engine.box_x, engine.box_y, engine.box_w, engine.box_h, 0x26, 0x2B, 0x35);
        
        // Cyan Header
        engine.fill_rect(engine.box_x, engine.box_y, engine.box_w, 30, 0x00, 0xFF, 0xCC);
        
        // Header Text
        engine.cursor_x = engine.box_x + 15;
        engine.cursor_y = engine.box_y + 11;
        engine.write_string("NEXUS TITAN OS - SECURE MATRIX NODE", 0x00, 0x00, 0x00);
        
        // Reset cursor for logs
        engine.cursor_x = engine.box_x + 20;
        engine.cursor_y = engine.box_y + 50;
    }
}

fn get_color(code: u8) -> (u8, u8, u8) {
    match code {
        0  => (0xFF, 0xFF, 0xFF), // White
        10 => (0x50, 0xFA, 0x7B), // Green
        11 => (0x8B, 0xE9, 0xFD), // Cyan
        12 => (0xFF, 0x55, 0x55), // Red
        13 => (0xBD, 0x93, 0xF9), // Purple
        14 => (0xF1, 0xFA, 0x8C), // Yellow
        _  => (0xFF, 0xFF, 0xFF), // White default
    }
}

// 🚀 THIS IS THE FIX: Automatic newline after every module print!
pub fn update_terminal_log(msg: &str, color_code: u8) {
    if let Some(engine) = ENGINE.lock().as_mut() {
        let (r, g, b) = get_color(color_code);
        engine.write_string(msg, r, g, b);
        engine.newline(); 
    }
}

pub fn write_result_to_screen(_line: usize, msg: &str, color: u8) {
    update_terminal_log(msg, color);
}

impl GraphicsEngine {
    fn draw_pixel(&self, x: usize, y: usize, r: u8, g: u8, b: u8) {
        if x >= self.width || y >= self.height { return; }
        let offset = (y * self.stride + x) * 4;
        unsafe {
            ptr::write_volatile(self.framebuffer.add(offset), b);
            ptr::write_volatile(self.framebuffer.add(offset + 1), g);
            ptr::write_volatile(self.framebuffer.add(offset + 2), r);
        }
    }

    fn fill_rect(&self, x: usize, y: usize, w: usize, h: usize, r: u8, g: u8, b: u8) {
        for cy in y..(y+h) {
            for cx in x..(x+w) {
                self.draw_pixel(cx, cy, r, g, b);
            }
        }
    }

    fn write_string(&mut self, s: &str, r: u8, g: u8, b: u8) {
        for c in s.chars() {
            if c == '\n' {
                self.newline();
                continue;
            }
            let bitmap = font8x8::BASIC_FONTS.get(c).unwrap_or(font8x8::BASIC_FONTS.get('?').unwrap());
            for cy in 0..8 {
                for cx in 0..8 {
                    if (bitmap[cy] >> cx) & 1 == 1 {
                        self.draw_pixel(self.cursor_x + cx, self.cursor_y + cy, r, g, b);
                    }
                }
            }
            self.cursor_x += 8;
            if self.cursor_x + 8 >= self.box_x + self.box_w - 20 {
                self.newline();
            }
        }
    }

    fn newline(&mut self) {
        self.cursor_x = self.box_x + 20;
        self.cursor_y += 16; // Line height spacing
        
        // 🚀 FAST UI BOX SCROLLING LOGIC
        if self.cursor_y + 16 >= self.box_y + self.box_h - 10 {
            let line_height = 16;
            let start_y = self.box_y + 30; // Just below the cyan header
            let end_y = self.box_y + self.box_h;
            
            // Shift all rows up mathematically via RAM pointers
            for y in start_y..(end_y - line_height) {
                let dst_offset = (y * self.stride + self.box_x) * 4;
                let src_offset = ((y + line_height) * self.stride + self.box_x) * 4;
                unsafe {
                    ptr::copy(
                        self.framebuffer.add(src_offset), 
                        self.framebuffer.add(dst_offset), 
                        self.box_w * 4
                    );
                }
            }
            
            // Wipe the bottom line clean
            self.fill_rect(self.box_x, end_y - line_height, self.box_w, line_height, 0x26, 0x2B, 0x35);
            self.cursor_y -= line_height;
        }
    }
}