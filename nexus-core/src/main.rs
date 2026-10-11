// nexus-core/src/main.rs
#![no_std]
#![no_main]
#![feature(abi_x86_interrupt)]
#![allow(unused_imports, dead_code, unused_unsafe)]

extern crate alloc;
use font8x8::UnicodeFonts;

pub mod spinlock; pub mod pci; pub mod memory; pub mod vfs; pub mod fat32;
pub mod kademlia; pub mod routing; pub mod gnn; pub mod scheduler; pub mod task;
pub mod privacy; pub mod e1000; pub mod network; pub mod wasm_engine; pub mod wasm;
pub mod crypto; pub mod crypto_rng; pub mod disk; pub mod nvme; pub mod dhcp;
pub mod icmp; pub mod arp; pub mod ethernet; pub mod consensus; pub mod tokenomics;
pub mod identity; pub mod fabric; pub mod interrupts; pub mod gdt; pub mod allocator;
pub mod usermode; pub mod compositor; pub mod dashboard; pub mod cli; pub mod keyboard;
pub mod vga_buffer; pub mod shell; pub mod smp; pub mod timer; pub mod zk;
pub mod switch; pub mod process; pub mod syscall; pub mod gui; pub mod ai;
pub mod nic_driver; pub mod pci_ecam;
pub mod graphics;

use uefi::prelude::*;
use uefi::boot::{self, MemoryType};
use uefi::proto::console::gop::GraphicsOutput;
use uefi::mem::memory_map::MemoryMapOwned;
use core::panic::PanicInfo;
use core::fmt::Write;
use spin::Mutex;
use alloc::string::String;
use core::sync::atomic::Ordering;

pub const HEAP_SIZE: usize = 25 * 1024 * 1024;
static mut HEAP: [u8; HEAP_SIZE] = [0; HEAP_SIZE];

#[repr(C)] pub struct KernelPayload { pub framebuffer_base: *mut u8, pub framebuffer_size: usize, pub horizontal_resolution: usize, pub vertical_resolution: usize, pub stride: usize, pub memory_map: MemoryMapOwned }
pub struct Terminal { pub framebuffer: *mut u8, pub width: usize, pub height: usize, pub stride: usize, pub size: usize, pub cursor_x: usize, pub cursor_y: usize }
unsafe impl Send for Terminal {} unsafe impl Sync for Terminal {}

impl Terminal {
    fn draw_pixel(&self, x: usize, y: usize, b: u8, g: u8, r: u8) {
        if x >= self.width || y >= self.height { return; }
        unsafe { let offset = (y * self.stride + x) * 4; core::ptr::write_volatile(self.framebuffer.add(offset), b); core::ptr::write_volatile(self.framebuffer.add(offset + 1), g); core::ptr::write_volatile(self.framebuffer.add(offset + 2), r); }
    }
    pub fn scroll(&mut self) {
        let line_height = 12;
        if self.height <= line_height { return; }
        let byte_offset = line_height * self.stride * 4;
        let copy_size = self.size.saturating_sub(byte_offset);
        unsafe {
            core::ptr::copy(self.framebuffer.add(byte_offset), self.framebuffer, copy_size);
            core::ptr::write_bytes(self.framebuffer.add(copy_size), 0, byte_offset);
        }
        self.cursor_y -= line_height;
    }
    fn write_char(&mut self, c: char) {
        if c == '\n' { 
            self.cursor_x = 10; self.cursor_y += 12; 
            if self.cursor_y + 12 >= self.height { self.scroll(); } return; 
        }
        let bitmap = font8x8::BASIC_FONTS.get(c).unwrap_or(font8x8::BASIC_FONTS.get('?').unwrap());
        for y in 0..8 { for x in 0..8 { if (bitmap[y] >> x) & 1 == 1 { self.draw_pixel(self.cursor_x + x, self.cursor_y + y, 0x00, 0xFF, 0x00); } } }
        self.cursor_x += 8; 
        if self.cursor_x + 8 >= self.width { 
            self.cursor_x = 10; self.cursor_y += 12; 
            if self.cursor_y + 12 >= self.height { self.scroll(); }
        }
    }
    pub fn backspace(&mut self) { if self.cursor_x > 26 { self.cursor_x -= 8; for y in 0..8 { for x in 0..8 { self.draw_pixel(self.cursor_x + x, self.cursor_y + y, 0x00, 0x00, 0x00); } } } }
    pub fn clear_screen(&mut self) {
        unsafe { core::ptr::write_bytes(self.framebuffer, 0, self.size); }
        self.cursor_x = 10; self.cursor_y = 10;
    }
}
impl Write for Terminal { fn write_str(&mut self, s: &str) -> core::fmt::Result { for c in s.chars() { self.write_char(c); } Ok(()) } }
pub static TERMINAL: Mutex<Option<Terminal>> = Mutex::new(None);

