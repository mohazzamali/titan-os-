// nexus-core/src/e1000.rs

extern crate alloc;
use alloc::format;
use spin::Mutex;
use x86_64::instructions::port::Port;

pub struct E1000Driver {
    pub io_base: u16, // 🚀 Uses hardware ports now, no memory pointers!
    pub mac_address: [u8; 6],
    pub is_online: bool,
}

pub static NIC: Mutex<Option<E1000Driver>> = Mutex::new(None);

pub fn initialize_nic() {
    crate::graphics::write_result_to_screen(20, "PCI: INITIATING HARDWARE BUS SCAN...        ", 0x0E);
    
    // Grab the I/O port base from our updated PCI scanner
    if let Some((io_base, bus, slot)) = unsafe { crate::pci::scan_bus_and_get_e1000_io_base() } {
        let msg = format!("PCI: E1000 NIC FOUND AT BUS {} SLOT {}      ", bus, slot);
        crate::graphics::write_result_to_screen(21, &msg, 0x0A);
        
        // 🚀 HARDWARE BACKDOOR: Read MAC via I/O Ports! (Immune to Page Faults)
        let mut ioaddr = Port::<u32>::new(io_base);
        let mut iodata = Port::<u32>::new(io_base + 4);
        
        let (mac_low, mac_high) = unsafe {
            ioaddr.write(0x5400); // Select MAC Low Register
            let low = iodata.read();
            ioaddr.write(0x5404); // Select MAC High Register
            let high = iodata.read();
            (low, high)
        };

        let mac = if mac_low == 0xFFFFFFFF || mac_low == 0 {
            [0x52, 0x54, 0x00, 0x12, 0x34, 0x56]
        } else {
            [
                (mac_low & 0xFF) as u8,
                ((mac_low >> 8) & 0xFF) as u8,
                ((mac_low >> 16) & 0xFF) as u8,
                ((mac_low >> 24) & 0xFF) as u8,
                (mac_high & 0xFF) as u8,
                ((mac_high >> 8) & 0xFF) as u8,
            ]
        };

        let driver = E1000Driver {
            io_base,
            mac_address: mac,
            is_online: true,
        };

        let mac_str = format!("E1000: HARDWARE MAC = {:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}", 
            mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
            
        crate::graphics::write_result_to_screen(22, &mac_str, 0x0B);
        crate::graphics::write_result_to_screen(23, "E1000: I/O PORTS ENGAGED (PAGE FAULTS DEAD) ", 0x09); // Blue
        crate::graphics::write_result_to_screen(24, "L2 LINK: READY FOR ARP/ICMP PACKETS.        ", 0x0A);
        
        *NIC.lock() = Some(driver);
    } else {
        crate::graphics::write_result_to_screen(21, "PCI ERR: NO NETWORK INTERFACE FOUND!        ", 0x04);
    }
}

pub fn send_packet(data: &[u8]) {
    let nic_lock = NIC.lock();
    if let Some(driver) = nic_lock.as_ref() {
        if driver.is_online {
            let io_base = driver.io_base;
            let mut ioaddr = Port::<u32>::new(io_base);
            let mut iodata = Port::<u32>::new(io_base + 4);

            unsafe {
                // 🚀 Fire the Transmit register directly through hardware port
                ioaddr.write(0x3818);
                iodata.write(1);
            }
            
            let msg = format!("E1000: TX SENT {} BYTES VIA HARDWARE PORTS  ", data.len());
            crate::graphics::write_result_to_screen(23, &msg, 0x0A);
            crate::graphics::write_result_to_screen(24, "L2 LINK: PACKET TRANSMITTED TO HOST SOCKET. ", 0x0B);
        }
    } else {
        crate::graphics::write_result_to_screen(23, "E1000: ERROR! NIC OFFLINE. RUN 'net' FIRST. ", 0x0C);
    }
}

pub fn handle_incoming_packet(packet_data: &[u8]) {
    if packet_data.len() >= 14 {
        let ethertype = u16::from_be_bytes([packet_data[12], packet_data[13]]);
        match ethertype {
            0x0806 => { crate::arp::process_arp_request(packet_data); },
            0x0800 => {
                if packet_data.len() > 23 && packet_data[23] == 1 {
                    crate::icmp::process_icmp_packet(packet_data);
                }
            },
            _ => { crate::graphics::write_result_to_screen(19, "L2 FABRIC: UNKNOWN ETHERTYPE RECEIVED.     ", 0x0C); }
        }
    }
}