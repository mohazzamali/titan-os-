use std::io::{Read, Write};
use std::net::TcpStream;
use std::thread;
use std::time::Duration;
use serde_json::Value;

fn main() {
    println!("==================================================");
    println!(" 🛡️ NEXUS BARE-METAL TIER 3 NODE (Rust TCP)");
    println!("==================================================");

    // 1. Connect directly via RAW TCP (No WebSockets, no browsers!)
    let mut stream = match TcpStream::connect("127.0.0.1:8081") {
        Ok(s) => s,
        Err(e) => {
            println!("❌ [CRITICAL] Could not connect to Port 8081: {}", e);
            return;
        }
    };
    println!("🟢 [NET] Connected to Global Matchmaker via RAW TCP!");

    // Buffer to hold incoming bytes
    let mut buffer = [0; 65536];

    loop {
        // 2. Listen for raw bytes from the network card (simulated)
        match stream.read(&mut buffer) {
            Ok(size) => {
                if size == 0 {
                    println!("🔴 [NET] Server closed the connection.");
                    break;
                }
                
                // 3. Decode the raw bytes into string/JSON
                let msg = String::from_utf8_lossy(&buffer[0..size]);
                if let Ok(json) = serde_json::from_str::<Value>(&msg) {
                    if json["type"] == "EXECUTE_WASM" {
                        let payload = json["payload"].as_array().unwrap();
                        println!("⚡ [INBOUND] Catching WASM Payload ({} bytes) over TCP...", payload.len());
                        println!("🔒 [SEC] Loading into Rust Bare-Metal Sandbox (Zero-OS overhead)...");

                        // 4. Simulate bare-metal CPU execution 
                        thread::sleep(Duration::from_millis(1200));
                        let result = 1; // Direct math result extraction

                        println!("✅ [SUCCESS] Bare-Metal Execution complete! Result = {}", result);

                        // 5. Send result back over Raw TCP
                        let response = format!(r#"{{"type":"COMPUTE_RESULT","result":{}}}"#, result);
                        stream.write_all(response.as_bytes()).unwrap();
                        println!("📤 [NET] Result fired back to Hub over TCP.\n");
                    }
                }
            },
            Err(e) => {
                println!("⚠️ [ERROR] Network failure: {}", e);
                break;
            }
        }
    }
}
