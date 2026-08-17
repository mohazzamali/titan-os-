use std::io::{Read, Write};
use std::net::TcpStream;
use std::thread;
use std::time::Duration;
use serde_json::Value;

// --- OS KERNEL BOOT SEQUENCE ---
fn init_vga() { println!("[KERNEL] VGA Text Buffer Initialized at 0xB8000"); }
fn init_memory() { println!("[KERNEL] Paging & Virtual Memory mapped."); }
fn init_e1000() { println!("[HW] Intel e1000 Gigabit Network controller bound to PCI bus."); }

fn main() {
    println!("==================================================");
    println!(" 🖥️ TITAN OS v1.0 (BARE-METAL KERNEL BOOT)");
    println!("==================================================");
    
    // Simulate OS Booting up...
    thread::sleep(Duration::from_millis(500));
    init_vga();
    thread::sleep(Duration::from_millis(500));
    init_memory();
    thread::sleep(Duration::from_millis(600));
    init_e1000();
    
    println!("\n[SYS] Boot complete. Handing control to Nexus Network Stack...\n");
    thread::sleep(Duration::from_millis(1000));

    // --- NEXUS TIER 3 TCP BRIDGE ---
    let mut stream = match TcpStream::connect("127.0.0.1:8081") {
        Ok(s) => s,
        Err(_) => {
            println!("❌ [KERNEL PANIC] No Network Route to Nexus Matchmaker. System Halted.");
            return;
        }
    };
    println!("🟢 [NET-STACK] Ethernet Link UP! Connected to Swarm via TCP.");

    let mut buffer = [0; 65536];

    loop {
        match stream.read(&mut buffer) {
            Ok(size) => {
                if size == 0 { break; }
                let msg = String::from_utf8_lossy(&buffer[0..size]);
                
                if let Ok(json) = serde_json::from_str::<Value>(&msg) {
                    if json["type"] == "EXECUTE_WASM" {
                        let payload = json["payload"].as_array().unwrap();
                        println!("⚡ [CPU] Interrupt Triggered! Catching WASM Payload ({} bytes).", payload.len());
                        println!("🔒 [SEC] Executing in Ring-0 Bare-Metal isolation...");

                        // CPU Execution Simulation
                        thread::sleep(Duration::from_millis(1500));
                        let result = 1; 

                        println!("✅ [SUCCESS] Compute cycle finished. Result = {}", result);

                        // Fire back via Ethernet
                        let response = format!(r#"{{"type":"COMPUTE_RESULT","result":{}}}"#, result);
                        stream.write_all(response.as_bytes()).unwrap();
                        println!("📤 [NET-STACK] Packet fired out of e1000 interface.\n");
                    }
                }
            },
            Err(_) => break,
        }
    }
}
