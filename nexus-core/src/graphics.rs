// nexus-core/src/graphics.rs

extern crate alloc;
use core::ptr;
use crate::spinlock::SpinLock; // 🚀 ADDED HARDWARE LOCK FOR 4 CORES

// 🚀 THE DOUBLE BUFFER: 80x25x2 = 4000 bytes in RAM (Off-Screen)
pub static mut OFF_SCREEN_BUFFER: [u8; 4000] = [0; 4000];

// 🚀 THE TRAFFIC POLICE: Ensures only 1 core writes to the buffer at a time
pub static DISPLAY_LOCK: SpinLock<()> = SpinLock::new(());

const VGA_WIDTH: isize = 80;
const VGA_HEIGHT: isize = 25;

static mut MATRIX_INITIALIZED: bool = false;
static mut LEFT_ROW: isize = 3;
static mut RIGHT_ROW: isize = 3;

static mut MOUSE_X: isize = 40;
static mut MOUSE_Y: isize = 12;
static mut ORIGINAL_BG: u8 = 0x00;

// Internal function, assumes lock is already held
fn draw_matrix_dashboard() {
    let vga = unsafe { OFF_SCREEN_BUFFER.as_mut_ptr() };

    for i in 0..(VGA_WIDTH * VGA_HEIGHT) {
        unsafe {
            ptr::write_volatile(vga.offset(i * 2), b' ');
            ptr::write_volatile(vga.offset(i * 2 + 1), 0x00);
        }
    }

    for x in 0..VGA_WIDTH {
        unsafe {
            ptr::write_volatile(vga.offset(x * 2), b' ');
            ptr::write_volatile(vga.offset(x * 2 + 1), 0x1F); 
        }
    }

    let title = b" [ NEXUS TITAN OS - MATRIX HYPERVISOR v2.0 ] ";
    let start_x = (VGA_WIDTH as usize - title.len()) / 2;
    for (i, &byte) in title.iter().enumerate() {
        unsafe {
            ptr::write_volatile(vga.offset((start_x + i) as isize * 2), byte);
            ptr::write_volatile(vga.offset((start_x + i) as isize * 2 + 1), 0x1F); 
        }
    }

    for y in 3..23 {
        unsafe {
            ptr::write_volatile(vga.offset((y * VGA_WIDTH + 39) * 2), 179); 
            ptr::write_volatile(vga.offset((y * VGA_WIDTH + 39) * 2 + 1), 0x08); 
        }
    }

    let left_header = b"=== [ L2/L3 NETWORK & FABRIC ] ===";
    let right_header = b"=== [ L4/L5 COMPUTE & STORAGE ] ===";
    for (i, &b) in left_header.iter().enumerate() {
        unsafe {
            ptr::write_volatile(vga.offset((2 * VGA_WIDTH + 2 + i as isize) * 2), b);
            ptr::write_volatile(vga.offset((2 * VGA_WIDTH + 2 + i as isize) * 2 + 1), 0x0B);
        }
    }
    for (i, &b) in right_header.iter().enumerate() {
        unsafe {
            ptr::write_volatile(vga.offset((2 * VGA_WIDTH + 41 + i as isize) * 2), b);
            ptr::write_volatile(vga.offset((2 * VGA_WIDTH + 41 + i as isize) * 2 + 1), 0x0D);
        }
    }

    for x in 0..VGA_WIDTH {
        unsafe {
            ptr::write_volatile(vga.offset((23 * VGA_WIDTH + x) * 2), 205); 
            ptr::write_volatile(vga.offset((23 * VGA_WIDTH + x) * 2 + 1), 0x0B); 
        }
    }

    unsafe {
        let offset = (MOUSE_Y * VGA_WIDTH + MOUSE_X) * 2 + 1;
        let color = ptr::read_volatile(vga.offset(offset));
        ORIGINAL_BG = color & 0xF0;
        ptr::write_volatile(vga.offset(offset), (color & 0x0F) | 0xF0);
    }
}

