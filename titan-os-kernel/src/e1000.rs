#![allow(warnings)]

use x86_64::instructions::port::Port;
use crate::vga;
use core::arch::asm; // 🚀 Required for forcing CPU Cache Flush

static mut IO_BASE: u16 = 0;
static mut PHYS_OFFSET: u64 = 0;
static mut MAC: [u8; 6] = [0x52, 0x54, 0x00, 0x12, 0x34, 0x56]; 

#[repr(C, packed)]
#[derive(Clone, Copy)]
struct TXDescriptor { addr: u64, length: u16, cso: u8, cmd: u8, status: u8, css: u8, special: u16 }

#[repr(C, packed)]
#[derive(Clone, Copy)]
struct RXDescriptor { addr: u64, length: u16, checksum: u16, status: u8, errors: u8, special: u16 }

#[repr(C, align(4096))]
struct NetworkMemory {
    tx_ring: [TXDescriptor; 8],
    rx_ring: [RXDescriptor; 8],
    tx_buffer: [u8; 2048],
    rx_buffers: [[u8; 2048]; 8],
}

static mut RX_CUR: usize = 0;

unsafe fn get_net_mem() -> *mut NetworkMemory {
    let virt_addr = PHYS_OFFSET + 0x0200_0000; 
    virt_addr as *mut NetworkMemory
}

unsafe fn write_reg(offset: usize, val: u32) {
    let base = *core::ptr::addr_of!(IO_BASE);
    let mut addr_port = Port::<u32>::new(base);
    let mut data_port = Port::<u32>::new(base + 4);
    addr_port.write(offset as u32);
    data_port.write(val);
}

unsafe fn read_reg(offset: usize) -> u32 {
    let base = *core::ptr::addr_of!(IO_BASE);
    let mut addr_port = Port::<u32>::new(base);
    let mut data_port = Port::<u32>::new(base + 4);
    addr_port.write(offset as u32);
    data_port.read()
}

pub fn init(base_addr: usize, offset: u64) {
    unsafe { 
        *core::ptr::addr_of_mut!(IO_BASE) = base_addr as u16; 
        *core::ptr::addr_of_mut!(PHYS_OFFSET) = offset;
    }
    vga::print(6, "[NET] Intel E1000 IO Ports Linked (MMIO Bypassed!).", 0x0E);
    vga::print(7, "                                        ", 0x00);
    vga::print(7, "[NET] BARE-METAL MAC SECURED: 52:54:00:12:34:56", 0x0B);
}

pub fn enable_tx_rx() {
    unsafe {
        let net_mem = get_net_mem();
        core::ptr::write_bytes(net_mem as *mut u8, 0, core::mem::size_of::<NetworkMemory>()); 
        
        let ctrl = read_reg(0x0000);
        write_reg(0x0000, ctrl | (1 << 6)); // Set Link Up
        for i in 0..128 { write_reg(0x5200 + (i * 4), 0); }

        let tx_ring_phys = (core::ptr::addr_of!((*net_mem).tx_ring) as u64) - PHYS_OFFSET;
        write_reg(0x3800, (tx_ring_phys & 0xFFFFFFFF) as u32);
        write_reg(0x3804, (tx_ring_phys >> 32) as u32);
        write_reg(0x3808, (8 * 16) as u32);
        write_reg(0x3810, 0);
        write_reg(0x3818, 0);
        write_reg(0x0400, (1 << 1) | (1 << 3) | (0x0F << 4) | (0x3F << 12)); 
        
        let rx_ring_phys = (core::ptr::addr_of!((*net_mem).rx_ring) as u64) - PHYS_OFFSET;
        let rx_raw = core::ptr::addr_of_mut!((*net_mem).rx_ring) as *mut RXDescriptor;
        
        for i in 0..8 {
            let buf_phys = (core::ptr::addr_of!((*net_mem).rx_buffers[i]) as u64) - PHYS_OFFSET;
            core::ptr::write_volatile(core::ptr::addr_of_mut!((*rx_raw.add(i)).addr), buf_phys);
            core::ptr::write_volatile(core::ptr::addr_of_mut!((*rx_raw.add(i)).status), 0);
        }
        
        write_reg(0x2800, (rx_ring_phys & 0xFFFFFFFF) as u32);
        write_reg(0x2804, (rx_ring_phys >> 32) as u32);
        write_reg(0x2808, (8 * 16) as u32);
        write_reg(0x2810, 0);
        write_reg(0x2818, 7); 
        
        write_reg(0x0100, (1 << 1) | (1 << 3) | (1 << 4) | (1 << 15) | (1 << 26)); 
        vga::print(9, "[NET] TX/RX DMA Ring-Buffers Activated.", 0x0A);
    }
}

