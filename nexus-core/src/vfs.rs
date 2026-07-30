// nexus-core/src/vfs.rs

extern crate alloc;
use alloc::string::String;
use alloc::vec::Vec;
use spin::Mutex;
use lazy_static::lazy_static;

#[derive(Clone)]
pub struct FileDescriptor {
    pub filename: String,
    pub data: Vec<u8>,
}

lazy_static! {
    pub static ref VIRTUAL_FS: Mutex<Vec<FileDescriptor>> = Mutex::new(Vec::new());
}

pub fn execute_external_app(filename: &str) {
    crate::graphics::write_result_to_screen(9, "VFS: INITIATING FILE FETCH PROTOCOL...    ", 0x0B);
    
    // 1. Send DMA request to NVMe (Using CONTROLLER to match nvme.rs)
    if let Some(file_data) = crate::nvme::read_block(1024, 4096) {
        crate::graphics::write_result_to_screen(10, "NVMe: EXECUTING DIRECT MEMORY ACCESS (DMA)", 0x0D);
        
        let fd = FileDescriptor {
            filename: String::from(filename),
            data: file_data.clone(),
        };
        VIRTUAL_FS.lock().push(fd);
        crate::graphics::write_result_to_screen(11, "VFS: FILE LOADED INTO DYNAMIC HEAP (RAM)  ", 0x0A);

        // 2. Handover to Sandbox (Passing correct &str and 2 arguments)
        crate::wasm_engine::execute_wasm(filename, &file_data);
    } else {
        crate::graphics::write_result_to_screen(10, "VFS ERROR: NVMe DRIVE OFFLINE!            ", 0x04);
    }
}