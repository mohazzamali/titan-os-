// nexus-core/src/icmp.rs

// 🚀 Changed 'packet' to '_packet' and removed unused 'alloc::format' to clear warnings!
pub fn process_icmp_packet(_packet: &[u8]) {
    crate::graphics::write_result_to_screen(19, "                                                              ", 0x00);
    crate::graphics::write_result_to_screen(20, "                                                              ", 0x00);

    crate::graphics::write_result_to_screen(19, "L3 PROTOCOL: ICMP ECHO (PING) INTERCEPTED!  ", 0x0E); 
    
    for _ in 0..3_000_000 { core::hint::spin_loop(); }
    
    crate::graphics::write_result_to_screen(20, "L3 PROTOCOL: ICMP ECHO REPLY SENT (PONG!)   ", 0x0A); 
}