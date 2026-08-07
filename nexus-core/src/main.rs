#![no_std]
#![no_main]
#![feature(abi_x86_interrupt)]

extern crate alloc;

pub mod spinlock;
pub mod pci;
pub mod memory;
pub mod vfs;
pub mod pci_ecam;
pub mod kademlia;
pub mod gnn; 
pub mod scheduler; 
pub mod privacy; // 🚀 LAYER 5: NEW MODULE ADDED
pub mod graphics;
pub mod e1000;
pub mod network;
pub mod wasm_engine;
pub mod crypto;
pub mod disk;
pub mod consensus;
pub mod tokenomics;
pub mod identity;
pub mod fabric;
pub mod interrupts;
pub mod gdt;
pub mod allocator;
pub mod fat32;
pub mod usermode;

use bootloader::{entry_point, BootInfo};
use x86_64::{VirtAddr, PhysAddr};

entry_point!(kernel_main);

fn kernel_main(boot_info: &'static BootInfo) -> ! {
    graphics::write_result_to_screen(0, "BOOT 0: KERNEL ENTRY SUCCESSFUL...          ", 0x0A);
    gdt::init_gdt();
    usermode::init_syscall_hardware();
    graphics::write_result_to_screen(1, "BOOT 1: GDT & TSS INITIALIZED...            ", 0x0A);
    interrupts::init_idt();
    graphics::write_result_to_screen(2, "BOOT 2: HARDWARE INTERRUPTS & IDT ACTIVE... ", 0x0A);

    let phys_mem_offset = VirtAddr::new(boot_info.physical_memory_offset);
    let mut mapper = unsafe { memory::init(phys_mem_offset) };
    let mut frame_allocator = unsafe { memory::BootInfoFrameAllocator::init(&boot_info.memory_map) };
    let _ = memory::map_mmio(PhysAddr::new(0xFEBC0000), &mut mapper, &mut frame_allocator);

    allocator::init_kernel_heap();
    graphics::write_result_to_screen(3, "BOOT 3: DYNAMIC HEAP ALLOCATOR READY...     ", 0x0A);
    pci_ecam::init_pcie_ecam();
    graphics::write_result_to_screen(4, "BOOT 4: VIRTUAL NETWORK & DPI SECURED.      ", 0x0A);

    if let Some(_volume) = fat32::mount_volume() {
        graphics::write_result_to_screen(5, "BOOT 5: FAT32 VFS MOUNTED ON ATA BUS...     ", 0x0A);
    } else {
        graphics::write_result_to_screen(5, "BOOT 5: VFS BYPASSED (RAW DISK MODE ACTIVE).  ", 0x0E);
    }
    
    consensus::init_pbft_engine();
    tokenomics::init_crypto_economy();
    wasm_engine::init_wasm_sandbox();
    identity::init_identity(); 
    kademlia::init_dht_routing();
    kademlia::ping_genesis_node();
    interrupts::init_pics();
    
    graphics::write_result_to_screen(15, "SYS: NEXUS OS FULLY OPERATIONAL. AWAITING TASKS.", 0x0B);

    let mut tick: u64 = 0;
    loop {
        tick = tick.wrapping_add(1);
        
        // 🚀 LAYER 4: THE SCHEDULER
        if tick == 50 {
            scheduler::broadcast_ncip_passport();
            scheduler::evaluate_and_prune_dag();
        }

        // 🚀 LAYER 5: ABSOLUTE PRIVACY (zkVM / FHE)
        if tick == 75 {
            privacy::execute_l3_zk_compute();
        }

        // 🚀 THE DREAMING LAYER
        if tick == 100 { 
            gnn::execute_dream_cycle();
        }

        // 🚀 THE INTERNAL INJECTION (Tick 200)
        if tick == 200 {
            let mut sim_frame = [0u8; 128];
            sim_frame[0..6].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); 
            sim_frame[6..12].copy_from_slice(&[0x52, 0x54, 0x00, 0x99, 0x99, 0x99]); 
            sim_frame[12] = 0x88; sim_frame[13] = 0xB5; 
            sim_frame[14] = 0x03; 
            sim_frame[15..19].copy_from_slice(&[0x00, 0x61, 0x73, 0x6D]); 
            sim_frame[19..23].copy_from_slice(&[0x01, 0x00, 0x00, 0x00]); 
            fabric::process_incoming_frame(&sim_frame);
        }
        
        let mut delay = 0;
        while delay < 1000000 { delay += 1; } 
    }
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    x86_64::instructions::interrupts::disable();
    graphics::write_result_to_screen(24, "KERNEL PANIC: FATAL SYSTEM ERROR HALTED OS. ", 0x04);
    loop {}
}
