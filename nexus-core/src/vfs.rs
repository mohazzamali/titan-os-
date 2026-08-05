// nexus-core/src/vfs.rs
extern crate alloc;
use alloc::string::String;
use alloc::vec::Vec;
use lazy_static::lazy_static;
use spin::Mutex;
use crate::fat32; // 🚀 Injecting Production Storage Engine

#[derive(Clone)]
pub struct NexusFile {
    pub name: String,
    pub data: Vec<u8>,
    pub size: usize,
}

lazy_static! {
    pub static ref NEXUS_FS: Mutex<Vec<NexusFile>> = Mutex::new(Vec::new());
}

// Fallback logic for systems without a formatted disk yet
#[used]
#[link_section = ".rodata"]
static FALLBACK_PAYLOAD: [u8; 40] = [
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 
    0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,       
    0x03, 0x02, 0x01, 0x00,                         
    0x07, 0x0b, 0x01, 0x07, 0x65, 0x78, 0x65, 0x63, 
    0x75, 0x74, 0x65, 0x00, 0x00, 
    0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x01, 0x0b  
];

pub fn init() {
    let mut fs = NEXUS_FS.lock();
    
    crate::graphics::write_result_to_screen(10, "STORAGE: INITIALIZING PRODUCTION FAT32 DRIVER...", 0x0E);
    
    // 🚀 Attempt to mount the physical disk natively
    if let Some(volume) = fat32::mount_volume() {
        if let Some(wasm_data) = fat32::read_file(&volume, "CONTRACT.WAS") {
            fs.push(NexusFile {
                name: String::from("smart_contract.wasm"),
                size: wasm_data.len(),
                data: wasm_data,
            });
            return; // Success! File loaded natively from physical sector.
        }
    }
    
    // If no valid FAT32 disk is attached yet, use the hypervisor fallback
    crate::graphics::write_result_to_screen(10, "STORAGE: NO FAT32 DETECTED. USING ROM FALLBACK. ", 0x08);
    fs.push(NexusFile { name: String::from("smart_contract.wasm"), size: 40, data: FALLBACK_PAYLOAD.to_vec() });
}

pub fn list_files() -> Vec<(String, usize)> {
    let fs = NEXUS_FS.lock();
    fs.iter().map(|f| (f.name.clone(), f.size)).collect()
}

pub fn read_file(name: &str) -> Option<Vec<u8>> {
    let fs = NEXUS_FS.lock();
    for f in fs.iter() {
        if f.name == name { return Some(f.data.clone()); }
    }
    None
}
