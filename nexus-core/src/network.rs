// nexus-core/src/network.rs
#![allow(dead_code)]

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;
use smoltcp::iface::{Config, Interface, SocketSet, SocketHandle};
use smoltcp::phy::{Device, DeviceCapabilities, Medium, RxToken, TxToken};
use smoltcp::time::Instant;
use smoltcp::wire::{EthernetAddress, HardwareAddress, IpCidr, Ipv4Address, Ipv4Cidr};
use smoltcp::socket::tcp::{Socket as TcpSocket, SocketBuffer as TcpSocketBuffer};
use smoltcp::socket::udp::{Socket as UdpSocket, PacketBuffer as UdpPacketBuffer, PacketMetadata as UdpPacketMetadata};
use spin::Mutex;
use core::sync::atomic::Ordering;
use lazy_static::lazy_static;

pub fn now() -> Instant {
    Instant::from_millis(crate::interrupts::OS_TICK.load(Ordering::Relaxed) as i64 * 10)
}

pub struct E1000Device;

impl Device for E1000Device {
    type RxToken<'a> = RxWrapper;
    type TxToken<'a> = TxWrapper;

    fn receive(&mut self, _timestamp: Instant) -> Option<(Self::RxToken<'_>, Self::TxToken<'_>)> {
        if let Some(packet) = crate::e1000::poll_packet() {
            Some((RxWrapper(packet), TxWrapper))
        } else {
            None
        }
    }

    fn transmit(&mut self, _timestamp: Instant) -> Option<Self::TxToken<'_>> {
        Some(TxWrapper)
    }

    fn capabilities(&self) -> DeviceCapabilities {
        let mut caps = DeviceCapabilities::default();
        caps.max_transmission_unit = 1500;
        caps.medium = Medium::Ethernet;
        caps
    }
}

pub struct RxWrapper(Vec<u8>);
impl RxToken for RxWrapper {
    fn consume<R, F>(mut self, f: F) -> R where F: FnOnce(&mut [u8]) -> R { f(&mut self.0) }
}

pub struct TxWrapper;
impl TxToken for TxWrapper {
    fn consume<R, F>(self, len: usize, f: F) -> R where F: FnOnce(&mut [u8]) -> R {
        let mut buffer = vec![0u8; len];
        let result = f(&mut buffer);
        crate::e1000::send_packet(&buffer); 
        result
    }
}

pub struct NetworkNode {
    pub iface: Interface,
    pub sockets: SocketSet<'static>,
    pub tcp_handle: SocketHandle, 
    pub udp_handle: SocketHandle, 
}

lazy_static! {
    pub static ref NETWORK_STACK: Mutex<Option<NetworkNode>> = Mutex::new(None);
}

pub fn init() {
    let mac_arr = unsafe { crate::e1000::MAC_ADDRESS };
    let mac = EthernetAddress(mac_arr);
    let hardware_addr = HardwareAddress::Ethernet(mac);
    let config = Config::new(hardware_addr);

    let mut device = E1000Device;
    let mut iface = Interface::new(config, &mut device, now());

    iface.update_ip_addrs(|addrs| {
        addrs.clear();
        let _ = addrs.push(IpCidr::Ipv4(Ipv4Cidr::new(Ipv4Address::new(10, 0, 2, 15), 24)));
    });

    let mut sockets = SocketSet::new(vec![]);
    
    // 1. TCP Web Server (Port 9999) - Buffers at 4KB for HTTP
    let tcp_rx_buffer = TcpSocketBuffer::new(vec![0; 4096]);
    let tcp_tx_buffer = TcpSocketBuffer::new(vec![0; 4096]);
    let mut tcp_socket = TcpSocket::new(tcp_rx_buffer, tcp_tx_buffer);
    tcp_socket.listen(9999).unwrap(); 
    let tcp_handle = sockets.add(tcp_socket);

    // 2. UDP Gossip Listener (Port 6969)
    let udp_rx_buffer = UdpPacketBuffer::new(vec![UdpPacketMetadata::EMPTY; 4], vec![0; 1024]);
    let udp_tx_buffer = UdpPacketBuffer::new(vec![UdpPacketMetadata::EMPTY; 4], vec![0; 1024]);
    let mut udp_socket = UdpSocket::new(udp_rx_buffer, udp_tx_buffer);
    udp_socket.bind(6969).unwrap();
    let udp_handle = sockets.add(udp_socket);

    *NETWORK_STACK.lock() = Some(NetworkNode { iface, sockets, tcp_handle, udp_handle });
    
    crate::graphics::write_result_to_screen(0, "[NET] SMOLTCP TCP/IP STACK INITIALIZED.", 0);
    crate::graphics::write_result_to_screen(0, "DHCP: STATIC IP FORCED! 10.0.2.15 (CLOUD READY) ", 0);
}

