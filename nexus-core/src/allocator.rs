// nexus-core/src/allocator.rs
#![allow(dead_code)]

use linked_list_allocator::LockedHeap;

// 🚀 THE TRUE OS MEMORY MANAGER: Allocates, Frees, and Recycles RAM perfectly!
#[global_allocator]
pub static ALLOCATOR: LockedHeap = LockedHeap::empty();

pub fn init_heap(heap_start: usize, heap_size: usize) {
    unsafe {
        // Initialize the heap with our 25MB RAM block
        ALLOCATOR.lock().init(heap_start as *mut u8, heap_size);
    }
}