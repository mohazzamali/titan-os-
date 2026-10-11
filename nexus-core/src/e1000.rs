// nexus-core/src/e1000.rs
#![allow(dead_code)]

use alloc::vec::Vec;
use core::sync::atomic::{Ordering, AtomicUsize};
use core::arch::asm;

const REG_RCTRL: usize     = 0x0100;
const REG_RXDESCLO: usize  = 0x2800;
const REG_RXDESCHI: usize  = 0x2804;
const REG_RXDESCLEN: usize = 0x2808;
const REG_RXDESCHEAD: usize = 0x2810;
const REG_RXDESCTAIL: usize = 0x2818;

const REG_TCTRL: usize     = 0x0400;
const REG_TXDESCLO: usize  = 0x3800;
const REG_TXDESCHI: usize  = 0x3804;
const REG_TXDESCLEN: usize = 0x3808;
const REG_TXDESCHEAD: usize = 0x3810;
const REG_TXDESCTAIL: usize = 0x3818;

const REG_RAL: usize = 0x5400;
const REG_RAH: usize = 0x5404;

const REG_ICR: usize = 0x00C0; // Interrupt Cause Read
const REG_IMS: usize = 0x00D0; // Interrupt Mask Set

pub static mut E1000_BAR0: usize = 0;
pub static mut MAC_ADDRESS: [u8; 6] = [0; 6];

#[repr(C, packed)]
#[derive(Clone, Copy)]
pub struct RXDescriptor {
    pub address: u64, pub length: u16, pub checksum: u16,
    pub status: u8, pub errors: u8, pub special: u16,
}

#[repr(C, packed)]
#[derive(Clone, Copy)]
pub struct TXDescriptor {
    pub address: u64, pub length: u16, pub cso: u8, pub cmd: u8,
    pub status: u8, pub css: u8, pub special: u16,
}

// 🚀 BLUEPRINT COMPLIANCE: 128-Byte Alignment to prevent L1 Cache False Sharing
#[repr(C, align(128))]
#[derive(Clone, Copy)]
pub struct NexusDmaQueue {
    pub data: [u8; 2048],
}

const NUM_RX_DESC: usize = 32; 
const NUM_TX_DESC: usize = 32; 

static mut RX_RING: [RXDescriptor; NUM_RX_DESC] = [RXDescriptor { address: 0, length: 0, checksum: 0, status: 0, errors: 0, special: 0 }; NUM_RX_DESC];
static mut TX_RING: [TXDescriptor; NUM_TX_DESC] = [TXDescriptor { address: 0, length: 0, cso: 0, cmd: 0, status: 0, css: 0, special: 0 }; NUM_TX_DESC];

const INIT_DMA: NexusDmaQueue = NexusDmaQueue { data: [0; 2048] };
static mut RX_BUFFERS: [NexusDmaQueue; NUM_RX_DESC] = [INIT_DMA; NUM_RX_DESC];
static mut TX_BUFFERS: [NexusDmaQueue; NUM_TX_DESC] = [INIT_DMA; NUM_TX_DESC];

static RX_CUR_INDEX: AtomicUsize = AtomicUsize::new(0);
static TX_CUR_INDEX: AtomicUsize = AtomicUsize::new(0);

unsafe fn write_reg(offset: usize, value: u32) { core::ptr::write_volatile((E1000_BAR0 + offset) as *mut u32, value); }
unsafe fn read_reg(offset: usize) -> u32 { core::ptr::read_volatile((E1000_BAR0 + offset) as *const u32) }

// Hardware Cache Line Flush (CLFLUSH)
#[inline(always)]
unsafe fn clflush(addr: usize) {
    asm!("clflush [{}]", in(reg) addr);
}

// In nexus-core/src/e1000.rs

