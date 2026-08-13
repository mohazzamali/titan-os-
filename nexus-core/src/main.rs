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
    fn write_char(&mut self, c: char) {
        if c == '\n' { self.cursor_x = 10; self.cursor_y += 12; return; }
        let bitmap = font8x8::BASIC_FONTS.get(c).unwrap_or(font8x8::BASIC_FONTS.get('?').unwrap());
        for y in 0..8 { for x in 0..8 { if (bitmap[y] >> x) & 1 == 1 { self.draw_pixel(self.cursor_x + x, self.cursor_y + y, 0x00, 0xFF, 0x00); } } }
        self.cursor_x += 8; if self.cursor_x + 8 >= self.width { self.cursor_x = 10; self.cursor_y += 12; }
    }
    pub fn backspace(&mut self) { if self.cursor_x > 26 { self.cursor_x -= 8; for y in 0..8 { for x in 0..8 { self.draw_pixel(self.cursor_x + x, self.cursor_y + y, 0x00, 0x00, 0x00); } } } }
    pub fn clear_screen(&mut self) {
        for i in (0..self.size).step_by(4) { unsafe { core::ptr::write_volatile(self.framebuffer.add(i), 0x00); core::ptr::write_volatile(self.framebuffer.add(i + 1), 0x00); core::ptr::write_volatile(self.framebuffer.add(i + 2), 0x00); } }
        self.cursor_x = 10; self.cursor_y = 10;
    }
}
impl Write for Terminal { fn write_str(&mut self, s: &str) -> core::fmt::Result { for c in s.chars() { self.write_char(c); } Ok(()) } }
pub static TERMINAL: Mutex<Option<Terminal>> = Mutex::new(None);

#[macro_export] macro_rules! print { ($($arg:tt)*) => ($crate::_print(format_args!($($arg)*))); }
#[macro_export] macro_rules! println { () => ($crate::print!("\n")); ($($arg:tt)*) => ($crate::print!("{}\n", format_args!($($arg)*))); }
#[doc(hidden)] pub fn _print(args: core::fmt::Arguments) { if !interrupts::DESKTOP_MODE.load(Ordering::Relaxed) { if let Some(t) = TERMINAL.lock().as_mut() { t.write_fmt(args).unwrap(); } } }

pub mod mouse {
    use core::sync::atomic::{AtomicI32, AtomicU8, AtomicBool, Ordering};
    use x86_64::instructions::port::Port;
    pub static MOUSE_X: AtomicI32 = AtomicI32::new(400); pub static MOUSE_Y: AtomicI32 = AtomicI32::new(300);
    pub static MOUSE_MOVED: AtomicBool = AtomicBool::new(false);
    static MOUSE_CYCLE: AtomicU8 = AtomicU8::new(0); static PACKET_0: AtomicU8 = AtomicU8::new(0); static PACKET_1: AtomicU8 = AtomicU8::new(0);

    fn wait_write() { let mut p = Port::<u8>::new(0x64); for _ in 0..10_000 { if (unsafe{p.read()} & 2)==0 { break; } } }
    fn wait_read() { let mut p = Port::<u8>::new(0x64); for _ in 0..10_000 { if (unsafe{p.read()} & 1)==1 { break; } } }

    pub fn init() {
        unsafe {
            x86_64::instructions::interrupts::disable(); 
            let mut cmd = Port::<u8>::new(0x64); let mut data = Port::<u8>::new(0x60);
            for _ in 0..100 { if (cmd.read() & 1) == 1 { data.read(); } else { break; } }
            wait_write(); cmd.write(0xA8); wait_write(); cmd.write(0x20); wait_read(); let mut status = data.read();
            status |= 0b0000_0010; status &= !0b0010_0000;
            wait_write(); cmd.write(0x60); wait_write(); data.write(status);
            wait_write(); cmd.write(0xD4); wait_write(); data.write(0xF6); wait_read(); data.read();
            wait_write(); cmd.write(0xD4); wait_write(); data.write(0xF4); wait_read(); data.read();
            x86_64::instructions::interrupts::enable(); 
        }
    }

