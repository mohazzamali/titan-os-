// nexus-core/src/e1000.rs
#![allow(dead_code)]
use core::ptr::{read_volatile, write_volatile};
use alloc::format;
use core::sync::atomic::{AtomicBool, Ordering};
use x86_64::instructions::port::Port;

pub static NETWORK_READY: AtomicBool = AtomicBool::new(false);

#[repr(C, align(16))]
#[derive(Clone, Copy)]
pub struct RxDesc { pub addr: u64, pub length: u16, pub checksum: u16, pub status: u8, pub errors: u8, pub special: u16 }
#[repr(C, align(16))]
#[derive(Clone, Copy)]
pub struct TxDesc { pub addr: u64, pub length: u16, pub cso: u8, pub cmd: u8, pub status: u8, pub css: u8, pub special: u16 }

const NUM_RX_DESCRIPTORS: usize = 32;
const NUM_TX_DESCRIPTORS: usize = 8;

static mut RX_RING: [RxDesc; NUM_RX_DESCRIPTORS] = [RxDesc { addr: 0, length: 0, checksum: 0, status: 0, errors: 0, special: 0 }; NUM_RX_DESCRIPTORS];
static mut TX_RING: [TxDesc; NUM_TX_DESCRIPTORS] = [TxDesc { addr: 0, length: 0, cso: 0, cmd: 0, status: 0, css: 0, special: 0 }; NUM_TX_DESCRIPTORS];
static mut RX_BUFFERS: [[u8; 2048]; NUM_RX_DESCRIPTORS] = [[0; 2048]; NUM_RX_DESCRIPTORS];
static mut TX_BUFFERS: [[u8; 2048]; NUM_TX_DESCRIPTORS] = [[0; 2048]; NUM_TX_DESCRIPTORS];
static mut E1000_MMIO_BASE: u64 = 0;

const REG_RDBAL: u32 = 0x2800; const REG_RDBAH: u32 = 0x2804;
const REG_RDLEN: u32 = 0x2808; const REG_RDH: u32   = 0x2810; const REG_RDT: u32 = 0x2818;
const REG_RCTL: u32  = 0x0100;
const REG_TDBAL: u32 = 0x3800; const REG_TDBAH: u32 = 0x3804;
const REG_TDLEN: u32 = 0x3808; const REG_TDH: u32   = 0x3810; const REG_TDT: u32 = 0x3818;
const REG_TCTL: u32  = 0x0400;

unsafe fn write_reg(offset: u32, value: u32) { write_volatile((E1000_MMIO_BASE + offset as u64) as *mut u32, value); }
unsafe fn read_reg(offset: u32) -> u32 { read_volatile((E1000_MMIO_BASE + offset as u64) as *const u32) }

