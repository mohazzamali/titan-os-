// nexus-core/src/keyboard.rs

use crate::spinlock::SpinLock;
use x86_64::instructions::port::Port;

// 🚀 REAL OS ENGINEERING: A Circular Ring Buffer (Prevents CPU Blocking)
pub struct RingBuffer {
    pub data: [u8; 256],
    pub head: usize,
    pub tail: usize,
}

impl RingBuffer {
    pub const fn new() -> Self {
        RingBuffer { data: [0; 256], head: 0, tail: 0 }
    }
    
    // Called by the Hardware Interrupt (Producer)
    pub fn push(&mut self, val: u8) {
        let next = (self.tail + 1) % 256;
        if next != self.head { // Drop keystrokes if buffer is full (Standard OS fail-safe)
            self.data[self.tail] = val;
            self.tail = next;
        }
    }
    
    // Called by the Shell Task (Consumer)
    pub fn pop(&mut self) -> Option<u8> {
        if self.head == self.tail {
            None
        } else {
            let val = self.data[self.head];
            self.head = (self.head + 1) % 256;
            Some(val)
        }
    }
}

pub static SCANCODE_QUEUE: SpinLock<RingBuffer> = SpinLock::new(RingBuffer::new());

// 🚀 THIS IS ONLY CALLED BY THE CPU HARDWARE INTERRUPT (IRQ 1)
pub fn read_scancode_from_hardware() {
    let mut port = Port::new(0x60); // PS/2 Keyboard Port
    let scancode: u8 = unsafe { port.read() };
    SCANCODE_QUEUE.lock().push(scancode);
}