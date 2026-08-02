// nexus-gateway/src/main.rs

use std::env;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};

fn main() {
    let args: Vec<String> = env::args().collect();
    let mode = if args.len() > 1 { &args[1] } else { "master" };

    println!("==================================================");
    println!("🦅 NEXUS GLOBAL P2P GATEWAY ONLINE");
    println!("⚙️  MODE: {}", mode.to_uppercase());
    println!("==================================================\n");

    if mode == "master" {
        // 🚀 MASTER MODE: Listens to QEMU and routes to the Internet
        let tcp_listener = TcpListener::bind("0.0.0.0:7777").unwrap();
        println!("🌐 [MESH] Listening for Global Peers on TCP port 7777...");

        let udp_socket = UdpSocket::bind("127.0.0.1:9988").unwrap();
        println!("📡 [LOCAL] Listening for Bare-Metal OS on UDP 9988...");

        // Wait for a remote peer to connect before accepting OS traffic
        println!("⏳ Waiting for a Peer to join the swarm...");
        let (mut peer_stream, peer_addr) = tcp_listener.accept().unwrap();
        println!("🤝 [MESH] PEER CONNECTED FROM: {}! Swarm is active.", peer_addr);

        let mut buf = [0u8; 2048];
        loop {
            // 1. Catch the packet from QEMU
            let (size, _) = udp_socket.recv_from(&mut buf).unwrap();
            let frame = &buf[..size];

            // 2. Verify it is a Custom NEXUS Frame (0x88B5)
            if size >= 14 && frame[12] == 0x88 && frame[13] == 0xB5 {
                println!("📥 [LOCAL] Intercepted NEXUS Frame from OS!");
                println!("🚀 [MESH] Routing raw frame across TCP P2P network...");
                
                // 3. Blast it across the TCP Network to the connected Peer
                peer_stream.write_all(frame).unwrap();
            }
        }
    } else {
        // 🚀 PEER MODE: Simulates a completely different computer on the internet
        let target_ip = if args.len() > 2 { &args[2] } else { "127.0.0.1:7777" };
        println!("🔗 [MESH] Dialing Nexus Master Node at {}...", target_ip);
        
        let mut stream = TcpStream::connect(target_ip).expect("CRITICAL: Failed to connect to Master Node");
        println!("✅ [MESH] Successfully connected to the Global Swarm!\n");

        let mut buf = [0u8; 2048];
        loop {
            // Wait for data to arrive from across the network
            match stream.read(&mut buf) {
                Ok(size) if size > 0 => {
                    let frame = &buf[..size];
                    let payload = String::from_utf8_lossy(&frame[14..]);
                    println!("------------------------------------------------");
                    println!("🚨 [INCOMING P2P TRAFFIC DETECTED]");
                    println!("📏 Frame Size: {} bytes", size);
                    println!("💎 DECODED PAYLOAD: {}", payload.trim_matches(char::from(0)));
                    println!("------------------------------------------------");
                }
                _ => {
                    println!("⚠️ Swarm connection lost.");
                    break;
                }
            }
        }
    }
}