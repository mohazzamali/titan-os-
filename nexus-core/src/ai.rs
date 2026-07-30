// nexus-core/src/ai.rs

extern crate alloc;

// 🚀 BARE-METAL PERCEPTRON (Using Fixed-Point Math to prevent FPU crashes)
pub struct Perceptron {
    // Weights and Bias scaled by 100 (e.g., 75 = 0.75 weight)
    weights: [i32; 3], 
    bias: i32,
}

impl Perceptron {
    pub const fn new() -> Self {
        // Pre-trained Neural Weights for "Network Threat Detection"
        Perceptron {
            weights: [75, -25, 90], // W1 (Packet Size), W2 (Errors), W3 (Latency)
            bias: -1000,            // Threshold Bias
        }
    }

    // The Activation Function
    pub fn predict(&self, inputs: [i32; 3]) -> i32 {
        let mut sum = self.bias;
        
        // Summation: (W1*I1) + (W2*I2) + (W3*I3) + Bias
        for i in 0..3 {
            sum += self.weights[i] * inputs[i];
        }
        
        // Step Activation: If sum is high, it's a THREAT (1), else SECURE (0)
        if sum > 5000 { 1 } else { 0 }
    }
}

pub static NEXUS_BRAIN: Perceptron = Perceptron::new();

pub fn run_inference(_task_id: u64, inputs: [i32; 3]) -> i32 {
    crate::graphics::write_result_to_screen(10, "AI: NEURAL NETWORK (PERCEPTRON) ENGAGED!    ", 0x0D); // Pink
    
    // Simulate Neural Tensor Computation
    for _ in 0..3_000_000 { core::hint::spin_loop(); }
    
    let prediction = NEXUS_BRAIN.predict(inputs);
    
    if prediction == 1 {
        crate::graphics::write_result_to_screen(11, "AI: INFERENCE -> [ THREAT DETECTED ]        ", 0x0C); // Red Alert
    } else {
        crate::graphics::write_result_to_screen(11, "AI: INFERENCE -> [ SYSTEM SECURE ]          ", 0x0A); // Green Safe
    }
    
    prediction
}