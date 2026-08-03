// nexus-core/src/network.rs
extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;
use smoltcp::iface::{Config, Interface, SocketSet, SocketHandle};
use smoltcp::phy::{Device, DeviceCapabilities, Medium, RxToken, TxToken};
use smoltcp::time::Instant;
use smoltcp::wire::{EthernetAddress, HardwareAddress, IpCidr};
use smoltcp::socket::dhcpv4::{Socket as DhcpSocket, Event as DhcpEvent};
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
}

lazy_static! {
    pub static ref NETWORK_STACK: Mutex<Option<NetworkNode>> = Mutex::new(None);
}

pub fn init() {
    let mac = EthernetAddress([0x52, 0x54, 0x00, 0x12, 0x34, 0x56]); // QEMU MAC
    let hardware_addr = HardwareAddress::Ethernet(mac);
    let config = Config::new(hardware_addr);

    let mut device = E1000Device;
    let iface = Interface::new(config, &mut device, now());

    let mut sockets = SocketSet::new(vec![]);
    let dhcp_socket = DhcpSocket::new();
    let dhcp_handle = sockets.add(dhcp_socket);

    *NETWORK_STACK.lock() = Some(NetworkNode { iface, sockets, dhcp_handle });
    crate::graphics::write_result_to_screen(20, "NETWORK: SMOLTCP TCP/IP STACK INITIALIZED.  ", 0x0A);
}

pub fn poll() {
    // Hardware Clock Advancement for standard protocol timeouts
    UPTIME_MILLIS.fetch_add(10, Ordering::Relaxed);
    let timestamp = now();

    let mut lock = NETWORK_STACK.lock();
    if let Some(node) = lock.as_mut() {
        let mut device = E1000Device;
        node.iface.poll(timestamp, &mut device, &mut node.sockets);

        // 🚀 DYNAMIC DHCP CONFIGURATION ROUTINE
        let dhcp_socket = node.sockets.get_mut::<DhcpSocket>(node.dhcp_handle);
        if let Some(event) = dhcp_socket.poll() {
            match event {
                DhcpEvent::Configured(config) => {
                    let ip = config.address.address().0; // Extract raw IPv4 bytes
                    let msg = alloc::format!("DHCP: DYNAMIC IP ASSIGNED! {}.{}.{}.{}           ", ip[0], ip[1], ip[2], ip[3]);
                    crate::graphics::write_result_to_screen(21, &msg, 0x0B);

                    node.iface.update_ip_addrs(|addrs| {
                        addrs.clear();
                        addrs.push(IpCidr::Ipv4(config.address));
                    });
                }
                DhcpEvent::Deconfigured => {
                    node.iface.update_ip_addrs(|addrs| addrs.clear());
                }
            }
        }
    }
}
