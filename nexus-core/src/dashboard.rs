// nexus-core/src/dashboard.rs

extern crate alloc;

pub fn render_nexus_brain() {
    let peer_count = crate::kademlia::get_peer_count();
    
    let current_neurons = { crate::gnn::GRAPH.lock().len() };
    if current_neurons < peer_count {
        crate::gnn::add_neuron_to_brain(peer_count);
    }

    let network_health = crate::gnn::optimize_network_trust();
    
    let msg1 = alloc::format!("GNN: GRAPH OPTIMIZED! GLOBAL TRUST: {}%   ", network_health);
    crate::graphics::write_result_to_screen(24, &msg1, 0x0A); // Moved to row 24 for UI
    
    // 🚀 FLUSH TO MONITOR (Zero-Flicker Execution!)
    crate::graphics::flush_to_monitor();
}