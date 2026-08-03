// nexus-core/src/allocator.rs

use linked_list_allocator::LockedHeap;

// 🚀 V2.0: 4MB Heap for True VM Execution
pub const HEAP_SIZE: usize = 4 * 1024 * 1024; 
static mut HEAP_MEMORY: [u8; HEAP_SIZE] = [0; HEAP_SIZE];

// 🚀 V2.0: Industrial Grade Linked-List Allocator (Recycles memory!)
#[global_allocator]
static ALLOCATOR: LockedHeap = LockedHeap::empty();

pub fn init_heap() {
    unsafe {
        // 🚀 ROOT FIX: Cast the raw pointer to 'usize' explicitly
        ALLOCATOR.lock().init(HEAP_MEMORY.as_mut_ptr() as usize, HEAP_SIZE);
    }
    // Update the HUD to reflect the V2.0 Architecture
    crate::graphics::write_result_to_screen(5, "MEMORY: 4MB LINKED-LIST ALLOCATOR ONLINE    ", 0x0A);
}