#[macro_export] macro_rules! print { ($($arg:tt)*) => ($crate::_print(format_args!($($arg)*))); }
#[macro_export] macro_rules! println { () => ($crate::print!("\n")); ($($arg:tt)*) => ($crate::print!("{}\n", format_args!($($arg)*))); }
#[doc(hidden)] pub fn _print(args: core::fmt::Arguments) { if !interrupts::DESKTOP_MODE.load(Ordering::Relaxed) { if let Some(t) = TERMINAL.lock().as_mut() { t.write_fmt(args).unwrap(); } } }

#[entry]
fn main() -> Status {
    uefi::helpers::init().unwrap();
    let mut fb_base: *mut u8 = core::ptr::null_mut(); let mut fb_size = 0; let mut h_res = 0; let mut v_res = 0; let mut fb_stride = 0;
    if let Ok(gh) = boot::get_handle_for_protocol::<GraphicsOutput>() {
        if let Ok(mut gop) = boot::open_protocol_exclusive::<GraphicsOutput>(gh) {
            fb_base = gop.frame_buffer().as_mut_ptr(); fb_size = gop.frame_buffer().size();
            let res = gop.current_mode_info().resolution(); h_res = res.0; v_res = res.1; fb_stride = gop.current_mode_info().stride(); drop(gop);
        }
    }
    let payload = KernelPayload { framebuffer_base: fb_base, framebuffer_size: fb_size, horizontal_resolution: h_res, vertical_resolution: v_res, stride: fb_stride, memory_map: unsafe { boot::exit_boot_services(MemoryType::LOADER_DATA) } };
    unsafe { execute_nexus_titan_kernel(payload); }
}

