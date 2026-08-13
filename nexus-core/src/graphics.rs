// nexus-core/src/graphics.rs
#![allow(dead_code)]

use font8x8::UnicodeFonts;
use core::sync::atomic::{AtomicUsize, Ordering};

pub static mut FRAMEBUFFER: *mut u8 = core::ptr::null_mut();
pub static mut FB_WIDTH: usize = 0;
pub static mut FB_HEIGHT: usize = 0;
pub static mut FB_STRIDE: usize = 0;

static mut OLD_X: usize = 400;
static mut OLD_Y: usize = 300;
static mut CURSOR_BACKUP: [u8; 256] = [0; 256];
static mut IS_FIRST_DRAW: bool = true;
static CURRENT_ROW: AtomicUsize = AtomicUsize::new(3);

pub fn init(base: *mut u8, width: usize, height: usize, stride: usize) {
    unsafe { FRAMEBUFFER = base; FB_WIDTH = width; FB_HEIGHT = height; FB_STRIDE = stride; }
}

pub fn draw_pixel(x: usize, y: usize, color: u32) {
    unsafe {
        if FRAMEBUFFER.is_null() || x >= FB_WIDTH || y >= FB_HEIGHT { return; }
        let offset = (y * FB_STRIDE + x) * 4;
        let bytes = color.to_le_bytes();
        core::ptr::write_volatile(FRAMEBUFFER.add(offset), bytes[0]);
        core::ptr::write_volatile(FRAMEBUFFER.add(offset + 1), bytes[1]);
        core::ptr::write_volatile(FRAMEBUFFER.add(offset + 2), bytes[2]);
    }
}

pub fn draw_rect(x: usize, y: usize, w: usize, h: usize, color: u32) {
    for j in 0..h { for i in 0..w { draw_pixel(x + i, y + j, color); } }
}

pub fn draw_gui_text(x: usize, y: usize, text: &str, color: u32) {
    let mut cx = x; let mut cy = y;
    for c in text.chars() {
        if c == '\n' { cx = x; cy += 14; continue; }
        let bitmap = font8x8::BASIC_FONTS.get(c).unwrap_or(font8x8::BASIC_FONTS.get('?').unwrap());
        for r in 0..8 {
            for col in 0..8 { if (bitmap[r] >> col) & 1 == 1 { draw_pixel(cx + col, cy + r, color); } }
        }
        cx += 8;
    }
}

pub fn update_cursor(nx: usize, ny: usize) {
    unsafe {
        if FRAMEBUFFER.is_null() { return; }
        if !IS_FIRST_DRAW {
            let mut i = 0;
            for r in 0..8 {
                for c in 0..8 {
                    let px = OLD_X + c; let py = OLD_Y + r;
                    if px < FB_WIDTH && py < FB_HEIGHT {
                        let off = (py * FB_STRIDE + px) * 4;
                        core::ptr::write_volatile(FRAMEBUFFER.add(off), CURSOR_BACKUP[i]);
                        core::ptr::write_volatile(FRAMEBUFFER.add(off + 1), CURSOR_BACKUP[i + 1]);
                        core::ptr::write_volatile(FRAMEBUFFER.add(off + 2), CURSOR_BACKUP[i + 2]);
                    }
                    i += 4;
                }
            }
        }
        let mut i = 0;
        for r in 0..8 {
            for c in 0..8 {
                let px = nx + c; let py = ny + r;
                if px < FB_WIDTH && py < FB_HEIGHT {
                    let off = (py * FB_STRIDE + px) * 4;
                    CURSOR_BACKUP[i] = core::ptr::read_volatile(FRAMEBUFFER.add(off));
                    CURSOR_BACKUP[i + 1] = core::ptr::read_volatile(FRAMEBUFFER.add(off + 1));
                    CURSOR_BACKUP[i + 2] = core::ptr::read_volatile(FRAMEBUFFER.add(off + 2));
                }
                i += 4;
            }
        }
        draw_rect(nx, ny, 8, 8, 0x000000); draw_rect(nx + 1, ny + 1, 6, 6, 0xFFFFFF);
        OLD_X = nx; OLD_Y = ny; IS_FIRST_DRAW = false;
    }
}

// 🚀 ZERO-ALLOCATION RENDER FIX: Memory leak completely patched!
pub fn update_terminal_log(msg: &str, row: usize) {
    unsafe {
        if FRAMEBUFFER.is_null() { return; }
        let w = FB_WIDTH; let h = FB_HEIGHT;
        let win_x = (w / 2).saturating_sub(300); let win_y = (h / 2).saturating_sub(200);
        let safe_row = row % 15; let t_x = win_x + 20; let t_y = win_y + 50 + (safe_row * 15);
        
        // Draw solid background to clear old text automatically (No spaces padding needed)
        draw_rect(t_x, t_y, 560, 14, 0x222C3A);
        
        let mut cx = t_x;
        for c in msg.chars() {
            let bitmap = font8x8::BASIC_FONTS.get(c).unwrap_or(font8x8::BASIC_FONTS.get('?').unwrap());
            for r in 0..8 {
                for col in 0..8 { if (bitmap[r] >> col) & 1 == 1 { draw_pixel(cx + col, t_y + r, 0x00FFFF); } }
            }
            cx += 8;
        }
    }
}

pub fn write_result_to_screen(_row: usize, text: &str, _color_code: u8) {
    let mut r = CURRENT_ROW.fetch_add(1, Ordering::Relaxed);
    if r > 12 { CURRENT_ROW.store(4, Ordering::Relaxed); r = 3; }
    update_terminal_log(text, r);
}

pub fn draw_desktop() {
    unsafe {
        if FRAMEBUFFER.is_null() { return; }
        let w = FB_WIDTH; let h = FB_HEIGHT;
        draw_rect(0, 0, w, h, 0x1A2530); draw_rect(0, h.saturating_sub(40), w, 40, 0x0F1722);
        draw_rect(10, h.saturating_sub(35), 100, 30, 0x00FFCC); draw_gui_text(25, h.saturating_sub(25), "NEXUS", 0x000000);
        let win_x = (w / 2).saturating_sub(300); let win_y = (h / 2).saturating_sub(200);
        draw_rect(win_x + 10, win_y + 10, 600, 400, 0x000000); draw_rect(win_x, win_y, 600, 400, 0x222C3A); 
        draw_rect(win_x, win_y, 600, 30, 0x00FFCC); 
        draw_gui_text(win_x + 10, win_y + 10, "NEXUS TITAN OS - SECURE MATRIX NODE", 0x000000);
    }
}