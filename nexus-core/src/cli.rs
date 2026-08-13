extern crate alloc;
use alloc::string::{String, ToString};
use alloc::vec::Vec;
use crate::graphics::write_result_to_screen;
use pc_keyboard::{layouts, DecodedKey, HandleControl, Keyboard, ScancodeSet1};
use spin::Mutex;
use lazy_static::lazy_static;
use x86_64::instructions::port::Port;

lazy_static! {
    static ref KEYBOARD: Mutex<Keyboard<layouts::Us104Key, ScancodeSet1>> =
        Mutex::new(Keyboard::new(layouts::Us104Key, ScancodeSet1, HandleControl::Ignore));
    static ref INPUT_BUFFER: Mutex<String> = Mutex::new(String::new());
}

pub fn handle_keyboard_interrupt() {
    let mut keyboard = KEYBOARD.lock();
    let mut data_port = Port::new(0x60);
    let scancode: u8 = unsafe { data_port.read() };

    if let Ok(Some(key_event)) = keyboard.add_byte(scancode) {
        if let Some(key) = keyboard.process_keyevent(key_event) {
            match key {
                DecodedKey::Unicode(character) => {
                    if character == '\n' {
                        let command = {
                            let mut buffer = INPUT_BUFFER.lock();
                            let cmd = buffer.clone();
                            buffer.clear();
                            cmd
                        };
                        execute_command(command);
                    } else if character == '\x08' {
                        let mut buffer = INPUT_BUFFER.lock();
                        buffer.pop();
                        render_input_line(&buffer);
                    } else {
                        let mut buffer = INPUT_BUFFER.lock();
                        buffer.push(character);
                        render_input_line(&buffer);
                    }
                }
                DecodedKey::RawKey(_) => {}
            }
        }
    }
}

fn render_input_line(buffer: &str) {
    let display_str = alloc::format!("NEXUS-CLI> {}_               ", buffer);
    write_result_to_screen(24, &display_str, 0x0F);
}

fn execute_command(command: String) {
    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() { return; }

    match parts[0] {
        "help" => write_result_to_screen(20, "SYS_CMDS: 'help', 'status', 'peers', 'storage'", 0x0A),
        "status" => write_result_to_screen(20, "SYS_STATUS: CORE ONLINE | NVME SECURED | BFT ACTIVE", 0x0B),
        "peers" => {
            let table = crate::routing::MESH_NETWORK.lock();
            write_result_to_screen(20, &alloc::format!("KADEMLIA DHT: Active L2 Peers: {}", table.peers.len()), 0x0D);
        },
        "storage" => {
            if parts.len() > 1 {
                let file_name = alloc::format!("task_witness_{}.sig", parts[1]);
                if let Some(file_data) = crate::vfs::read_file(&file_name) {
                    let hex = if file_data.len() >= 4 {
                        alloc::format!("{:02X}{:02X}{:02X}{:02X}", file_data[0], file_data[1], file_data[2], file_data[3])
                    } else { "N/A".to_string() };
                    write_result_to_screen(20, &alloc::format!("VFS READ: {} -> HEX: {}", file_name, hex), 0x0B);
                } else {
                    write_result_to_screen(20, "VFS ERROR: WITNESS FILE NOT FOUND", 0x0C);
                }
            } else {
                write_result_to_screen(20, "VFS ERROR: SPECIFY TASK ID (e.g., 'storage 888')", 0x0E);
            }
        },
        _ => write_result_to_screen(20, "CLI ERROR: UNKNOWN COMMAND", 0x0C),
    }
}