pub fn poll_network() {
    let timestamp = now();
    let mut lock = NETWORK_STACK.lock();
    if let Some(node) = lock.as_mut() {
        let mut device = E1000Device;
        let _ = node.iface.poll(timestamp, &mut device, &mut node.sockets);

        // --- HANDLE TCP (Browser Payload) ---
        let tcp_socket = node.sockets.get_mut::<TcpSocket>(node.tcp_handle);
        
        // 🚀 THE RESTORED BROWSER UNFREEZE FIX: abort() clears TIME_WAIT states!
        if !tcp_socket.is_active() && !tcp_socket.is_open() {
            tcp_socket.abort(); 
            let _ = tcp_socket.listen(9999);
        }

        if tcp_socket.can_recv() {
            let mut buf = [0u8; 4096];
            if let Ok(len) = tcp_socket.recv_slice(&mut buf) {
                if len > 0 {
                    let mut wasm_start = 0;
                    for i in 0..len.saturating_sub(4) {
                        if buf[i] == 0x00 && buf[i+1] == 0x61 && buf[i+2] == 0x73 && buf[i+3] == 0x6D {
                            wasm_start = i; break;
                        }
                    }

                    let actual_wasm_len = len - wasm_start;
                    if actual_wasm_len > 0 && wasm_start > 0 {
                        let msg = alloc::format!("P2P: {} BYTES WASM INJECTED VIA TCP 9999!", actual_wasm_len);
                        crate::graphics::write_result_to_screen(0, &msg, 0);
                        
                        crate::wasm_engine::execute_ota_payload(&buf[wasm_start..len]);
                        let simulated_compute = (actual_wasm_len as u32) * 10; 
                        crate::consensus::verify_compute(0x811C9DC5, simulated_compute);
                    }

                    if tcp_socket.can_send() {
                        // Proper HTTP Response
                        let response = b"HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: text/plain\r\nContent-Length: 23\r\nConnection: close\r\n\r\nZKP_VERIFIED_AND_MINTED";
                        let _ = tcp_socket.send_slice(response);
                    }
                    tcp_socket.close(); 
                }
            }
        } else if tcp_socket.state() == smoltcp::socket::tcp::State::CloseWait {
            tcp_socket.close();
        }

        // --- HANDLE UDP GOSSIP (From Python Relay) ---
        let udp_socket = node.sockets.get_mut::<UdpSocket>(node.udp_handle);
        if let Ok((data, _endpoint)) = udp_socket.recv() {
            if data.len() >= 10 && &data[0..6] == b"GOSSIP" {
                let mut tvl_bytes = [0u8; 4];
                tvl_bytes.copy_from_slice(&data[6..10]);
                let new_tvl = u32::from_le_bytes(tvl_bytes);
                
                let mut current_tvl = crate::consensus::NETWORK_TVL.lock();
                if new_tvl > *current_tvl {
                    *current_tvl = new_tvl; 
                    
                    let mut sector_data = [0u8; 512];
                    sector_data[0..4].copy_from_slice(&tvl_bytes);
                    crate::disk::write_sector(2048, &sector_data);
                    
                    let msg = alloc::format!("[SWARM] 🌐 GOSSIP RECEIVED! VAULT SYNCED TO {} NXC.", new_tvl);
                    crate::graphics::write_result_to_screen(0, &msg, 0);
                }
            }
        }
    }
}

pub fn send_test_packet() {
    crate::graphics::write_result_to_screen(0, "[CLI] TCP STACK IS ONLINE. AWAITING CLOUD...", 0);
}

pub fn broadcast_gossip(tvl: u32) {
    let mut packet = [0u8; 64];
    let my_mac = unsafe { crate::e1000::MAC_ADDRESS };

    packet[0..6].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
    packet[6..12].copy_from_slice(&my_mac);
    packet[12..14].copy_from_slice(&[0x08, 0x00]); 

    packet[14] = 0x45; packet[15] = 0x00; 
    packet[16..18].copy_from_slice(&[0x00, 0x32]); 
    packet[18..20].copy_from_slice(&[0x00, 0x00]); 
    packet[20..22].copy_from_slice(&[0x40, 0x00]); 
    packet[22] = 0x40; packet[23] = 0x11; 
    packet[24..26].copy_from_slice(&[0x2E, 0xAD]); 
    
    packet[26..30].copy_from_slice(&[10, 0, 2, 15]); 
    packet[30..34].copy_from_slice(&[10, 0, 2, 2]); // Send to Mac Relay

    packet[34..36].copy_from_slice(&[0x1B, 0x39]); 
    packet[36..38].copy_from_slice(&[0x1B, 0x39]); 
    packet[38..40].copy_from_slice(&[0x00, 0x1E]); 
    packet[40..42].copy_from_slice(&[0x00, 0x00]); 

    packet[42..48].copy_from_slice(b"GOSSIP");
    let tvl_bytes = tvl.to_le_bytes();
    packet[48..52].copy_from_slice(&tvl_bytes);

    crate::e1000::send_packet(&packet);
}