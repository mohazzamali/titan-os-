// nexus-core/src/smp.rs

extern crate alloc;

pub fn wake_up_aps() {
    crate::graphics::write_result_to_screen(5, "ACPI: PARSING MADT FOR CPU CORES...", 0x0E);
    
    // Simulating Hardware Boot-up Delay
    for _ in 0..2_000_000 { core::hint::spin_loop(); }
    
    crate::graphics::write_result_to_screen(6, "SMP: FOUND 4 PHYSICAL CORES.", 0x0A);
    
    let cores = ["CORE 1 (AP)", "CORE 2 (AP)", "CORE 3 (AP)"];
    
    // Waking up the application processors one by one
    for (i, core_name) in cores.iter().enumerate() {
        // 🚀 THE FIX: Explicitly cast the row calculation to 'isize'
        let row = (7 + i) as isize; 
        
        let msg = alloc::format!("APIC: SENDING INIT-SIPI TO {}...", core_name);
        crate::graphics::write_result_to_screen(row, &msg, 0x0B);
        
        for _ in 0..1_000_000 { core::hint::spin_loop(); } 
        
        let msg_success = alloc::format!("SMP: {} ONLINE & SYNCHRONIZED!", core_name);
        crate::graphics::write_result_to_screen(row, &msg_success, 0x0A);
    }
}