extern crate alloc;
use alloc::string::String;
use alloc::vec::Vec;
use lazy_static::lazy_static;
use spin::Mutex;

// 🚀 LOGICAL FILE ABSTRACTION
#[derive(Clone)]
pub struct NexusFile {
    pub name: String,
    pub data: Vec<u8>,
    pub size: usize,
}

// 🚀 THE IN-MEMORY FILE ALLOCATION TABLE (FAT)
lazy_static! {
    pub static ref NEXUS_FS: Mutex<Vec<NexusFile>> = Mutex::new(Vec::new());
}

pub fn init() {
    let mut fs = NEXUS_FS.lock();
    
    // 💾 Pre-loading Sector Memory into logical 'Files'
    fs.push(NexusFile {
        name: String::from("smart_contract.wasm"),
        data: alloc::vec![0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00, 0x0A, 0x04, 0x01],
        size: 11,
    });

    fs.push(NexusFile {
        name: String::from("neural_weights.bin"),
        data: alloc::vec![0x02, 0x64, 0x05, 0xFF, 0xA1],
        size: 5,
    });
}

// 🚀 SYSTEM CALLS FOR THE SHELL
pub fn list_files() -> Vec<(String, usize)> {
    let fs = NEXUS_FS.lock();
    fs.iter().map(|f| (f.name.clone(), f.size)).collect()
}

pub fn read_file(name: &str) -> Option<Vec<u8>> {
    let fs = NEXUS_FS.lock();
    for f in fs.iter() {
        if f.name == name {
            return Some(f.data.clone());
        }
    }
    None
}

// 🚀 COMPATIBILITY FIX: For the old 'deploy' command in shell.rs
pub fn load_file_from_disk(name: &str) -> Option<NexusFile> {
    let fs = NEXUS_FS.lock();
    for f in fs.iter() {
        if f.name == name {
            return Some(f.clone());
        }
    }
    None
}
