use axum::{routing::{get, post}, Router, response::Html};
use tokio::net::TcpStream;
use tokio::io::{AsyncWriteExt, AsyncReadExt};
use std::fs;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(serve_dashboard))
        .route("/api/deploy", post(deploy_wasm_payload));

    println!("=======================================================");
    println!("☁️ NEXUS CLOUD WEB SERVER RUNNING ON http://localhost:3000");
    println!("=======================================================");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn serve_dashboard() -> Html<&'static str> {
    Html(include_str!("index.html"))
}

async fn deploy_wasm_payload() -> (axum::http::StatusCode, String) {
    let wasm_path = "../nexus-ai-contract/target/wasm32-unknown-unknown/release/nexus_ai_contract.wasm";
    
    let wasm_payload = match fs::read(wasm_path) {
        Ok(data) => data,
        Err(_) => return (axum::http::StatusCode::NOT_FOUND, "[ERROR] AI WASM FILE NOT FOUND. COMPILE IT FIRST.".to_string()),
    };

    let mut frame = Vec::new();
    frame.extend_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); 
    frame.extend_from_slice(&[0x99, 0x88, 0x77, 0x66, 0x55, 0x44]); 
    frame.push(0x88); frame.push(0xB5); 
    frame.push(0x03); 
    frame.extend_from_slice(&wasm_payload); 

    match TcpStream::connect("127.0.0.1:9999").await {
        Ok(mut stream) => {
            if stream.write_all(&frame).await.is_ok() {
                // 🚀 TWO-WAY SYNC: Read execution result back from OS Bare-Metal Node!
                let mut response_buf = [0u8; 64];
                match stream.read(&mut response_buf).await {
                    Ok(n) if n > 0 => {
                        let result_msg = String::from_utf8_lossy(&response_buf[..n]);
                        (axum::http::StatusCode::OK, format!("[OK] EXECUTED ON SWARM! RESULT: {}", result_msg))
                    }
                    _ => (axum::http::StatusCode::OK, format!("[OK] DEPLOYED {} BYTES TO AI ENGINE (ASYNC EXECUTION)", wasm_payload.len()))
                }
            } else {
                (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "[ERROR] FAILED TO TRANSMIT TO HARDWARE.".to_string())
            }
        }
        Err(_) => {
            (axum::http::StatusCode::SERVICE_UNAVAILABLE, "[ERROR] NODE OFFLINE. BOOT QEMU OS FIRST.".to_string())
        }
    }
}