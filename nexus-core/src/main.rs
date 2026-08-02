// nexus-core/src/main.rs

#![no_std]
#![no_main]
#![feature(abi_x86_interrupt)] 

extern crate alloc; 

pub mod graphics;
pub mod smp;
pub mod scheduler; 
pub mod spinlock;
pub mod identity;
pub mod vfs;           // 🚀 Phase 2 Module
pub mod allocator;
pub mod interrupts;
pub mod gdt;
pub mod nvme;          
pub mod fabric;
pub mod consensus;     // Typo fixed
pub mod wasm_engine;   
pub mod e1000;
pub mod arp;
pub mod icmp;
pub mod kademlia;
pub mod crypto;
pub mod gui;
pub mod ai; 
pub mod process;
pub mod timer;
pub mod switch;
pub mod syscall; 
pub mod gnn;
pub mod dashboard;
pub mod keyboard;
pub mod shell;
pub mod pci;
pub mod memory; 

use bootloader::{entry_point, BootInfo};
use core::panic::PanicInfo;

entry_point!(kernel_main);

fn task_loader() { crate::nvme::initialize_nvme(); loop { for _ in 0..100_000_000 { core::hint::spin_loop(); } } }
fn task_alpha() { loop { for _ in 0..5_000_000 { core::hint::spin_loop(); } } }
fn task_beta() { loop { for _ in 0..5_000_000 { core::hint::spin_loop(); } } }
fn task_network_daemon() {
    loop {
        crate::e1000::receive_packets();
        let _peer_count = crate::kademlia::get_peer_count();
        for _ in 0..50_000 { core::hint::spin_loop(); } 
    }
}
fn task_dashboard() {
    loop {
        crate::dashboard::render_nexus_brain();
        for _ in 0..20_000_000 { core::hint::spin_loop(); } 
    }
}

fn kernel_main(boot_info: &'static BootInfo) -> ! {
    // 🚀 CHECKPOINT 0: Kernel Entry
    crate::graphics::write_result_to_screen(0, "BOOT 0: KERNEL ENTRY SUCCESSFUL...", 0x0A);

    crate::gdt::init(); 
    crate::interrupts::init_idt();
    // 🚀 CHECKPOINT 1: CPU Tables
    crate::graphics::write_result_to_screen(1, "BOOT 1: GDT & IDT INITIALIZED...", 0x0A);

    let phys_mem_offset = x86_64::VirtAddr::new(boot_info.physical_memory_offset);
    let mut mapper = unsafe { crate::memory::init(phys_mem_offset) };
    let mut frame_allocator = unsafe {
        crate::memory::BootInfoFrameAllocator::init(&boot_info.memory_map)
    };
    // 🚀 CHECKPOINT 2: Memory Paging
    crate::graphics::write_result_to_screen(2, "BOOT 2: MEMORY PAGING ACTIVE...", 0x0A);

    if let Some((bar0, _, _)) = crate::pci::scan_bus_and_get_e1000_io_base() {
        let phys_base = x86_64::PhysAddr::new((bar0 & 0xFFFFFFF0) as u64);
        crate::memory::map_mmio(phys_base, &mut mapper, &mut frame_allocator)
            .expect("MMU TRAP: Failed to identity-map E1000 MMIO space!");
    }
    // 🚀 CHECKPOINT 3: PCI & Network Card
    crate::graphics::write_result_to_screen(3, "BOOT 3: E1000 NETWORK CARD DETECTED...", 0x0A);

    crate::allocator::init_heap();
    // 🚀 CHECKPOINT 4: Heap Memory
    crate::graphics::write_result_to_screen(4, "BOOT 4: HEAP ALLOCATOR READY...", 0x0A);

    unsafe { crate::interrupts::PICS.lock().initialize() };
    crate::syscall::init_syscalls();
    
    // 🚀 CHECKPOINT 5: PICS & Syscalls
    crate::graphics::write_result_to_screen(5, "BOOT 5: SYSCALLS & PICS CONFIGURED...", 0x0A);

    crate::smp::wake_up_aps();
    // 🚀 CHECKPOINT 6: Multicore
    crate::graphics::write_result_to_screen(6, "BOOT 6: SYMMETRIC MULTIPROCESSING AWAKE...", 0x0A);

    // 🚀 CHECKPOINT 7: THE VIRTUAL FILE SYSTEM
    crate::vfs::init();
    crate::graphics::write_result_to_screen(7, "BOOT 7: NEXUS VIRTUAL FILE SYSTEM MOUNTED...", 0x0A);

    crate::scheduler::add_task(task_loader);
    crate::scheduler::add_task(task_alpha);
    crate::scheduler::add_task(task_beta);
    crate::scheduler::add_task(task_network_daemon);
    crate::scheduler::add_task(task_dashboard);
    crate::scheduler::add_task(crate::shell::task_shell);
    
    crate::timer::configure_pit(1000);
    x86_64::instructions::interrupts::enable();
    
    // 🚀 CHECKPOINT 8: Final Handoff
    crate::graphics::write_result_to_screen(8, "BOOT 8: KERNEL HANDOFF TO SCHEDULER...", 0x0B);

    loop { x86_64::instructions::hlt(); }
}

pub fn transmit_packet(data: &[u8]) { crate::e1000::send_packet(data); }

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    crate::graphics::write_result_to_screen(24, "KERNEL PANIC! SYSTEM HALTED.", 0x04);
    loop { x86_64::instructions::hlt(); }
}