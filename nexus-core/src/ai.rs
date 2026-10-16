// nexus-core/src/ai.rs
extern crate alloc;

pub struct Perceptron {
    weights: [i32; 3],
    bias: i32,
}

impl Perceptron {
    pub const fn new() -> Self {
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
        if sum > 5000 { 1 } else { 0 }
    }
}

pub static NEXUS_BRAIN: Perceptron = Perceptron::new();

pub fn inspect_packet_telemetry(packet_bytes: usize, shards: u32) -> i32 {
    let inputs = [packet_bytes as i32, 0, (shards & 0xFF) as i32];
    let prediction = NEXUS_BRAIN.predict(inputs);
    if prediction == 1 {
        crate::graphics::update_terminal_log("[AI] PACKET ANOMALY DETECTED - DROPPING FRAME.", 12);
    }
    prediction
}
