extern crate alloc;

pub fn task_shell() {
    init();
    loop {
        // Keeps the shell alive in the CPU scheduler without locking the core
        for _ in 0..10_000_000 { core::hint::spin_loop(); }
    }
}

pub fn init() {
    // 1. Render the HUD immediately
    execute_command("hud");
    
    // 2. Move CLI Prompt up to Row 23 so it doesn't get overwritten by the Dashboard
    crate::graphics::write_result_to_screen(23, "NEXUS CLI > deploy_                             ", 0x0E);
    
    // 3. Pause for a few seconds (simulating human typing)
    for _ in 0..50_000_000 { core::hint::spin_loop(); }
    
    // 4. Auto-execute Phase 3!
    execute_command("deploy");
}

pub fn execute_command(cmd: &str) {
    let cmd = cmd.trim();
    match cmd {
        "help" => crate::graphics::write_result_to_screen(22, "CMD: ls, cat, deploy, pci_scan, tensor, uplink", 0x0E),
        "net_up" => crate::e1000::init_dma_network(),
        "uplink" => {
            crate::graphics::write_result_to_screen(21, "NIC: ASSEMBLING RAW L2 ETHERNET FRAME...      ", 0x0E);
            let mut frame = [0u8; 64];
            frame[0..6].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
            frame[6..12].copy_from_slice(&[0x02, 0x00, 0x00, 0x00, 0x00, 0x01]);
            frame[12] = 0x88; frame[13] = 0xB5;
            let payload = b"NEXUS_EDGE_UPLINK_ESTABLISHED";
            frame[14..14+payload.len()].copy_from_slice(payload);
            crate::transmit_packet(&frame);
            crate::graphics::write_result_to_screen(22, "SYS: ETHERNET FRAME TRANSMITTED TO HOST.      ", 0x0A);
        },
        "tensor" => { crate::ai::execute_ai_scan(); },
        "pci_scan" => {
            crate::graphics::write_result_to_screen(15, "PCIe: SCANNING MOTHERBOARD BUSES...           ", 0x0E);
            let devices = crate::pci::scan_buses();
            let mut row = 16;
            for dev in devices.iter().take(6) {
                let class_name = match dev.class_id {
                    0x01 => "STORAGE CONTROLLER (NVMe)",
                    0x02 => "NETWORK ADAPTER (NIC)   ",
                    0x03 => "DISPLAY CONTROLLER (GPU)",
                    0x06 => "PCI BRIDGE ROOT         ",
                    _ =>    "SYSTEM PERIPHERAL       ",
                };
                let msg = alloc::format!("BUS {:02X} DEV {:02X} | VENDOR: {:04X} | {} ", dev.bus, dev.device, dev.vendor_id, class_name);
                crate::graphics::write_result_to_screen(row, &msg, 0x0B); 
                row += 1;
            }
            crate::graphics::write_result_to_screen(22, "SYS: PCI BUS ENUMERATION COMPLETE.            ", 0x0A);
        },
        "ls" => {
            crate::graphics::write_result_to_screen(16, "VFS: READING INODE DIRECTORY...               ", 0x0E);
            let files = crate::vfs::list_files();
            let mut row = 17;
            for (name, size) in files {
                let msg = alloc::format!("FILE: {} | SIZE: {} BYTES                  ", name, size);
                crate::graphics::write_result_to_screen(row, &msg, 0x0B); 
                row += 1;
            }
            crate::graphics::write_result_to_screen(22, "SYS: DIRECTORY LISTING COMPLETE.              ", 0x0A);
        },
        "cat" => {
            crate::graphics::write_result_to_screen(16, "VFS: READING 'smart_contract.wasm'...         ", 0x0E);
            if let Some(data) = crate::vfs::read_file("smart_contract.wasm") {
                let mut hex_str = alloc::string::String::from("DATA: [ ");
                for byte in data { hex_str.push_str(&alloc::format!("{:02X} ", byte)); }
                hex_str.push_str("]            ");
                crate::graphics::write_result_to_screen(18, &hex_str, 0x0D);
                crate::graphics::write_result_to_screen(22, "SYS: FILE READ SUCCESSFUL.                    ", 0x0A);
            } else {
                crate::graphics::write_result_to_screen(22, "ERR: FILE NOT FOUND.                          ", 0x04);
            }
        },
        "deploy" => {
            crate::wasm_engine::execute_smart_contract("smart_contract.wasm");
        },
        "hud" => { crate::dashboard::render_matrix_hud(); },
        "clear" => {
            for i in 0..22 { crate::graphics::write_result_to_screen(i, "                                                                                ", 0x0F); }
        },
        "" => {}, 
        _ => {
            let msg = alloc::format!("ERR: UNKNOWN COMMAND '{}'                     ", cmd);
            crate::graphics::write_result_to_screen(22, &msg, 0x04);
        }
    }
}
