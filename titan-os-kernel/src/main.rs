#![no_std]
#![no_main]
#![allow(warnings)]

mod vga;
mod pci;
mod e1000;

use core::panic::PanicInfo;
use bootloader::BootInfo;
use x86_64::instructions::port::Port;

// 🚀 THE MISSING KEY: Forcing the Motherboard to allow DMA for this PCI device!
unsafe fn enable_pci_bus_mastering(bus: u8, dev: u8, func: u8) {
    let mut addr_port = Port::<u32>::new(0xCF8);
    let mut data_port = Port::<u32>::new(0xCFC);

    // Calculate PCI Configuration Address
    let address = 0x80000000 | ((bus as u32) << 16) | ((dev as u32) << 11) | ((func as u32) << 8) | 0x04;
    
    // Read current Command Register
    addr_port.write(address);
    let command = data_port.read();

    // Enable Bit 2 (Bus Master) and write it back
    addr_port.write(address);
    data_port.write(command | 0x0004); 
}

#[unsafe(no_mangle)]
pub extern "C" fn _start(boot_info: &'static BootInfo) -> ! {
    vga::clear_screen();
    vga::print(0, "==================================================", 0x0B); 
    vga::print(1, " TITAN OS v3.0 (PRODUCTION BARE-METAL CORE)", 0x0A); 
    vga::print(2, "==================================================", 0x0B);
    
    let phys_offset = boot_info.physical_memory_offset;
    
    vga::print(4, "[SYS] Booting Hardware Orchestrator...", 0x0F);
    
    // We now capture bus, dev, and func from your PCI scanner
    if let Some((bus, dev, func, io_base)) = pci::find_e1000() {
        
        // 🚀 UNLOCK DMA PERMISSIONS BEFORE INITIALIZING E1000
        unsafe { enable_pci_bus_mastering(bus, dev, func); }
        
        e1000::init(io_base as usize, phys_offset);
        e1000::enable_tx_rx(); 
        
        for _ in 0..5_000_000 { core::hint::spin_loop(); }
        e1000::send_packet();
        
        vga::print(13, ">> SYSTEM HALTED: AWAITING INBOUND PACKETS <<", 0x0C);
    } else {
        vga::print(6, "[ERR] Intel E1000 Network Card not found!", 0x0C);
    }
    
    loop { e1000::poll(); }
}

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    vga::print(20, "KERNEL PANIC! SYSTEM HALTED.", 0x4F); 
    loop {}
}
