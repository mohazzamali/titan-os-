use ed25519_compact::{KeyPair, Seed};
use std::net::UdpSocket;

fn main() {
    println!("🦅 COMMANDER TERMINAL: RAW ETHERNET PACKET INJECTOR");

    let keypair = KeyPair::from_seed(Seed::new([7u8; 32]));
    let task_id: u64 = 888; 
    let input_data: i32 = 20; 

    let dynamic_wasm: &[u8] = &[
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 
        0x01, 0x06, 0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f, 
        0x03, 0x02, 0x01, 0x00,                         
        0x07, 0x0b, 0x01, 0x07, 0x65, 0x78, 0x65, 0x63, 0x75, 0x74, 0x65, 0x00, 0x00, 
        0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x41, 0x05, 0x6c, 0x0b 
    ];
    let wasm_len = dynamic_wasm.len() as u32;

    let mut data_to_sign = vec![0u8; 216];
    data_to_sign[0..8].copy_from_slice(&task_id.to_le_bytes());
    data_to_sign[8..12].copy_from_slice(&input_data.to_le_bytes());
    data_to_sign[12..16].copy_from_slice(&wasm_len.to_le_bytes());
    data_to_sign[16..(16 + dynamic_wasm.len())].copy_from_slice(dynamic_wasm);

    let signature = keypair.sk.sign(&data_to_sign, None);

    let mut payload = Vec::new();
    payload.extend_from_slice(&data_to_sign);           
    payload.extend_from_slice(keypair.pk.as_ref());     
    payload.extend_from_slice(signature.as_ref());      

    let mut raw_ethernet_frame = Vec::new();
    raw_ethernet_frame.extend_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); 
    raw_ethernet_frame.extend_from_slice(&[0x11, 0x22, 0x33, 0x44, 0x55, 0x66]); 
    raw_ethernet_frame.extend_from_slice(&[0x88, 0xB5]);                         
    raw_ethernet_frame.extend_from_slice(&payload);
    
    assert_eq!(raw_ethernet_frame.len(), 326); 

   let socket = UdpSocket::bind("127.0.0.1:0").expect("Failed to bind...");
    socket.send_to(&raw_ethernet_frame, "127.0.0.1:9999").expect("Failed to inject Ethernet frame");

    println!("🚀 RAW ETHERNET FRAME SUCCESSFULLY INJECTED FROM PORT 9988 TO PORT 9999!");
}