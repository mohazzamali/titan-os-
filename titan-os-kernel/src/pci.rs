use x86_64::instructions::port::Port;

pub fn read_config(bus: u8, device: u8, func: u8, offset: u8) -> u32 {
    let addr = 0x80000000 | ((bus as u32) << 16) | ((device as u32) << 11) | ((func as u32) << 8) | (offset as u32 & 0xFC);
    unsafe {
        let mut addr_port = Port::<u32>::new(0xCF8);
        let mut data_port = Port::<u32>::new(0xCFC);
        addr_port.write(addr);
        data_port.read()
    }
}

pub fn write_config(bus: u8, device: u8, func: u8, offset: u8, value: u32) {
    let addr = 0x80000000 | ((bus as u32) << 16) | ((device as u32) << 11) | ((func as u32) << 8) | (offset as u32 & 0xFC);
    unsafe {
        let mut addr_port = Port::<u32>::new(0xCF8);
        let mut data_port = Port::<u32>::new(0xCFC);
        addr_port.write(addr);
        data_port.write(value);
    }
}

pub fn find_e1000() -> Option<(u8, u8, u8, u32)> {
    for bus in 0..=255 {
        for dev in 0..32 {
            let reg0 = read_config(bus, dev, 0, 0x00);
            let vendor = (reg0 & 0xFFFF) as u16;
            if vendor == 0xFFFF { continue; }
            let device = ((reg0 >> 16) & 0xFFFF) as u16;
            
            if vendor == 0x8086 && device == 0x100E {
                let mut io_base = 0;
                // 🚀 THE FIX: Scan for the I/O Port backdoor (Bit 0 == 1)
                for offset in [0x10, 0x14, 0x18, 0x1C, 0x20, 0x24] {
                    let bar = read_config(bus, dev, 0, offset);
                    if (bar & 1) == 1 { 
                        io_base = bar & 0xFFFFFFFC; // Strip the flags to get pure Port Address
                        break;
                    }
                }
                
                // Enable I/O Space (Bit 0), Memory Space (Bit 1), and Bus Mastering (Bit 2)
                let cmd_reg = read_config(bus, dev, 0, 0x04);
                write_config(bus, dev, 0, 0x04, cmd_reg | 0x0007);
                
                return Some((bus, dev, 0, io_base));
            }
        }
    }
    None
}
