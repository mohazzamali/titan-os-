use x86_64::instructions::port::Port;
extern crate alloc;
use alloc::vec::Vec;

const CONFIG_ADDRESS: u16 = 0xCF8;
const CONFIG_DATA: u16 = 0xCFC;

#[derive(Debug, Clone, Copy)]
pub struct PciDevice {
    pub bus: u8,
    pub device: u8,
    pub vendor_id: u16,
    pub device_id: u16,
    pub class_id: u8,
}

// 🚀 EXPOSED TO E1000.RS
pub fn read_pcie_u32(bus: u8, device: u8, func: u8, offset: u8) -> u32 {
    let address = 1u32 << 31 
        | ((bus as u32) << 16) 
        | ((device as u32) << 11) 
        | ((func as u32) << 8) 
        | (offset as u32 & 0xFC);
    
    unsafe {
        let mut port_addr = Port::<u32>::new(CONFIG_ADDRESS);
        let mut port_data = Port::<u32>::new(CONFIG_DATA);
        
        port_addr.write(address);
        port_data.read()
    }
}

// 🚀 PHASE 1: THE ENUMERATION ALGORITHM
pub fn scan_buses() -> Vec<PciDevice> {
    let mut devices = Vec::new();
    
    for bus in 0..=255 {
        for device in 0..32 {
            let id_reg = read_pcie_u32(bus, device, 0, 0);
            let vendor_id = (id_reg & 0xFFFF) as u16;
            
            if vendor_id != 0xFFFF {
                let class_reg = read_pcie_u32(bus, device, 0, 0x08);
                let class_id = ((class_reg >> 24) & 0xFF) as u8;
                let device_id = ((id_reg >> 16) & 0xFFFF) as u16;
                
                devices.push(PciDevice {
                    bus, device, vendor_id, device_id, class_id
                });
            }
        }
    }
    devices
}

// 🚀 LEGACY COMPATIBILITY
pub fn scan_bus_and_get_e1000_io_base() -> Option<(u32, u8, u8)> {
    for bus in 0..=255 {
        for device in 0..32 {
            let id_reg = read_pcie_u32(bus, device, 0, 0);
            let vendor_id = (id_reg & 0xFFFF) as u16;
            let device_id = ((id_reg >> 16) & 0xFFFF) as u16;
            
            if vendor_id == 0x8086 && device_id == 0x100E {
                let bar0 = read_pcie_u32(bus, device, 0, 0x10);
                return Some((bar0, bus, device));
            }
        }
    }
    None
}
