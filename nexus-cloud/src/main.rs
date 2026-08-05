use axum::{routing::{get, post}, Router, response::Html};
use tokio::net::TcpStream;
use tokio::io::AsyncWriteExt;
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
    // 🚀 READ THE REAL AI WASM CONTRACT FROM DISK
    let wasm_path = "../nexus-ai-contract/target/wasm32-unknown-unknown/release/nexus_ai_contract.wasm";
    
    let wasm_payload = match fs::read(wasm_path) {
        Ok(data) => data,
        Err(_) => return (axum::http::StatusCode::NOT_FOUND, "[ERROR] AI WASM FILE NOT FOUND. DID YOU COMPILE IT?".to_string()),
    };

    println!("☁️ CLOUD: Loaded {} bytes of heavy AI Wasm Payload.", wasm_payload.len());

    // 🚀 DYNAMIC ZERO-TRUST FRAME ALLOCATION (15 Bytes Header + Wasm Size)
    let mut frame = Vec::new();
    frame.extend_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); // MAC
    frame.extend_from_slice(&[0x99, 0x88, 0x77, 0x66, 0x55, 0x44]); // Gateway MAC
    frame.push(0x88); frame.push(0xB5); // Nexus Protocol
    frame.push(0x03); // Command: RPC_EXEC
    frame.extend_from_slice(&wasm_payload); // The Heavy Payload!

    match TcpStream::connect("127.0.0.1:9999").await {
        Ok(mut stream) => {
            if stream.write_all(&frame).await.is_ok() {
                (axum::http::StatusCode::OK, format!("[OK] DEPLOYED {} BYTES TO AI ENGINE!", wasm_payload.len()))
            } else {
                (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "[ERROR] FAILED TO WRITE TO HARDWARE.".to_string())
            }
        }
        Err(_) => {
            (axum::http::StatusCode::SERVICE_UNAVAILABLE, "[ERROR] OS OFFLINE.".to_string())
        }
    }
}