pub fn init_dma_network() {
    if let Some(device) = crate::pci::scan_buses() {
        unsafe {
            E1000_BAR0 = (device.bar0 & 0xFFFFFFF0) as usize;
            
            let ral = read_reg(REG_RAL);
            let rah = read_reg(REG_RAH);
            
            MAC_ADDRESS[0] = (ral & 0xFF) as u8; MAC_ADDRESS[1] = ((ral >> 8) & 0xFF) as u8;
            MAC_ADDRESS[2] = ((ral >> 16) & 0xFF) as u8; MAC_ADDRESS[3] = ((ral >> 24) & 0xFF) as u8;
            MAC_ADDRESS[4] = (rah & 0xFF) as u8; MAC_ADDRESS[5] = ((rah >> 8) & 0xFF) as u8;

            for i in 0..NUM_RX_DESC {
                RX_RING[i].address = core::ptr::addr_of!(RX_BUFFERS[i].data) as u64;
                RX_RING[i].status = 0;
            }
            let rx_phys = core::ptr::addr_of!(RX_RING) as u64;
            write_reg(REG_RXDESCLO, (rx_phys & 0xFFFFFFFF) as u32);
            write_reg(REG_RXDESCHI, (rx_phys >> 32) as u32);
            write_reg(REG_RXDESCLEN, (NUM_RX_DESC * core::mem::size_of::<RXDescriptor>()) as u32);
            write_reg(REG_RXDESCHEAD, 0);
            write_reg(REG_RXDESCTAIL, (NUM_RX_DESC - 1) as u32);
            
          // 🚀 BARE-METAL PROMISCUOUS MODE (NO LOOPBACK)
            // Bit 1 = EN, Bit 3 = UPE, Bit 4 = MPE, Bit 15 = BAM, Bit 26 = SECRC
            write_reg(REG_RCTRL, (1 << 1) | (1 << 3) | (1 << 4) | (1 << 15) | (1 << 26));
            for i in 0..NUM_TX_DESC {
                TX_RING[i].address = core::ptr::addr_of!(TX_BUFFERS[i].data) as u64;
                TX_RING[i].status = 1; 
            }
            let tx_phys = core::ptr::addr_of!(TX_RING) as u64;
            write_reg(REG_TXDESCLO, (tx_phys & 0xFFFFFFFF) as u32);
            write_reg(REG_TXDESCHI, (tx_phys >> 32) as u32);
            write_reg(REG_TXDESCLEN, (NUM_TX_DESC * core::mem::size_of::<TXDescriptor>()) as u32);
            write_reg(REG_TXDESCHEAD, 0);
            write_reg(REG_TXDESCTAIL, 0);

            write_reg(REG_TCTRL, (1 << 1) | (1 << 3) | (0x0F << 4) | (0x3F << 12));
            
            write_reg(REG_IMS, 0x1F6DC); 
            read_reg(REG_ICR);           

            crate::graphics::update_terminal_log("[NET] Zero-Copy DMA Aligned (128B). False Sharing Prevented.", 2);
            crate::graphics::update_terminal_log("[NET] PROMISCUOUS RX MODE ENABLED.", 11);
        }
    }
}

// In nexus-core/src/e1000.rs

// In nexus-core/src/e1000.rs

pub fn poll_packet() -> Option<alloc::vec::Vec<u8>> {
    unsafe {
        if E1000_BAR0 == 0 { return None; } 
        let cur = RX_CUR_INDEX.load(Ordering::Relaxed);
        let desc = &mut RX_RING[cur];

        // Status Bit 0 (DD) indicates Descriptor Done (Packet Received)
        if (desc.status & 1) == 1 {
            let len = desc.length as usize;
            let mut packet = alloc::vec::Vec::with_capacity(len);
            packet.extend_from_slice(&RX_BUFFERS[cur].data[..len]);
            
            clflush(core::ptr::addr_of!(RX_BUFFERS[cur]) as usize);

            // Clear status and give the descriptor back to hardware
            desc.status = 0;
            write_reg(REG_RXDESCTAIL, cur as u32);
            
            let next = (cur + 1) % NUM_RX_DESC;
            RX_CUR_INDEX.store(next, Ordering::Relaxed);
            
            return Some(packet);
        }
    }
    None
}
pub fn send_packet(data: &[u8]) {
    unsafe {
        if E1000_BAR0 == 0 { return; }
        
        let cur = TX_CUR_INDEX.load(Ordering::Relaxed);
        let len = data.len().min(2048);
        
        for i in 0..len {
            TX_BUFFERS[cur].data[i] = data[i];
        }

        clflush(core::ptr::addr_of!(TX_BUFFERS[cur]) as usize);

        TX_RING[cur].length = len as u16;
        TX_RING[cur].cmd = 0b0000_1011; 
        TX_RING[cur].status = 0;

        let next = (cur + 1) % NUM_TX_DESC;
        TX_CUR_INDEX.store(next, Ordering::Relaxed);
        write_reg(REG_TXDESCTAIL, next as u32);
    }
}

pub fn ack_interrupt() {
    unsafe { if E1000_BAR0 != 0 { read_reg(REG_ICR); } }
}