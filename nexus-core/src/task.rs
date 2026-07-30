use alloc::vec::Vec;
use crate::spinlock::SpinLock;

pub enum TaskType { Light, Heavy }

pub struct Task {
    pub id: u64,
    pub sender_id: u64,
    pub payload: Vec<u8>,
}

pub struct AdaptiveScheduler {
    pub queue: Vec<Task>,
    pub task_counter: u64,
}

impl AdaptiveScheduler {
    pub const fn new() -> Self {
        Self { queue: Vec::new(), task_counter: 0 }
    }

    pub fn spawn(&mut self, payload: Vec<u8>, sender_id: u64) {
        self.task_counter += 1;
        self.queue.push(Task {
            id: self.task_counter,
            sender_id,
            payload,
        });
    }

    pub fn schedule_next(&mut self) -> Option<Task> {
        if self.queue.is_empty() {
            None
        } else {
            Some(self.queue.remove(0))
        }
    }
}

pub static SCHEDULER: SpinLock<AdaptiveScheduler> = SpinLock::new(AdaptiveScheduler::new());