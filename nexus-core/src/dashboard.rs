extern crate alloc;
use alloc::format;
use core::sync::atomic::Ordering;

pub fn render_matrix_hud() {
    let trust_level = crate::consensus::GLOBAL_TRUST.load(Ordering::Relaxed);
    let tvl = *crate::consensus::NETWORK_TVL.lock();

    // 🚀 L1: HARDWARE TELEMETRY
    crate::graphics::write_result_to_screen(2, "  [ L1: HARDWARE TELEMETRY ]                  [ L2: DECENTRALIZED FABRIC ]      ", 0x0E);
    crate::graphics::write_result_to_screen(4, "  CPU CORES:   [##########] 4/4 ON            KADEMLIA DHT:   ACTIVE (PORT 9999)", 0x0A);
    crate::graphics::write_result_to_screen(5, "  MEMORY:      [###.......] 32 MB             P2P SWARM:      WAITING FOR PEERS ", 0x0A);
    crate::graphics::write_result_to_screen(6, "  NVMe VFS:    [##########] OK                NIC DMA RINGS:  ZERO-COPY ENABLED ", 0x0A);

    // 🚀 L3 & L4: ENGINE & CONSENSUS
    crate::graphics::write_result_to_screen(9, "  [ L3: WASM SANDBOX ENGINE ]                 [ L4: BFT CONSENSUS LEDGER ]      ", 0x0D);
    crate::graphics::write_result_to_screen(11,"  VIRTUAL ROM:    smart_contract.wasm         NETWORK TVL:    ", 0x0A);
    crate::graphics::write_result_to_screen(12,"  EXEC STATUS:    STANDBY                     GLOBAL TRUST:   ", 0x0A);
    
    // Live Dynamic Variables
    let tvl_msg = format!("{} NXC        ", tvl);
    crate::graphics::write_result_to_screen(11, &tvl_msg, 0x0A); // Ensure specific col logic if needed, or format padding
    
    let trust_msg = format!("{}%          ", trust_level);
    crate::graphics::write_result_to_screen(12, &trust_msg, 0x0A);

    // Bottom Status Bar
    let status = format!(" SYS: GRAPH OPTIMIZED! GLOBAL TRUST: {}%                             ", trust_level);
    crate::graphics::write_result_to_screen(24, &status, 0x0A);
}

pub fn render_nexus_brain() {
    render_matrix_hud();
}