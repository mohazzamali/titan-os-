// nexus-core/src/vfs.rs
extern crate alloc;
use alloc::string::String;
use alloc::vec::Vec;
use lazy_static::lazy_static;
use spin::Mutex;

#[derive(Clone)]
pub struct NexusFile {
    pub name: String,
    pub data: Vec<u8>,
    pub size: usize,
}

lazy_static! {
    pub static ref NEXUS_FS: Mutex<Vec<NexusFile>> = Mutex::new(Vec::new());
}

#[used]
#[link_section = ".rodata"]
static DISK_PAYLOAD: [u8; 40] = [
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 
    0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,       
    0x03, 0x02, 0x01, 0x00,                         
    0x07, 0x0b, 0x01, 0x07, 0x65, 0x78, 0x65, 0x63, 
    0x75, 0x74, 0x65, 0x00, 0x00, 
    0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x01, 0x0b  
];

pub fn init() {
    let mut fs = NEXUS_FS.lock();
    let mut buffer = [0u8; 512]; 
    let mut found = false;
    
    // 🚀 V2.0 ROOT FIX: Optimized PIO Scan Range & Live Telemetry
    // QEMU traps Port I/O. We scan 25 sectors to bypass the emulator bottleneck.
    for lba in 100..125 {
        // Visual Ticker: Updates the screen live so you know it's not frozen!
        let msg = alloc::format!("STORAGE: SCANNING PHYSICAL DISK -> LBA {:04}  ", lba);
        crate::graphics::write_result_to_screen(10, &msg, 0x09); // Blue ticking text

        crate::nvme::read_sector(lba, &mut buffer);
        
        for i in 0..450 {
            if buffer[i] == 0x00 && buffer[i+1] == 0x61 && buffer[i+2] == 0x73 && buffer[i+3] == 0x6d {
                let mut wasm_data = Vec::new();
                wasm_data.extend_from_slice(&buffer[i..i+40]); 
                
                fs.push(NexusFile {
                    name: String::from("smart_contract.wasm"),
                    size: wasm_data.len(),
                    data: wasm_data,
                });
                
                let success_msg = alloc::format!("STORAGE: WASM PAYLOAD FOUND AT LBA {}!      ", lba);
                crate::graphics::write_result_to_screen(10, &success_msg, 0x0A);
                found = true;
                break;
            }
        }
        if found { break; }
    }
    
    if !found {
        crate::graphics::write_result_to_screen(10, "STORAGE: FALLBACK TO KERNEL VFS PAYLOAD...  ", 0x0E);
        fs.push(NexusFile { name: String::from("smart_contract.wasm"), size: 40, data: DISK_PAYLOAD.to_vec() });
    }
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
