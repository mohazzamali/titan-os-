// nexus-core/src/pci.rs
#![allow(dead_code)]

use x86_64::instructions::port::Port;

const CONFIG_ADDRESS: u16 = 0xCF8;
const CONFIG_DATA: u16 = 0xCFC;

pub const INTEL_VEND_ID: u16 = 0x8086;
pub const E1000_DEV_ID: u16 = 0x100E;

pub struct PCIDevice {
    pub bus: u8, pub device: u8, pub function: u8,
    pub vendor_id: u16, pub device_id: u16, pub bar0: u32,
}

pub fn read_config_register(bus: u8, device: u8, function: u8, offset: u8) -> u32 {
    let address = 0x80000000 | ((bus as u32) << 16) | ((device as u32) << 11) | ((function as u32) << 8) | (offset as u32 & 0xFC);
    unsafe {
        let mut addr_port = Port::<u32>::new(CONFIG_ADDRESS);
        let mut data_port = Port::<u32>::new(CONFIG_DATA);
        addr_port.write(address);
        data_port.read()
    }
}

pub fn write_config_register(bus: u8, device: u8, function: u8, offset: u8, value: u32) {
    let address = 0x80000000 | ((bus as u32) << 16) | ((device as u32) << 11) | ((function as u32) << 8) | (offset as u32 & 0xFC);
    unsafe {
        let mut addr_port = Port::<u32>::new(CONFIG_ADDRESS);
        let mut data_port = Port::<u32>::new(CONFIG_DATA);
        addr_port.write(address);
        data_port.write(value);
    }
}

pub fn check_device(bus: u8, device: u8, function: u8) -> Option<PCIDevice> {
    let reg0 = read_config_register(bus, device, function, 0x00);
    let vendor_id = (reg0 & 0xFFFF) as u16;
    if vendor_id == 0xFFFF { return None; } 
    let device_id = ((reg0 >> 16) & 0xFFFF) as u16;
    let bar0 = read_config_register(bus, device, function, 0x10);
    Some(PCIDevice { bus, device, function, vendor_id, device_id, bar0 })
}

pub fn scan_buses() -> Option<PCIDevice> {
    for bus in 0..=255 {
        for device in 0..32 {
            if let Some(pci_dev) = check_device(bus, device, 0) {
                if pci_dev.vendor_id == INTEL_VEND_ID && pci_dev.device_id == E1000_DEV_ID {
                    let log = alloc::format!("[PCI] E1000 Gigabit NIC Found! (Bus: {}, Dev: {})", bus, device);
                    crate::graphics::update_terminal_log(&log, 2);
                    
                    // 🚀 THE FIX: Enable Memory Space (Bit 1) + Bus Mastering DMA (Bit 2)
                    let reg4 = read_config_register(bus, device, 0, 0x04);
                    write_config_register(bus, device, 0, 0x04, reg4 | 0x0006);
                    return Some(pci_dev);
                }
            }
        }
    }
    None
}