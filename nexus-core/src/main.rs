// nexus-core/src/main.rs

#![no_std]
#![no_main]
#![feature(abi_x86_interrupt)] 

extern crate alloc; 

// nexus-core/src/main.rs ke top par check kijiye:

pub mod graphics;
pub mod smp;
pub mod scheduler; 
pub mod spinlock;
pub mod identity;
pub mod vfs;           
pub mod allocator;
pub mod interrupts;
pub mod gdt;
pub mod nvme;          
pub mod fabric;
pub mod consensus;
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

// 🚀 ADD THIS MISSING LINE:
pub mod pci;

use bootloader::{entry_point, BootInfo};
use core::panic::PanicInfo;

entry_point!(kernel_main);

// nexus-core/src/main.rs ke andar task_loader ko replace karein:

fn task_loader() {
    // 1. Sirf Disk ko boot par on karenge
    crate::nvme::initialize_nvme();
    
    // 2. Ab app auto-load NAHI hogi. Yeh daemon ab background mein so jayega.
    loop { 
        for _ in 0..100_000_000 { core::hint::spin_loop(); } 
    }
}

fn task_alpha() {
    let mut counter = 0;
    loop {
        let msg = alloc::format!("TASK ALPHA: RUNNING... [{}]  ", counter);
        crate::graphics::write_result_to_screen(19, &msg, 0x0B); 
        counter += 1;
        for _ in 0..5_000_000 { core::hint::spin_loop(); }
    }
}

fn task_beta() {
    let mut counter = 0;
    loop {
        let msg = alloc::format!("TASK BETA: RUNNING... [{}]   ", counter);
        crate::graphics::write_result_to_screen(20, &msg, 0x0B); 
        counter += 1;
        for _ in 0..5_000_000 { core::hint::spin_loop(); }
    }
}

fn task_network_daemon() {
    let mut packet_counter = 0;
    loop {
        let peer_count = crate::kademlia::get_peer_count();
        let msg = alloc::format!("KADEMLIA: PORT 9999 [PKT:{}] [PEERS:{}]", packet_counter, peer_count);
        crate::graphics::write_result_to_screen(21, &msg, 0x03); 
        
        let fake_peer = crate::kademlia::PeerNode { 
            id: crate::kademlia::NodeId([packet_counter as u8; 20]), 
            ip: [192, 168, 1, packet_counter as u8],
            port: 9999
        };
        crate::kademlia::add_peer(fake_peer);

        packet_counter += 1;
        for _ in 0..10_000_000 { core::hint::spin_loop(); } 
    }
}

fn task_dashboard() {
    loop {
        crate::dashboard::render_nexus_brain();
        for _ in 0..20_000_000 { core::hint::spin_loop(); } 
    }
}

fn kernel_main(_boot_info: &'static BootInfo) -> ! {
    crate::gdt::init(); 
    crate::interrupts::init_idt();
    crate::allocator::init_heap();
    unsafe { crate::interrupts::PICS.lock().initialize() };
    crate::syscall::init_syscalls();
    crate::smp::wake_up_aps();

    crate::graphics::write_result_to_screen(0, "[ NEXUS TITAN OS - THE MATRIX HYPERVISOR ]", 0x09);
    crate::graphics::write_result_to_screen(2, "SYSTEM: ALL SYSTEMS GO. IGNITING ENGINE...", 0x0E);

    crate::scheduler::add_task(task_loader);
    crate::scheduler::add_task(task_alpha);
    crate::scheduler::add_task(task_beta);
    crate::scheduler::add_task(task_network_daemon);
    crate::scheduler::add_task(task_dashboard);
    crate::scheduler::add_task(crate::shell::task_shell);
    crate::timer::configure_pit(1000);
    x86_64::instructions::interrupts::enable();
    
    loop { x86_64::instructions::hlt(); }
}

pub fn transmit_packet(data: &[u8]) { crate::e1000::send_packet(data); }

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    crate::graphics::write_result_to_screen(24, "KERNEL PANIC! SYSTEM HALTED.", 0x04);
    crate::graphics::flush_to_monitor();
    loop { x86_64::instructions::hlt(); }
}