pub fn send_packet() {
    unsafe {
        let mut frame = [0u8; 64];
        frame[0..6].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); 
        let mac_val = *core::ptr::addr_of!(MAC);
        frame[6..12].copy_from_slice(&mac_val); 
        frame[12] = 0x08; frame[13] = 0x06; 
        frame[14] = 0x00; frame[15] = 0x01; 
        frame[16] = 0x08; frame[17] = 0x00; 
        frame[18] = 0x06; frame[19] = 0x04; 
        frame[20] = 0x00; frame[21] = 0x01; 
        frame[22..28].copy_from_slice(&mac_val);
        frame[28..32].copy_from_slice(&[10, 0, 2, 15]); 
        frame[32..38].copy_from_slice(&[0x00; 6]);      
        frame[38..42].copy_from_slice(&[10, 0, 2, 2]);  
        
        let net_mem = get_net_mem();
        let buf_ptr = core::ptr::addr_of_mut!((*net_mem).tx_buffer) as *mut u8;
        core::ptr::copy_nonoverlapping(frame.as_ptr(), buf_ptr, 64);
        
        let ring_raw = core::ptr::addr_of_mut!((*net_mem).tx_ring) as *mut TXDescriptor;
        let buf_phys = (buf_ptr as u64) - PHYS_OFFSET;
        core::ptr::write_volatile(core::ptr::addr_of_mut!((*ring_raw.add(0)).addr), buf_phys);
        core::ptr::write_volatile(core::ptr::addr_of_mut!((*ring_raw.add(0)).length), 64);
        core::ptr::write_volatile(core::ptr::addr_of_mut!((*ring_raw.add(0)).cmd), (1 << 3) | (1 << 1) | (1 << 0));
        core::ptr::write_volatile(core::ptr::addr_of_mut!((*ring_raw.add(0)).status), 0);
        
        // 🚀 THE BRUTE-FORCE HAMMER: Force CPU to flush cache directly to physical RAM instantly
        asm!("wbinvd", options(nostack, nomem));
        
        write_reg(0x3818, 1); // Ring Doorbell
        vga::print(11, ">> [TX] ARP ROUTER DISCOVERY PACKET FIRED! <<", 0x0D); 
    }
}

pub fn poll() {
    unsafe {
        static mut TICKS: u64 = 0;
        TICKS += 1;
        
        if TICKS % 5_000_000 == 0 {
            send_packet();
        }

        // 🚀 THE RX HAMMER: Force CPU to read fresh from RAM, bypassing all caches
        if TICKS % 100_000 == 0 {
            asm!("wbinvd", options(nostack, nomem));
        }

        let cur = *core::ptr::addr_of!(RX_CUR);
        let net_mem = get_net_mem();
        let status = core::ptr::read_volatile(core::ptr::addr_of!((*net_mem).rx_ring[cur].status));
        
        if (status & 1) == 1 { 
            vga::print(14, "<< [RX] ARP REPLY INTERCEPTED FROM QEMU ROUTER! >>", 0x0B);
            core::ptr::write_volatile(core::ptr::addr_of_mut!((*net_mem).rx_ring[cur].status), 0);
            write_reg(0x2818, cur as u32);
            *core::ptr::addr_of_mut!(RX_CUR) = (cur + 1) % 8;
        }
    }
}
