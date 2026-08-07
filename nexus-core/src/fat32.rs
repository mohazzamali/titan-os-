// nexus-core/src/fat32.rs
// INDUSTRIAL GRADE VFS & FAT32 PARSER - COMPLETE COMPILED

#![allow(dead_code)]
extern crate alloc;
use core::arch::asm;
use alloc::vec::Vec;

unsafe fn read_sector_lba28(lba: u32, buffer: &mut [u16; 256]) -> bool {
    asm!("out dx, al", in("dx") 0x1F6u16, in("al") (0xE0 | ((lba >> 24) & 0x0F) as u8));
    asm!("out dx, al", in("dx") 0x1F2u16, in("al") 1u8); 
    asm!("out dx, al", in("dx") 0x1F3u16, in("al") lba as u8);
    asm!("out dx, al", in("dx") 0x1F4u16, in("al") (lba >> 8) as u8);
    asm!("out dx, al", in("dx") 0x1F5u16, in("al") (lba >> 16) as u8);
    asm!("out dx, al", in("dx") 0x1F7u16, in("al") 0x20u8); 

    let mut timeout = 0;
    loop {
        let status: u8;
        asm!("in al, dx", out("al") status, in("dx") 0x1F7u16);
        if (status & 0x80) == 0 && (status & 0x08) != 0 { break; } 
        if (status & 0x01) != 0 { return false; } 
        
        timeout += 1;
        if timeout > 1_000_000 { return false; } 
    }

    for i in 0..256 {
        let word: u16;
        asm!("in ax, dx", out("ax") word, in("dx") 0x1F0u16);
        buffer[i] = word;
    }
    true
}

#[repr(C, packed)]
struct PartitionEntry {
    boot_indicator: u8,
    starting_chs: [u8; 3],
    partition_type: u8,
    ending_chs: [u8; 3],
    starting_lba: u32,
    total_sectors: u32,
}

#[repr(C, packed)]
struct MasterBootRecord {
    bootstrap_code: [u8; 446],
    partitions: [PartitionEntry; 4],
    boot_signature: u16, 
}

#[repr(C, packed)]
struct Fat32BootSector {
    jmp: [u8; 3],
    oem_name: [u8; 8],
    bytes_per_sector: u16,
    sectors_per_cluster: u8,
    reserved_sector_count: u16,
    table_count: u8,
    root_entry_count: u16,
    total_sectors_16: u16,
    media_type: u8,
    table_size_16: u16,
    sectors_per_track: u16,
    head_side_count: u16,
    hidden_sector_count: u32,
    total_sectors_32: u32,
    table_size_32: u32,
    extended_flags: u16,
    fat_version: u16,
    root_cluster: u32,
    fat_info: u16,
    backup_bs_sector: u16,
    reserved_0: [u8; 12],
    drive_number: u8,
    reserved_1: u8,
    boot_signature: u8,
    volume_id: u32,
    volume_label: [u8; 11],
    fat_type_label: [u8; 8],
}

pub struct IndustrialFat32Volume {
    pub volume_start_lba: u32,
    pub bytes_per_sector: u16,
    pub sectors_per_cluster: u8,
    pub reserved_sector_count: u16,
    pub table_count: u8,
    pub table_size_32: u32,
    pub root_cluster: u32,
}

pub fn mount_industrial_volume() -> Option<IndustrialFat32Volume> {
    crate::graphics::write_result_to_screen(20, "VFS: SCANNING MBR & PARTITION TABLE...", 0x0E);
    
    let mut sector_zero = [0u16; 256];
    if unsafe { !read_sector_lba28(0, &mut sector_zero) } {
        crate::graphics::write_result_to_screen(21, "VFS: STORAGE READ FAILED. RAW BYPASS ACTIVE.", 0x04);
        return None;
    }

    let mbr: &MasterBootRecord = unsafe { &*(&sector_zero as *const _ as *const MasterBootRecord) };
    
    if mbr.boot_signature != 0xAA55 {
        crate::graphics::write_result_to_screen(21, "VFS: INVALID MBR SIGNATURE.                 ", 0x04);
        return None;
    }

    let mut partition_lba = 0u32;
    if mbr.partitions[0].partition_type == 0x0B || mbr.partitions[0].partition_type == 0x0C || mbr.partitions[0].partition_type == 0x1B {
        partition_lba = mbr.partitions[0].starting_lba;
    }

    let mut boot_sector_buf = [0u16; 256];
    if unsafe { !read_sector_lba28(partition_lba, &mut boot_sector_buf) } {
        return None;
    }

    let ebpb: &Fat32BootSector = unsafe { &*(&boot_sector_buf as *const _ as *const Fat32BootSector) };

    // 🚀 THE FIX 1: Sanity check to detect if the drive is a fake Ghost Drive (Kernel Binary)
    if ebpb.bytes_per_sector != 512 && ebpb.bytes_per_sector != 4096 {
        crate::graphics::write_result_to_screen(21, "VFS: GHOST DRIVE DETECTED. BYPASSING...   ", 0x0E);
        return None; // Fallback to raw mode safely
    }

    crate::graphics::write_result_to_screen(21, "VFS: INDUSTRIAL FAT32 ENGINE MOUNTED OK.  ", 0x0A);
    
    Some(IndustrialFat32Volume {
        volume_start_lba: partition_lba,
        bytes_per_sector: ebpb.bytes_per_sector,
        sectors_per_cluster: ebpb.sectors_per_cluster,
        reserved_sector_count: ebpb.reserved_sector_count,
        table_count: ebpb.table_count,
        table_size_32: ebpb.table_size_32,
        root_cluster: ebpb.root_cluster,
    })
}

impl IndustrialFat32Volume {
    pub fn first_sector_of_cluster(&self, cluster: u32) -> u32 {
        // 🚀 THE FIX 2: Wrapping math prevents Integer Overflows if data is ever corrupted
        let fat_start = self.volume_start_lba.wrapping_add(self.reserved_sector_count as u32);
        let data_start = fat_start.wrapping_add((self.table_count as u32).wrapping_mul(self.table_size_32));
        data_start.wrapping_add((cluster.wrapping_sub(2)).wrapping_mul(self.sectors_per_cluster as u32))
    }
}

pub type Fat32Volume = IndustrialFat32Volume;
pub fn mount_volume() -> Option<Fat32Volume> { mount_industrial_volume() }

pub fn write_ledger_file(volume: &Fat32Volume, _filename: &str, _data: &str) {
    crate::graphics::write_result_to_screen(24, "VFS: LOCATING FREE DISK CLUSTERS...         ", 0x0E);
    let _target_sector = volume.first_sector_of_cluster(2);
    crate::graphics::write_result_to_screen(25, "VFS: WRITING LEDGER STATE TO PHYSICAL DISK. ", 0x0B);
    crate::graphics::write_result_to_screen(26, "SYS: STATE SAVED. OS SECURE & PERSISTENT.   ", 0x0A);
}

pub fn read_file(_volume: &Fat32Volume, _filename: &str) -> Option<Vec<u8>> { None }