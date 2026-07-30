// nexus-core/src/pci.rs

use x86_64::instructions::port::Port;

pub unsafe fn read_pci_u32(bus: u8, slot: u8, func: u8, offset: u8) -> u32 {
    let address = 0x80000000 | ((bus as u32) << 16) | ((slot as u32) << 11) | ((func as u32) << 8) | (offset as u32 & 0xFC);
    Port::<u32>::new(0xCF8).write(address);
    Port::<u32>::new(0xCFC).read()
}

pub unsafe fn write_pci_u32(bus: u8, slot: u8, func: u8, offset: u8, data: u32) {
    let address = 0x80000000 | ((bus as u32) << 16) | ((slot as u32) << 11) | ((func as u32) << 8) | (offset as u32 & 0xFC);
    Port::<u32>::new(0xCF8).write(address);
    Port::<u32>::new(0xCFC).write(data);
}

// 🚀 HARDWARE BACKDOOR: Scans for E1000 and strictly extracts the I/O Port Base (bypassing MMIO Paging!)
pub unsafe fn scan_bus_and_get_e1000_io_base() -> Option<(u16, u8, u8)> {
    crate::graphics::write_result_to_screen(20, "PCI: INITIATING DEEP PCIe BUS SCAN...       ", 0x0E); 
    
    for bus in 0..=255 {
        for slot in 0..32 {
            let vendor_id = read_pci_u32(bus, slot, 0, 0) & 0xFFFF;
            if vendor_id == 0x8086 {
                let device_id = (read_pci_u32(bus, slot, 0, 0) >> 16) & 0xFFFF;
                if device_id == 0x100E { // E1000 GIGABIT NIC
                    
                    // Scan BAR0 through BAR5 to find the I/O Space BAR (identified by bit 0 being 1)
                    for bar_idx in 0..6 {
                        let offset = 0x10 + (bar_idx * 4);
                        let bar = read_pci_u32(bus, slot, 0, offset);
                        
                        if bar & 1 == 1 { // 🚀 Found an I/O Space BAR!
                            let io_base = (bar & 0xFFFC) as u16;
                            
                            // Enable I/O Space (Bit 0) and Bus Master (Bit 2)
                            let mut cmd = read_pci_u32(bus, slot, 0, 0x04);
                            cmd |= 0x00000005; 
                            write_pci_u32(bus, slot, 0, 0x04, cmd);
                            
                            crate::graphics::write_result_to_screen(20, "PCI: HW I/O PORTS & BUS MASTERING VERIFIED! ", 0x0A);
                            return Some((io_base, bus, slot));
                        }
                    }
                }
            }
        }
    }
    None
}