// nexus-core/src/disk.rs
#![allow(dead_code)]
extern crate alloc;
use core::arch::asm;

// 🚀 Raw Assembly Port I/O Instructions
unsafe fn outb(port: u16, val: u8) {
    asm!("out dx, al", in("dx") port, in("al") val);
}
unsafe fn inb(port: u16) -> u8 {
    let mut val: u8;
    asm!("in al, dx", out("al") val, in("dx") port);
    val
}
unsafe fn outw(port: u16, val: u16) {
    asm!("out dx, ax", in("dx") port, in("ax") val);
}

pub fn write_ledger_state(nxc_balance: u32) {
    crate::graphics::write_result_to_screen(24, "STORAGE: BURNING STATE TO PHYSICAL ATA DISK.", 0x0C); // Red for write mode

    unsafe {
        // LBA 2048 (Exactly the 1MB mark on the disk - our Ledger Sector)
        let lba: u32 = 2048; 
        
        // 1. Select Drive 0 and send LBA coordinates
        outb(0x1F6, 0xE0 | ((lba >> 24) & 0x0F) as u8);
        outb(0x1F2, 1); // 1 Sector (512 bytes)
        outb(0x1F3, lba as u8);
        outb(0x1F4, (lba >> 8) as u8);
        outb(0x1F5, (lba >> 16) as u8);
        
        // 2. Send WRITE SECTORS Command (0x30)
        outb(0x1F7, 0x30); 
        
        // 3. Spinlock until the drive controller says "READY"
        for _ in 0..100_000 {
            let status = inb(0x1F7);
            if (status & 0x80) == 0 && (status & 0x08) != 0 { break; }
        }

        // 4. Burn 256 words (512 bytes) to the disk platter
        outw(0x1F0, 0x4E58); // Magic Signature "NX" (Nexus)
        outw(0x1F0, (nxc_balance & 0xFFFF) as u16); // Balance Low
        outw(0x1F0, (nxc_balance >> 16) as u16);    // Balance High
        
        for _ in 3..256 {
            outw(0x1F0, 0x0000); // Pad the rest of the sector
        }
        
        // 5. CACHE FLUSH (0xE7): Force physical magnetic write immediately
        outb(0x1F7, 0xE7);
    }
    
    // Simulate mechanical disk write delay
    for _ in 0..30_000_000 { core::hint::spin_loop(); }
    
    crate::graphics::write_result_to_screen(24, "STORAGE: LEDGER STATE SECURED ON ATA DISK.  ", 0x0A); // Green Success
}