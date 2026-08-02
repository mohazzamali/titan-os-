// nexus-core/src/ai.rs

extern crate alloc;

// 🚀 BARE-METAL PERCEPTRON (Fixed-Point Math Engine)
pub struct Perceptron {
    weights: [i32; 3], 
    bias: i32,
}

impl Perceptron {
    pub const fn new() -> Self {
        // 🚀 RECALIBRATED WEIGHTS (The Intelligence Upgrade)
        // W1 (Packet Size) is now low impact. W2 (Errors) and W3 (Latency) are high impact.
        Perceptron {
            weights: [2, 100, 5], 
            bias: -500,            
        }
    }

    pub fn predict(&self, inputs: [i32; 3]) -> i32 {
        let mut sum = self.bias;
        for i in 0..3 {
            sum += self.weights[i] * inputs[i];
        }
        
        // If Sum > 5000, it's a DDoS attack
        if sum > 5000 { 1 } else { 0 }
    }
}

pub static NEXUS_BRAIN: Perceptron = Perceptron::new();

pub fn run_inference(_task_id: u64, inputs: [i32; 3], row: usize) -> i32 {
    let msg = alloc::format!("AI: TENSOR COMPUTE ENGAGED -> INPUTS {:?}  ", inputs);
    crate::graphics::write_result_to_screen(row, &msg, 0x0D); 
    
    // Simulating heavy core load
    for _ in 0..8_000_000 { core::hint::spin_loop(); }
    
    let prediction = NEXUS_BRAIN.predict(inputs);
    
    if prediction == 1 {
        crate::graphics::write_result_to_screen(row + 1, "AI: INFERENCE -> [ THREAT DETECTED - DROP PACKETS ] ", 0x0C); 
    } else {
        crate::graphics::write_result_to_screen(row + 1, "AI: INFERENCE -> [ SYSTEM SECURE - ROUTE TRAFFIC ]  ", 0x0A); 
    }
    
    prediction
}

pub fn execute_ai_scan() {
    // Shifted up to Row 17
    crate::graphics::write_result_to_screen(17, "AI: LOADING NEXUS NEURAL WEIGHTS TO CPU L1 CACHE...", 0x0E); 

    // Scenario 1: Normal Network Traffic 
    let safe_telemetry = [150, 0, 12];
    run_inference(1, safe_telemetry, 18); // Writes to 18 and 19

    for _ in 0..10_000_000 { core::hint::spin_loop(); } // Pause for visual effect

    // Scenario 2: DDoS / Malicious Traffic 
    let threat_telemetry = [1500, 50, 999];
    run_inference(2, threat_telemetry, 20); // Writes to 20 and 21. (Rows 22, 23, 24 are now safe for the shell!)
}