pub fn init_dma_network() {
    crate::graphics::write_result_to_screen(20, "E1000: INITIATING ZERO-COPY DMA RINGS...", 0x0E);
    unsafe {
        if let Some((_io_base, bus, device)) = crate::pci::scan_bus_and_get_e1000_io_base() {
            
            // 🚀 THE MOTHERBOARD OVERRIDE: Enforcing PCI Bus Mastering (DMA Permission)
            let mut port_addr: Port<u32> = Port::new(0xCF8);
            let mut port_data: Port<u32> = Port::new(0xCFC);
            let addr = 0x80000000 | ((bus as u32) << 16) | ((device as u32) << 11) | 0x04; // 0x04 is Command Register
            port_addr.write(addr);
            let mut cmd = port_data.read();
            cmd |= 0x0004; // Set Bit 2: Bus Master Enable (DMA)
            cmd |= 0x0002; // Set Bit 1: Memory Space Enable (MMIO)
            port_addr.write(addr);
            port_data.write(cmd);

            let bar0 = crate::pci::read_pcie_u32(bus, device, 0, 0x10);
            E1000_MMIO_BASE = (bar0 & 0xFFFFFFF0) as u64 + 0x4000_0000_0000;
            
            let safe_mmio_base = E1000_MMIO_BASE;
            crate::graphics::write_result_to_screen(21, &format!("E1000: MMIO 0x{:X} | DMA ENABLED", safe_mmio_base), 0x0B);

            // 🚀 FLASHING MAC ADDRESS TO SILICON (52:54:00:12:34:56)
            write_reg(0x5400, 0x12005452); // RAL (Receive Address Low)
            write_reg(0x5404, 0x80005634); // RAH (Receive Address High + Bit 31 Address Valid)

            let rx_ring_phys = crate::memory::translate_addr(core::ptr::addr_of!(RX_RING) as *const _ as u64).unwrap();
            write_reg(REG_RDBAL, (rx_ring_phys & 0xFFFFFFFF) as u32);
            write_reg(REG_RDBAH, (rx_ring_phys >> 32) as u32);
            write_reg(REG_RDLEN, (NUM_RX_DESCRIPTORS * 16) as u32);
            
            for i in 0..NUM_RX_DESCRIPTORS {
                let buf_ptr = core::ptr::addr_of!(RX_BUFFERS[i]) as *const _ as u64;
                RX_RING[i].addr = crate::memory::translate_addr(buf_ptr).unwrap();
                RX_RING[i].status = 0;
            }
            write_reg(REG_RDH, 0); 
            write_reg(REG_RDT, (NUM_RX_DESCRIPTORS - 1) as u32);
            write_reg(REG_RCTL, (1 << 1) | (1 << 15) | (1 << 26)); // EN, BAM, SECRC

            let tx_ring_phys = crate::memory::translate_addr(core::ptr::addr_of!(TX_RING) as *const _ as u64).unwrap();
            write_reg(REG_TDBAL, (tx_ring_phys & 0xFFFFFFFF) as u32);
            write_reg(REG_TDBAH, (tx_ring_phys >> 32) as u32);
            write_reg(REG_TDLEN, (NUM_TX_DESCRIPTORS * 16) as u32);
            write_reg(REG_TDH, 0); 
            write_reg(REG_TDT, 0);
            write_reg(REG_TCTL, (1 << 1) | (1 << 3));

            NETWORK_READY.store(true, Ordering::Release);
        }
    }
}

pub fn send_packet(data: &[u8]) {
    if !NETWORK_READY.load(Ordering::Acquire) { return; }
    unsafe {
        if E1000_MMIO_BASE == 0 { return; } 
        let tdt = read_reg(REG_TDT) as usize; 
        
        let len = data.len().min(2048);
        for i in 0..len { TX_BUFFERS[tdt][i] = data[i]; }
        
        let buf_ptr = core::ptr::addr_of!(TX_BUFFERS[tdt]) as *const _ as u64;
        TX_RING[tdt].addr = crate::memory::translate_addr(buf_ptr).unwrap();
        TX_RING[tdt].length = len as u16;
        TX_RING[tdt].cmd = 0x0B; 
        TX_RING[tdt].status = 0;
        
        let next_tdt = (tdt + 1) % NUM_TX_DESCRIPTORS;
        write_reg(REG_TDT, next_tdt as u32);
    }
}

pub fn poll_packet() -> Option<alloc::vec::Vec<u8>> {
    if !NETWORK_READY.load(Ordering::Acquire) { return None; }
    unsafe {
        if E1000_MMIO_BASE == 0 { return None; } 
        static mut RX_CUR: usize = 0;
        
        let status = core::ptr::read_volatile(&RX_RING[RX_CUR].status);
        if (status & 1) == 0 { return None; } // If 0, packet is not in RAM yet
        
        let len = core::ptr::read_volatile(&RX_RING[RX_CUR].length) as usize;
        let buf_ptr = core::ptr::addr_of!(RX_BUFFERS[RX_CUR]) as *const u8;
        
        let mut packet = alloc::vec::Vec::with_capacity(len);
        packet.extend_from_slice(core::slice::from_raw_parts(buf_ptr, len));
        
        core::ptr::write_volatile(&mut RX_RING[RX_CUR].status, 0);
        let old_cur = RX_CUR;
        RX_CUR = (RX_CUR + 1) % NUM_RX_DESCRIPTORS;
        write_reg(REG_RDT, old_cur as u32);
        
        Some(packet)
    }
}


pub fn handle_hardware_interrupt() {}