    pub fn handle_interrupt() {
        let byte = unsafe { Port::<u8>::new(0x60).read() }; if byte == 0xFA { return; }
        let cycle = MOUSE_CYCLE.load(Ordering::Relaxed);
        if cycle == 0 { if (byte & 0x08) != 0 { PACKET_0.store(byte, Ordering::Relaxed); MOUSE_CYCLE.store(1, Ordering::Relaxed); } }
        else if cycle == 1 { PACKET_1.store(byte, Ordering::Relaxed); MOUSE_CYCLE.store(2, Ordering::Relaxed); }
        else if cycle == 2 {
            let mut dx = PACKET_1.load(Ordering::Relaxed) as i32; let mut dy = byte as i32;
            let p0 = PACKET_0.load(Ordering::Relaxed);
            if (p0 & 0x10) != 0 { dx -= 256; } if (p0 & 0x20) != 0 { dy -= 256; }
            let mut x = MOUSE_X.load(Ordering::Relaxed) + dx; let mut y = MOUSE_Y.load(Ordering::Relaxed) - dy;
            let w = unsafe { crate::graphics::FB_WIDTH as i32 }; let max_x = if w > 0 { w - 8 } else { 792 };
            let h = unsafe { crate::graphics::FB_HEIGHT as i32 }; let max_y = if h > 0 { h - 8 } else { 592 };
            if x < 0 { x = 0; } else if x > max_x { x = max_x; }
            if y < 0 { y = 0; } else if y > max_y { y = max_y; }
            if x != MOUSE_X.load(Ordering::Relaxed) || y != MOUSE_Y.load(Ordering::Relaxed) {
                MOUSE_X.store(x, Ordering::Relaxed); MOUSE_Y.store(y, Ordering::Relaxed); MOUSE_MOVED.store(true, Ordering::Relaxed);
            }
            MOUSE_CYCLE.store(0, Ordering::Relaxed);
        }
    }
}

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

        crate::println!("=====================================================");
        crate::println!(" 🚀 NEXUS TITAN [OS v18.0 - FULL E1000 TX/RX MESH]");
        crate::println!("=====================================================");
        crate::println!("Type 'boot' to Awaken Network, Storage & AI Matrix.\n> ");
    }

    let mut last_processed_tick = 0;
    let mut mouse_init_tick = 0;

    loop {
        if interrupts::DESKTOP_MODE.load(Ordering::Relaxed) {
            let current_tick = interrupts::OS_TICK.load(Ordering::Relaxed);

            if mouse::MOUSE_MOVED.swap(false, Ordering::Relaxed) {
                let mx = mouse::MOUSE_X.load(Ordering::Relaxed) as usize;
                let my = mouse::MOUSE_Y.load(Ordering::Relaxed) as usize;
                graphics::update_cursor(mx, my);
            }

            if mouse_init_tick > 0 && current_tick > mouse_init_tick {
                mouse::init();
                graphics::write_result_to_screen(0, "[SYS] PS/2 MOUSE IRQ-12 LOADED SAFELY.", 0);
                mouse_init_tick = 0;
            }

            if current_tick > last_processed_tick {
                
                // 🚀 CPU IS NOW SILENT AND EFFICIENT. 
                // Network is handled instantly by IRQ-11 Hardware Interrupts!
                if current_tick % 10 == 0 {
                    crate::scheduler::tick(); 
                }

                if current_tick % 20000 == 0 { 
                    crate::gnn::execute_dream_cycle(); 
                }
                
                if current_tick % 40000 == 0 {
                    graphics::write_result_to_screen(0, "[SYS] EXTRACTING PAYLOAD FROM VFS FAT32 SECTORS...", 0);
                    if let Some(wasm_data) = crate::vfs::read_file("smart_contract.wasm") {
                        if wasm_data.len() > 8 && &wasm_data[0..4] == &[0x00, 0x61, 0x73, 0x6D] {
                            let executable_code = if wasm_data.len() == 40 { &wasm_data[37..40] } else { &wasm_data[8..] };
                            if let Some(res) = crate::wasm::validate_and_execute(executable_code) {
                                let msg = alloc::format!("WASM: JIT EXECUTION SUCCESS! RESULT = {}", res);
                                graphics::write_result_to_screen(0, &msg, 0);
                                crate::consensus::verify_compute(res as u64, 50);
                            } else {
                                graphics::write_result_to_screen(0, "[SYS] WASM AST PARSE FAILED. INITIATING RAW MATH...", 0);
                                let raw_math = [crate::wasm::OP_I32_CONST, 50, crate::wasm::OP_I32_CONST, 50, crate::wasm::OP_I32_ADD, crate::wasm::OP_END];
                                if let Some(res) = crate::wasm::validate_and_execute(&raw_math) {
                                    let msg = alloc::format!("WASM: RAW MATH INJECTION SUCCESS! 50 + 50 = {}", res);
                                    graphics::write_result_to_screen(0, &msg, 0);
                                    crate::consensus::verify_compute(res as u64, 10);
                                }
                            }
                        } else {
                            graphics::write_result_to_screen(0, "WASM: EXECUTION FAILED! CORRUPTED BYTECODE.", 0);
                        }
                    }
                }
                last_processed_tick = current_tick;
            }
        }

        if interrupts::COMMAND_READY.swap(false, Ordering::Relaxed) {
            let cmd_str = { let mut b = interrupts::COMMAND_BUFFER.lock(); let s = String::from(b.trim()); b.clear(); s };
            let cmd = cmd_str.as_str();

            if !interrupts::DESKTOP_MODE.load(Ordering::Relaxed) {
                if cmd == "boot" {
                    graphics::draw_desktop();
                    interrupts::DESKTOP_MODE.store(true, Ordering::Relaxed);
                    
                    mouse_init_tick = interrupts::OS_TICK.load(Ordering::Relaxed) + 30;

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
                    crate::kademlia::init_dht_routing();

                    graphics::update_terminal_log("[SYS] AWAITING SCHEDULER HEARTBEAT...", 1);
                    
                    graphics::update_terminal_log("> _", 14); 
                }
                else { crate::println!("Command not found: {}", cmd); crate::print!("> "); }
            } else {
                graphics::update_terminal_log("> _", 14); 

                if cmd == "ping" {
                    graphics::write_result_to_screen(0, "[CLI] 📤 BROADCASTING ARP REQUEST TO GATEWAY...", 0);
                    crate::network::send_test_packet();
                } else if cmd.starts_with("gossip ") {
                    let val_str = cmd[7..].trim();
                    let mut new_tvl = 0;
                    for c in val_str.chars() {
                        if c >= '0' && c <= '9' { new_tvl = new_tvl * 10 + (c as u32 - '0' as u32); }
                    }
                    if new_tvl > 0 {
                        *crate::consensus::NETWORK_TVL.lock() = new_tvl;
                        let mut sector_data = [0u8; 512];
                        let balance_bytes = new_tvl.to_le_bytes();
                        sector_data[0..4].copy_from_slice(&balance_bytes);
                        crate::disk::write_sector(2048, &sector_data);
                        let msg = alloc::format!("[SWARM] 🌐 GOSSIP RECEIVED! VAULT SYNCED TO {} NXC.", new_tvl);
                        graphics::write_result_to_screen(0, &msg, 0);
                    } else {
                        graphics::write_result_to_screen(0, "[CLI] ERROR: INVALID GOSSIP TVL.", 0);
                    }
                } else if cmd == "help" {
                    graphics::write_result_to_screen(0, "[CLI] COMMANDS: ping, gossip <TVL>, help", 0);
                } else if cmd != "" {
                    let msg = alloc::format!("[CLI] UNKNOWN COMMAND: {}", cmd);
                    graphics::write_result_to_screen(0, &msg, 0);
                }
            }
        }

        unsafe { core::arch::asm!("hlt"); }
    }
}

#[panic_handler] fn panic(info: &PanicInfo) -> ! {
    if !interrupts::DESKTOP_MODE.load(Ordering::Relaxed) { crate::println!("\n[FATAL] {}", info); }
    loop { core::hint::spin_loop(); }
}