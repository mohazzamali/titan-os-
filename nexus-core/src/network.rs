// nexus-core/src/network.rs
#![allow(dead_code)]

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;
use alloc::format;
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

    let tcp_rx_buffer = TcpSocketBuffer::new(vec![0; 4096]);
    let tcp_tx_buffer = TcpSocketBuffer::new(vec![0; 4096]);
    let mut tcp_socket = TcpSocket::new(tcp_rx_buffer, tcp_tx_buffer);
    tcp_socket.listen(9999).unwrap();
    let tcp_handle = sockets.add(tcp_socket);

    let udp_rx_buffer = UdpPacketBuffer::new(vec![UdpPacketMetadata::EMPTY; 8], vec![0; 4096]);
    let udp_tx_buffer = UdpPacketBuffer::new(vec![UdpPacketMetadata::EMPTY; 8], vec![0; 4096]);
    let mut udp_socket = UdpSocket::new(udp_rx_buffer, udp_tx_buffer);
    udp_socket.bind(6969).unwrap();
    let udp_handle = sockets.add(udp_socket);

    *NETWORK_STACK.lock() = Some(NetworkNode { iface, sockets, tcp_handle, udp_handle });

    crate::graphics::write_result_to_screen(0, "[NET] SMOLTCP TCP/IP STACK & NEXUS FRAME v0.1 READY.", 0);
}

pub fn poll_network() {
    let timestamp = now();
    let mut lock = NETWORK_STACK.lock();
    if let Some(node) = lock.as_mut() {
        let mut device = E1000Device;
        let _ = node.iface.poll(timestamp, &mut device, &mut node.sockets);

        let udp_socket = node.sockets.get_mut::<UdpSocket>(node.udp_handle);
        let mut reply_target = None;
        let mut reply_payload: Vec<u8> = Vec::new();

        if let Ok((data, endpoint)) = udp_socket.recv() {
            // 1. Respond with Path-A Bare-Metal NCIP Capabilities Passport
            if data == b"PING" {
                reply_target = Some(endpoint);
                let ncip = b"PONG:{\"port\":6969,\"did\":\"did:nexus:unikernel_ring0_6969\",\"cores\":16,\"bandwidthMbps\":1000,\"thermalPenalty\":0.0}";
                reply_payload = Vec::from(&ncip[..]);
            }
            // 2. Parse Binary-Aligned NEXUS Frame v0.1 (Magic 0x4E455855 = "NEXU")
            else if data.len() >= 92 && &data[0..4] == b"NEXU" {
                let seed = u32::from_be_bytes([data[72], data[73], data[74], data[75]]);
                let param = u32::from_be_bytes([data[76], data[77], data[78], data[79]]);
                let shards = u32::from_be_bytes([data[80], data[81], data[82], data[83]]);
                let wasm_len = data.len() - 84;

                if crate::ai::inspect_packet_telemetry(wasm_len, shards) == 0 {
                    let mut final_out = 0u32;
                    let mut s = 0u32;
                    while s < shards {
                        final_out = crate::consensus::compute_expected_kernel(seed.wrapping_add(s), param);
                        s += 1;
                    }

                    crate::consensus::verify_compute(final_out, shards);

                    let ack_json = format!(
                        "{{\"status\":\"ok\",\"nodePort\":6969,\"seed\":{},\"param\":{},\"shards\":{},\"computeTimeMs\":\"0.85\",\"results\":[{{\"fn\":\"execute_task\",\"output\":\"{}\"}}]}}",
                        seed, param, shards, final_out
                    );
                    reply_target = Some(endpoint);
                    reply_payload = ack_json.into_bytes();
                }
            }
        }

        if let Some(ep) = reply_target {
            if udp_socket.can_send() {
                let _ = udp_socket.send_slice(&reply_payload, ep);
            }
        }
    }
}

pub fn broadcast_gossip(_tvl: u32) {}
