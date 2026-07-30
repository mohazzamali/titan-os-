// nexus-core/src/scheduler.rs

extern crate alloc;
use alloc::collections::VecDeque;
use spin::Mutex;
use crate::process::Task;

pub static TASK_QUEUE: Mutex<VecDeque<Task>> = Mutex::new(VecDeque::new());
// 🚀 THE GHOST BUG FIX: Track the currently running task separately!
pub static CURRENT_TASK: Mutex<Option<Task>> = Mutex::new(None);

#[no_mangle]
pub extern "C" fn schedule_next_task(current_rsp: u64) -> u64 {
    // Acknowledge PIC interrupt (Port 0x20)
    unsafe { x86_64::instructions::port::Port::<u8>::new(0x20).write(0x20); }

    let mut queue = TASK_QUEUE.lock();
    let mut current_task_lock = CURRENT_TASK.lock();

    if queue.is_empty() {
        return current_rsp; 
    }

    // Save the outgoing task (if any)
    if let Some(mut task) = current_task_lock.take() {
        task.stack_pointer = current_rsp;
        queue.push_back(task);
    }

    // Load the incoming task
    let next_task = queue.pop_front().unwrap();
    let next_rsp = next_task.stack_pointer;
    
    *current_task_lock = Some(next_task);

    next_rsp
}

pub fn add_task(entry_point: fn()) {
    let mut queue = TASK_QUEUE.lock();
    let id = queue.len() as u64 + 1;
    let new_task = Task::new(id, entry_point as u64);
    queue.push_back(new_task);
}