// nexus-core/src/pci_ecam.rs
#![allow(dead_code)]
extern crate alloc;
use alloc::vec::Vec;
use x86_64::instructions::port::Port;

const CONFIG_ADDRESS: u16 = 0xCF8;
const CONFIG_DATA: u16 = 0xCFC;

#[derive(Debug, Clone, Copy)]
pub struct PciDevice {
    pub bus: u8,
    pub device: u8,
    pub function: u8,
    pub vendor_id: u16,
    pub device_id: u16,
    pub class_id: u8,
    pub subclass_id: u8,
}

pub fn read_pci_register(bus: u8, slot: u8, func: u8, offset: u8) -> u32 {
    let address = 1u32 << 31
        | ((bus as u32) << 16)
        | ((slot as u32) << 11)
        | ((func as u32) << 8)
        | (offset as u32 & 0xFC);
    
    unsafe {
        let mut port_addr = Port::<u32>::new(CONFIG_ADDRESS);
        let mut port_data = Port::<u32>::new(CONFIG_DATA);
        port_addr.write(address);
        port_data.read()
    }
}

pub fn write_pci_register(bus: u8, slot: u8, func: u8, offset: u8, value: u32) {
    let address = 1u32 << 31
        | ((bus as u32) << 16)
        | ((slot as u32) << 11)
        | ((func as u32) << 8)
        | (offset as u32 & 0xFC);
    
    unsafe {
        let mut port_addr = Port::<u32>::new(CONFIG_ADDRESS);
        let mut port_data = Port::<u32>::new(CONFIG_DATA);
        port_addr.write(address);
        port_data.write(value);
    }
}

// 🚀 ADVANCED MSI-X CAPability PARSER & ACTIVATOR
pub fn enable_msix_for_device(bus: u8, device: u8, function: u8) {
    let capability_pointer = 0x34;
    let status = read_pci_register(bus, device, function, capability_pointer);
    let mut cap_offset = (status & 0xFF) as u8;

    while cap_offset != 0 {
        let header = read_pci_register(bus, device, function, cap_offset);
        let cap_id = (header & 0xFF) as u8;

        // MSI-X Capability ID is 0x11
        if cap_id == 0x11 {
            crate::graphics::write_result_to_screen(8, "MSI-X: CAPABILITY STRUCTURE DETECTED ON BUS.", 0x0A);
            
            // Read MSI-X Control Register (Offset +2 from capability base)
            let control_offset = cap_offset + 2;
            let control_val = read_pci_register(bus, device, function, control_offset);
            
            // Enable MSI-X (Bit 31: MSI-X Enable) and clear Table Mask (Bit 30)
            let new_control = control_val | (1 << 31) & !(1 << 30);
            write_pci_register(bus, device, function, control_offset, new_control);
            
            crate::graphics::write_result_to_screen(9, "MSI-X: ZERO-LATENCY INTERRUPTS ENABLED!   ", 0x0A);
            return;
        }

        cap_offset = ((header >> 8) & 0xFF) as u8;
    }
}

pub fn scan_pcie_bus() -> Vec<PciDevice> {
    let mut devices = Vec::new();
    for bus in 0..=5 {
        for device in 0..32 {
            for function in 0..8 {
                let id_reg = read_pci_register(bus, device, function, 0x00);
                let vendor_id = (id_reg & 0xFFFF) as u16;
                if vendor_id == 0xFFFF { 
                    if function == 0 { break; } 
                    continue; 
                }

                let device_id = ((id_reg >> 16) & 0xFFFF) as u16;
                let class_reg = read_pci_register(bus, device, function, 0x08);
                let class_id = ((class_reg >> 24) & 0xFF) as u8;
                let subclass_id = ((class_reg >> 16) & 0xFF) as u8;

                // If this is the E1000 Network Card (Intel 8086:100E), activate MSI-X on it!
                if vendor_id == 0x8086 && device_id == 0x100E {
                    enable_msix_for_device(bus, device, function);
                }

                devices.push(PciDevice {
                    bus, device, function, vendor_id, device_id, class_id, subclass_id
                });
            }
        }
    }
    devices
}

pub fn init_pcie_ecam() {
    crate::graphics::write_result_to_screen(7, "HW: SCANNING PCIE & CONFIGURING MSI-X...    ", 0x0E);
    let _devices = scan_pcie_bus();
}