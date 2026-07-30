// nexus-core/src/allocator.rs

use core::alloc::{GlobalAlloc, Layout};
use core::ptr::null_mut;
use spin::Mutex;

// 🚀 1. DEFINE OUR KERNEL HEAP (100 KB of Raw RAM)
pub const HEAP_SIZE: usize = 100 * 1024;
static mut HEAP_MEMORY: [u8; HEAP_SIZE] = [0; HEAP_SIZE];

// 🚀 2. THE ALLOCATOR LOGIC
pub struct BumpAllocator {
    heap_start: usize,
    heap_end: usize,
    next: usize,
    allocations: usize,
}

impl BumpAllocator {
    pub const fn new() -> Self {
        BumpAllocator { heap_start: 0, heap_end: 0, next: 0, allocations: 0 }
    }
    
    pub unsafe fn init(&mut self, heap_start: usize, heap_size: usize) {
        self.heap_start = heap_start;
        self.heap_end = heap_start + heap_size;
        self.next = heap_start;
    }
}

// Memory alignment helper
fn align_up(addr: usize, align: usize) -> usize {
    (addr + align - 1) & !(align - 1)
}

// 🚀 3. THE GLOBAL ALLOCATOR TRAIT IMPLEMENTATION
pub struct Locked<A> { inner: Mutex<A> }
impl<A> Locked<A> { pub const fn new(inner: A) -> Self { Locked { inner: Mutex::new(inner) } } }

unsafe impl GlobalAlloc for Locked<BumpAllocator> {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let mut bump = self.inner.lock();
        
        let alloc_start = align_up(bump.next, layout.align());
        let alloc_end = alloc_start.saturating_add(layout.size());

        if alloc_end <= bump.heap_end {
            bump.next = alloc_end;
            bump.allocations += 1;
            alloc_start as *mut u8
        } else {
            null_mut() // Out of memory (OOM) panic trigger
        }
    }

    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {
        let mut bump = self.inner.lock();
        bump.allocations -= 1;
        
        // If all memory is freed, completely reset the heap pointer for reuse!
        if bump.allocations == 0 {
            bump.next = bump.heap_start;
        }
    }
}

// Tell Rust to use this as the official memory manager!
#[global_allocator]
static ALLOCATOR: Locked<BumpAllocator> = Locked::new(BumpAllocator::new());

// 🚀 4. KERNEL ENTRY FUNCTION
pub fn init_heap() {
    unsafe {
        ALLOCATOR.inner.lock().init(HEAP_MEMORY.as_ptr() as usize, HEAP_SIZE);
    }
    // Render to Matrix Dashboard
    crate::graphics::write_result_to_screen(5, "MEMORY: 100KB DYNAMIC HEAP ALLOCATOR ONLINE", 0x0A);
}