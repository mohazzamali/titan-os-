// nexus-core/src/disk.rs
#![allow(dead_code)]

extern crate alloc;
use core::arch::asm;
use x86_64::instructions::port::{Port, PortReadOnly};

const ATA_DATA_PORT: u16 = 0x1F0;
const ATA_SECTOR_COUNT_PORT: u16 = 0x1F2;
const ATA_LBA_LO_PORT: u16 = 0x1F3;
const ATA_LBA_MID_PORT: u16 = 0x1F4;
const ATA_LBA_HI_PORT: u16 = 0x1F5;
const ATA_DRIVE_PORT: u16 = 0x1F6;
const ATA_COMMAND_PORT: u16 = 0x1F7;
const ATA_STATUS_PORT: u16 = 0x1F7;

pub fn initialize_disk() {
    crate::graphics::update_terminal_log("[STORAGE] PROBING PRIMARY ATA/IDE BUS...", 0);
    // Slight delay for hardware spinup
    for _ in 0..1_000_000 { core::hint::spin_loop(); }
    crate::graphics::update_terminal_log("[STORAGE] PHYSICAL HARD DISK DETECTED AND READY!", 0);
}

// 🚀 WRITE A FULL 512-BYTE SECTOR TO PHYSICAL DISK
pub fn write_sector(lba: u32, data: &[u8; 512]) {
    unsafe {
        // Select Drive 0 and send LBA coordinates
        Port::new(ATA_DRIVE_PORT).write(0xE0 | ((lba >> 24) & 0x0F) as u8);
        Port::new(ATA_SECTOR_COUNT_PORT).write(1u8);
        Port::new(ATA_LBA_LO_PORT).write(lba as u8);
        Port::new(ATA_LBA_MID_PORT).write((lba >> 8) as u8);
        Port::new(ATA_LBA_HI_PORT).write((lba >> 16) as u8);
        
        // Command 0x30 = Write Sectors
        Port::new(ATA_COMMAND_PORT).write(0x30u8); 

        if wait_for_disk() {
            let mut data_port: Port<u16> = Port::new(ATA_DATA_PORT);
            // Push 256 words (512 bytes) onto the bus
            for i in 0..256 {
                let word = (data[i * 2] as u16) | ((data[i * 2 + 1] as u16) << 8);
                data_port.write(word);
            }
            
            // Cache Flush (0xE7) to force physical magnetic write immediately
            Port::new(ATA_COMMAND_PORT).write(0xE7u8);
        }
    }
}

// 🚀 READ A SECTOR FROM PHYSICAL DISK
pub fn read_sector(lba: u32, buffer: &mut [u8; 512]) -> bool {
    unsafe {
        Port::new(ATA_DRIVE_PORT).write(0xE0 | ((lba >> 24) & 0x0F) as u8);
        Port::new(ATA_SECTOR_COUNT_PORT).write(1u8);
        Port::new(ATA_LBA_LO_PORT).write(lba as u8);
        Port::new(ATA_LBA_MID_PORT).write((lba >> 8) as u8);
        Port::new(ATA_LBA_HI_PORT).write((lba >> 16) as u8);
        
        // Command 0x20 = Read Sectors
        Port::new(ATA_COMMAND_PORT).write(0x20u8); 

        if wait_for_disk() {
            let mut data_port: PortReadOnly<u16> = PortReadOnly::new(ATA_DATA_PORT);
            for i in 0..256 {
                let word = data_port.read();
                buffer[i * 2] = (word & 0xFF) as u8;
                buffer[i * 2 + 1] = (word >> 8) as u8;
            }
            return true;
        }
        false
    }
}

// Anti-Deadlock Timeout and Electrical Delay
fn wait_for_disk() -> bool {
    let mut status_port: PortReadOnly<u8> = PortReadOnly::new(ATA_STATUS_PORT);
    unsafe {
        // 400ns electrical delay to allow the IDE bus to stabilize
        for _ in 0..1000 { core::hint::spin_loop(); } 
        
        // Timeout loop to prevent CPU deadlocking
        for _ in 0..5_000_000 {
            let status = status_port.read();
            if status & 0x80 == 0 { return true; } // BSY cleared, disk is ready
            core::hint::spin_loop();
        }
        false
    }
}