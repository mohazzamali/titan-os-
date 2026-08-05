// nexus-core/src/main.rs
#![no_std]
#![no_main]
#![feature(abi_x86_interrupt)]

extern crate alloc;

pub mod spinlock;
pub mod pci;
pub mod memory;
pub mod vfs;

pub mod graphics;
pub mod e1000;
pub mod network;
pub mod wasm_engine;
pub mod crypto;
pub mod disk;
pub mod consensus;
pub mod tokenomics;
pub mod identity; // 🚀 ADDED IDENTITY MODULE
pub mod fabric;   // 🚀 ADDED FABRIC MODULE

pub mod interrupts;
pub mod gdt;
pub mod allocator;
pub mod fat32;
pub mod usermode;
pub mod pci_ecam;
pub mod kademlia;

use bootloader::{entry_point, BootInfo};
use x86_64::{VirtAddr, PhysAddr};

entry_point!(kernel_main);

fn kernel_main(boot_info: &'static BootInfo) -> ! {
    graphics::write_result_to_screen(0, "BOOT 0: KERNEL ENTRY SUCCESSFUL...          ", 0x0A);

    gdt::init_gdt();
    usermode::init_syscall_hardware();
    pci_ecam::init_pcie_ecam();
    kademlia::init_dht_routing();
    consensus::init_pbft_engine();
    tokenomics::init_crypto_economy();
    identity::init_identity(); // 🚀 INITIALIZE ZERO-TRUST ID
    graphics::write_result_to_screen(1, "BOOT 1: GDT & TSS INITIALIZED...            ", 0x0A);

    interrupts::init_idt();
    interrupts::init_pics();
    graphics::write_result_to_screen(2, "BOOT 2: HARDWARE INTERRUPTS & IDT ACTIVE... ", 0x0A);

    let phys_mem_offset = VirtAddr::new(boot_info.physical_memory_offset);
    let mut mapper = unsafe { memory::init(phys_mem_offset) };
    let mut frame_allocator = unsafe { memory::BootInfoFrameAllocator::init(&boot_info.memory_map) };
    
    let _ = memory::map_mmio(PhysAddr::new(0xFEBC0000), &mut mapper, &mut frame_allocator);

    allocator::init_kernel_heap();
    graphics::write_result_to_screen(3, "BOOT 3: DYNAMIC HEAP ALLOCATOR READY...     ", 0x0A);

    e1000::init_dma_network();
    network::init();
    graphics::write_result_to_screen(4, "BOOT 4: E1000 NETWORK & DPI FIREWALL ONLINE.", 0x0A);

    if let Some(_volume) = fat32::mount_volume() {
        graphics::write_result_to_screen(5, "BOOT 5: FAT32 VFS MOUNTED ON ATA BUS...     ", 0x0A);
    } else {
        graphics::write_result_to_screen(5, "BOOT 5: VFS BYPASSED (RAW DISK MODE ACTIVE).  ", 0x0E);
    }

    graphics::write_result_to_screen(7, "SYS: NEXUS OS AWAITING HARDWARE INTERRUPTS. ", 0x0B);

    loop {
        network::poll();
        x86_64::instructions::hlt(); 
    }
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    graphics::write_result_to_screen(24, "KERNEL PANIC: FATAL SYSTEM ERROR HALTED OS. ", 0x04);
    loop { x86_64::instructions::hlt(); }
}