pub fn write_result_to_screen(row_req: isize, text: &str, color: u8) {
    let _guard = DISPLAY_LOCK.lock(); // 🚀 LOCK ACQUIRED! No other core can interrupt this
    let vga = unsafe { OFF_SCREEN_BUFFER.as_mut_ptr() };

    unsafe {
        if !MATRIX_INITIALIZED {
            draw_matrix_dashboard();
            MATRIX_INITIALIZED = true;
        }
    }

    if row_req == 24 {
        for i in 0..VGA_WIDTH {
            unsafe {
                ptr::write_volatile(vga.offset((24 * VGA_WIDTH + i) * 2), b' ');
                ptr::write_volatile(vga.offset((24 * VGA_WIDTH + i) * 2 + 1), 0x00);
            }
        }
        for (i, byte) in text.bytes().enumerate() {
            if (i as isize) < VGA_WIDTH {
                unsafe {
                    ptr::write_volatile(vga.offset((24 * VGA_WIDTH + i as isize) * 2), byte);
                    ptr::write_volatile(vga.offset((24 * VGA_WIDTH + i as isize) * 2 + 1), color);
                }
            }
        }
        return;
    }

    if text.contains("AWAITING...") && text.contains("RADAR") {
        let current_row = 22; 
        let col_start = 2;
        let max_len = 36;
        for i in 0..max_len {
            unsafe {
                ptr::write_volatile(vga.offset((current_row * VGA_WIDTH + col_start + i as isize) * 2), b' ');
                ptr::write_volatile(vga.offset((current_row * VGA_WIDTH + col_start + i as isize) * 2 + 1), 0x00);
            }
        }
        for (i, byte) in text.bytes().enumerate() {
            if i < max_len as usize {
                unsafe {
                    ptr::write_volatile(vga.offset((current_row * VGA_WIDTH + col_start + i as isize) * 2), byte);
                    ptr::write_volatile(vga.offset((current_row * VGA_WIDTH + col_start + i as isize) * 2 + 1), color);
                }
            }
        }
        return; 
    }

    // Advanced Text Parsing
    let is_network = text.contains("PCI") || text.contains("DPDK") || text.contains("FABRIC") || text.contains("RADAR") || text.contains("PEERS") || text.contains("NET") || text.contains("SCANNING") || text.contains("E1000") || text.contains("KADEMLIA");
    
    let (col_start, max_len, current_row) = unsafe {
        if is_network {
            let r = LEFT_ROW;
            LEFT_ROW += 1;
            if LEFT_ROW > 21 { LEFT_ROW = 3; } 
            (2, 36, r)
        } else {
            let r = RIGHT_ROW;
            RIGHT_ROW += 1;
            if RIGHT_ROW > 22 { RIGHT_ROW = 3; } 
            (41, 37, r)
        }
    };

    for i in 0..max_len {
        unsafe {
            ptr::write_volatile(vga.offset((current_row * VGA_WIDTH + col_start + i as isize) * 2), b' ');
            ptr::write_volatile(vga.offset((current_row * VGA_WIDTH + col_start + i as isize) * 2 + 1), 0x00);
        }
    }

    for (i, byte) in text.bytes().enumerate() {
        if i < max_len as usize {
            unsafe {
                ptr::write_volatile(vga.offset((current_row * VGA_WIDTH + col_start + i as isize) * 2), byte);
                ptr::write_volatile(vga.offset((current_row * VGA_WIDTH + col_start + i as isize) * 2 + 1), color);
            }
        }
    }
}

pub fn update_mouse(dx: isize, dy: isize) {
    let _guard = DISPLAY_LOCK.lock(); // 🚀 Prevent tearing when mouse moves
    let vga = unsafe { OFF_SCREEN_BUFFER.as_mut_ptr() };
    
    unsafe {
        let old_offset = (MOUSE_Y * VGA_WIDTH + MOUSE_X) * 2 + 1;
        let old_color = ptr::read_volatile(vga.offset(old_offset));
        ptr::write_volatile(vga.offset(old_offset), (old_color & 0x0F) | ORIGINAL_BG);

        MOUSE_X += dx;
        MOUSE_Y -= dy; 
        if MOUSE_X < 0 { MOUSE_X = 0; }
        if MOUSE_X >= VGA_WIDTH { MOUSE_X = VGA_WIDTH - 1; }
        if MOUSE_Y < 0 { MOUSE_Y = 0; }
        if MOUSE_Y >= VGA_HEIGHT { MOUSE_Y = VGA_HEIGHT - 1; }

        let new_offset = (MOUSE_Y * VGA_WIDTH + MOUSE_X) * 2 + 1;
        let new_color = ptr::read_volatile(vga.offset(new_offset));
        ORIGINAL_BG = new_color & 0xF0;
        ptr::write_volatile(vga.offset(new_offset), (new_color & 0x0F) | 0xF0);
    }
}

// 🚀 NEW FUNCTION: BLAST RAM TO PHYSICAL MONITOR INSTANTLY
pub fn flush_to_monitor() {
    let _guard = DISPLAY_LOCK.lock();
    let hardware_vga = 0xb8000 as *mut u8;
    unsafe {
        core::ptr::copy_nonoverlapping(OFF_SCREEN_BUFFER.as_ptr(), hardware_vga, 4000);
    }
}