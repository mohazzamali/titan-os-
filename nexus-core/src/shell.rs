// nexus-core/src/shell.rs

extern crate alloc;
use alloc::string::String;
use pc_keyboard::{layouts, DecodedKey, HandleControl, Keyboard, ScancodeSet1};

pub fn task_shell() {
    let mut keyboard = Keyboard::new(layouts::Us104Key, ScancodeSet1, HandleControl::Ignore);
    let mut command_buffer = String::new();

    crate::graphics::write_result_to_screen(22, "SYS: KERNEL SHELL ONLINE. TYPE A COMMAND.     ", 0x0A);
    crate::graphics::write_result_to_screen(23, "NEXUS CLI > _                                 ", 0x0F);

    loop {
        // HARDCORE DEADLOCK PREVENTION
        let scancode = x86_64::instructions::interrupts::without_interrupts(|| {
            crate::keyboard::SCANCODE_QUEUE.lock().pop()
        });

        if let Some(code) = scancode {
            if let Ok(Some(key_event)) = keyboard.add_byte(code) {
                if let Some(key) = keyboard.process_keyevent(key_event) {
                    match key {
                        DecodedKey::Unicode(character) => {
                            if character == '\n' { // ENTER KEY
                                execute_command(&command_buffer);
                                command_buffer.clear();
                                crate::graphics::write_result_to_screen(23, "NEXUS CLI > _                                 ", 0x0F);
                            } else if character == '\u{8}' { // BACKSPACE KEY
                                if !command_buffer.is_empty() {
                                    command_buffer.pop();
                                    render_shell(&command_buffer);
                                }
                            } else {
                                command_buffer.push(character);
                                render_shell(&command_buffer);
                            }
                        },
                        DecodedKey::RawKey(_) => {}
                    }
                }
            }
        }
        
        // Yield CPU to the Matrix, Network, and AI Tasks
        for _ in 0..50_000 { core::hint::spin_loop(); }
    }
}

fn render_shell(cmd: &str) {
    let display = alloc::format!("NEXUS CLI > {}_                               ", cmd);
    crate::graphics::write_result_to_screen(23, &display, 0x0F); 
}

fn execute_command(cmd: &str) {
    let cmd = cmd.trim();
    match cmd {
        "help" => crate::graphics::write_result_to_screen(22, "CMD: help, peers, run zk, net, tx, ping       ", 0x0E),
        "peers" => {
            let count = crate::kademlia::get_peer_count();
            let msg = alloc::format!("SYS: {} ACTIVE KADEMLIA MESH PEERS CONNECTED  ", count);
            crate::graphics::write_result_to_screen(22, &msg, 0x0B);
        },
        "ping" => crate::graphics::write_result_to_screen(22, "SYS: PONG! FABRIC LATENCY = 1ms               ", 0x0A),
        "run zk" => {
            crate::graphics::write_result_to_screen(22, "SYS: SPAWNING NEW PROCESS TASK...             ", 0x0D);
            crate::vfs::execute_external_app("zk_proof.wasm");
        },
        "net" => {
            crate::e1000::initialize_nic();
        },
        "tx" => {
            crate::graphics::write_result_to_screen(22, "SYS: INITIATING L2 HARDWARE TRANSMISSION...   ", 0x0D);
            let dummy_frame = [0xFF; 64]; 
            crate::e1000::send_packet(&dummy_frame);
        },
        "" => {}, // Ignore empty enter
        _ => {
            let msg = alloc::format!("ERR: UNKNOWN COMMAND '{}'                     ", cmd);
            crate::graphics::write_result_to_screen(22, &msg, 0x04);
        }
    }
}