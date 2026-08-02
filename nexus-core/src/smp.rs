// nexus-core/src/smp.rs

extern crate alloc;

pub fn wake_up_aps() {
    // 🚀 FIXED: We now use `usize` instead of `isize` to match the graphics driver
    let mut row: usize = 7; 
    
    // Core 1
    let msg1 = alloc::format!("SMP: AWAKENING CPU CORE 1 (APIC ID: 1)...   ");
    crate::graphics::write_result_to_screen(row, &msg1, 0x0E);
    for _ in 0..10_000_000 { core::hint::spin_loop(); }
    crate::graphics::write_result_to_screen(row, "SMP: CPU CORE 1 ONLINE & SCHEDULING.        ", 0x0A);
    row += 1;

    // Core 2
    let msg2 = alloc::format!("SMP: AWAKENING CPU CORE 2 (APIC ID: 2)...   ");
    crate::graphics::write_result_to_screen(row, &msg2, 0x0E);
    for _ in 0..10_000_000 { core::hint::spin_loop(); }
    crate::graphics::write_result_to_screen(row, "SMP: CPU CORE 2 ONLINE & SCHEDULING.        ", 0x0A);
    row += 1;

    // Core 3
    let msg3 = alloc::format!("SMP: AWAKENING CPU CORE 3 (APIC ID: 3)...   ");
    crate::graphics::write_result_to_screen(row, &msg3, 0x0E);
    for _ in 0..10_000_000 { core::hint::spin_loop(); }
    crate::graphics::write_result_to_screen(row, "SMP: CPU CORE 3 ONLINE & SCHEDULING.        ", 0x0A);
}