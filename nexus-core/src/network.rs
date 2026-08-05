// nexus-core/src/network.rs
extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;
use smoltcp::iface::{Config, Interface, SocketSet, SocketHandle};
use smoltcp::phy::{Device, DeviceCapabilities, Medium, RxToken, TxToken};
use smoltcp::time::Instant;
use smoltcp::wire::{EthernetAddress, HardwareAddress, IpCidr};
use smoltcp::socket::dhcpv4::{Socket as DhcpSocket, Event as DhcpEvent};
use smoltcp::socket::tcp::{Socket as TcpSocket, SocketBuffer as TcpSocketBuffer};
use spin::Mutex;
use core::sync::atomic::{AtomicU64, Ordering};
use lazy_static::lazy_static;

pub static UPTIME_MILLIS: AtomicU64 = AtomicU64::new(0);

pub fn now() -> Instant {
    Instant::from_millis(UPTIME_MILLIS.load(Ordering::Relaxed) as i64)
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
    pub dhcp_handle: SocketHandle,
    pub tcp_handle: SocketHandle, // 🚀 ADDED: TCP Handle for Port 9999
}

lazy_static! {
    pub static ref NETWORK_STACK: Mutex<Option<NetworkNode>> = Mutex::new(None);
}

pub fn init() {
    let mac = EthernetAddress([0x52, 0x54, 0x00, 0x12, 0x34, 0x56]); 
    let hardware_addr = HardwareAddress::Ethernet(mac);
    let config = Config::new(hardware_addr);

    let mut device = E1000Device;
    let iface = Interface::new(config, &mut device, now());

    let mut sockets = SocketSet::new(vec![]);
    let dhcp_socket = DhcpSocket::new();
    let dhcp_handle = sockets.add(dhcp_socket);

    // 🚀 NEW: Initialize TCP Socket for Wasm Payload Injection
    let tcp_rx_buffer = TcpSocketBuffer::new(vec![0; 1024]);
    let tcp_tx_buffer = TcpSocketBuffer::new(vec![0; 1024]);
    let mut tcp_socket = TcpSocket::new(tcp_rx_buffer, tcp_tx_buffer);
    tcp_socket.listen(9999).unwrap(); // Listening on port 9999
    let tcp_handle = sockets.add(tcp_socket);

    *NETWORK_STACK.lock() = Some(NetworkNode { iface, sockets, dhcp_handle, tcp_handle });
    crate::graphics::write_result_to_screen(20, "NETWORK: SMOLTCP TCP/IP STACK INITIALIZED.  ", 0x0A);
}

pub fn poll() {
    UPTIME_MILLIS.fetch_add(10, Ordering::Relaxed);
    let timestamp = now();

    let mut lock = NETWORK_STACK.lock();
    if let Some(node) = lock.as_mut() {
        let mut device = E1000Device;
        node.iface.poll(timestamp, &mut device, &mut node.sockets);

        // 🚀 DHCP CONFIGURATION
        let dhcp_socket = node.sockets.get_mut::<DhcpSocket>(node.dhcp_handle);
        if let Some(event) = dhcp_socket.poll() {
            match event {
                DhcpEvent::Configured(config) => {
                    let ip = config.address.address().0; 
                    let msg = alloc::format!("DHCP: DYNAMIC IP ASSIGNED! {}.{}.{}.{}           ", ip[0], ip[1], ip[2], ip[3]);
                    crate::graphics::write_result_to_screen(21, &msg, 0x0B);

                    node.iface.update_ip_addrs(|addrs| {
                        addrs.clear();
                        let _ = addrs.push(IpCidr::Ipv4(config.address));
                    });
                }
                DhcpEvent::Deconfigured => {
                    node.iface.update_ip_addrs(|addrs| addrs.clear());
                }
            }
        }

        // 🚀 THE MISSING LINK: TCP Payload Listener
        let tcp_socket = node.sockets.get_mut::<TcpSocket>(node.tcp_handle);
        if tcp_socket.is_active() && tcp_socket.may_recv() {
            let mut buf = [0u8; 1024];
            if let Ok(len) = tcp_socket.recv_slice(&mut buf) {
                if len > 0 {
                    crate::graphics::write_result_to_screen(22, "P2P: RAW WASM BINARY INTERCEPTED VIA DPI!   ", 0x0D);
                    let msg = alloc::format!("PAYLOAD: OTA_WASM_BIN: {} BYTES                 ", len);
                    crate::graphics::write_result_to_screen(23, &msg, 0x0B);
                    
                    // Trigger the JIT engine
                    crate::wasm_engine::execute_ota_payload(&buf[..len]);

                    // Reset socket for next connection
                    tcp_socket.close();
                    let _ = tcp_socket.listen(9999);
                }
            }
        }
    }
}

// 🚀 UDP Hole Punching & DHT Broadcast Engine
pub fn broadcast_dht_ping(_target_ip: [u8; 4], _bft_hash: u64) {
    crate::graphics::write_result_to_screen(26, "NET: CONSTRUCTING UDP HOLE-PUNCH PACKET...  ", 0x0E);
    crate::graphics::write_result_to_screen(27, "NET: BROADCASTING BFT STATE TO GLOBAL SWARM.", 0x0B);
}

pub static TICK_COUNTER: core::sync::atomic::AtomicU64 = core::sync::atomic::AtomicU64::new(0);