unsafe fn execute_nexus_titan_kernel(payload: KernelPayload) -> ! {
    graphics::init(payload.framebuffer_base, payload.horizontal_resolution, payload.vertical_resolution, payload.stride);

    if !payload.framebuffer_base.is_null() {
        for i in (0..payload.framebuffer_size).step_by(4) { core::ptr::write_volatile(payload.framebuffer_base.add(i), 0); core::ptr::write_volatile(payload.framebuffer_base.add(i+1), 0); core::ptr::write_volatile(payload.framebuffer_base.add(i+2), 0); }
        *TERMINAL.lock() = Some(Terminal { framebuffer: payload.framebuffer_base, width: payload.horizontal_resolution, height: payload.vertical_resolution, stride: payload.stride, size: payload.framebuffer_size, cursor_x: 10, cursor_y: 10 });
        let heap_ptr = core::ptr::addr_of_mut!(HEAP) as usize;
        crate::allocator::init_heap(heap_ptr, HEAP_SIZE);
        interrupts::init();
        crate::gdt::init_gdt();
        crate::syscall::init_syscalls();

        crate::println!("=====================================================");
        crate::println!(" ? NEXUS TITAN [OS v20.0 - FULL MESH & ECONOMY]");
        crate::println!("=====================================================");
        crate::println!("Press 'b' to Awaken Network, Storage & AI Matrix.");
        crate::println!("Press 's' to Test Unikernel WASM Sandbox.\n> ");
    }

    let mut last_scancode = 0;

    loop {
        let scancode = unsafe { x86_64::instructions::port::Port::<u8>::new(0x60).read() };
        
        if scancode != last_scancode {
            last_scancode = scancode;
            
            if !interrupts::DESKTOP_MODE.load(Ordering::Relaxed) {
                if scancode == 0x1F { 
                    graphics::draw_desktop();
                    interrupts::DESKTOP_MODE.store(true, Ordering::Relaxed);
                    graphics::update_terminal_log("[SYS] ALLOCATING SECURE COMPUTE ENCLAVE...", 0);
                    crate::wasm_engine::run_sandbox_test();
                } 
                else if scancode == 0x30 { 
                    graphics::draw_desktop();
                    interrupts::DESKTOP_MODE.store(true, Ordering::Relaxed);
                    graphics::update_terminal_log("[SYS] AWAKENING REAL HARDWARE COMPONENTS...", 0);
                    crate::disk::initialize_disk();
                    let mut start_sector = [0u8; 512];
                    if crate::disk::read_sector(2048, &mut start_sector) {
                        let saved_tvl = u32::from_le_bytes([start_sector[0], start_sector[1], start_sector[2], start_sector[3]]);
                        if saved_tvl > 0 { *crate::consensus::NETWORK_TVL.lock() = saved_tvl; }
                        let msg = alloc::format!("[VAULT] LEDGER LOADED FROM DISK! TVL: {} NXC", *crate::consensus::NETWORK_TVL.lock());
                        graphics::update_terminal_log(&msg, 0);
                    }
                    crate::vfs::init();
                    crate::e1000::init_dma_network();
                    crate::network::init();
                    crate::tokenomics::init_crypto_economy();
                    crate::consensus::init_pbft_engine();
                    crate::kademlia::init_dht_routing();
                    crate::kademlia::ping_genesis_node();
                    graphics::update_terminal_log("[SYS] AWAITING SCHEDULER HEARTBEAT...", 1);
                }
            } 
            else {
                if scancode == 0x19 { // 'p' key pressed 
                    graphics::update_terminal_log("[NET] [TX] BROADCASTING WASM PAYLOAD OVER-THE-AIR...", 14); 
                    
                    let mut packet = [0u8; 64];
                    for i in 0..6 { packet[i] = 0xFF; } // Broadcast MAC
                    let mac = unsafe { crate::e1000::MAC_ADDRESS };
                    for i in 0..6 { packet[i+6] = mac[i]; } // Source MAC
                    packet[12] = 0x77; packet[13] = 0x77; // NEXUS Custom EtherType
                    
                    packet[14] = b'W'; packet[15] = b'A'; packet[16] = b'S'; packet[17] = b'M';
                    
                    let wasm_code: [u8; 14] = [
                        0x00, 0x61, 0x73, 0x6D, 
                        0x01, 0x00, 0x00, 0x00, 
                        crate::wasm_engine::OP_I32_CONST, 10,
                        crate::wasm_engine::OP_I32_CONST, 32,
                        crate::wasm_engine::OP_I32_ADD,
                        crate::wasm_engine::OP_END
                    ];
                    
                    for i in 0..14 { packet[18+i] = wasm_code[i]; }

                    crate::e1000::send_packet(&packet);
                    graphics::update_terminal_log("[NET] [OK] WASM FRAME PUSHED TO TX RING & SENT.", 10); 
                }
                else if scancode == 0x1F { 
                    graphics::update_terminal_log("[SYS] ALLOCATING SECURE COMPUTE ENCLAVE...", 0);
                    crate::wasm_engine::run_sandbox_test();
                }
            }
        }

        // 🚀 THE UDP STRESS TEST FIX: Only poll the actual network stack!
        if interrupts::DESKTOP_MODE.load(Ordering::Relaxed) {
            crate::network::poll_network(); 
        }

        // Turbo Polling Mode for Stress Testing
        for _ in 0..50 { core::hint::spin_loop(); }
    }
}

#[panic_handler] fn panic(info: &PanicInfo) -> ! {
    if !interrupts::DESKTOP_MODE.load(Ordering::Relaxed) { crate::println!("\n[FATAL] {}", info); }
    loop { core::hint::spin_loop(); }
}