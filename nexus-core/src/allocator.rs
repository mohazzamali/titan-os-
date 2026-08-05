#![allow(static_mut_refs)]
// nexus-core/src/allocator.rs
use x86_64::{
    structures::paging::{
        mapper::MapToError, FrameAllocator, Mapper, Page, PageTableFlags, Size4KiB,
    },
    VirtAddr,
};
use alloc::alloc::{GlobalAlloc, Layout};
use core::ptr::null_mut;
use spin::Mutex;

// The Heap Memory Map Boundaries
pub const HEAP_START: usize = 0_4444_4444_0000;
pub const HEAP_SIZE: usize = 10 * 1024 * 1024; // 10 MiB of Heap Memory

#[global_allocator]
static ALLOCATOR: LockedHeap = LockedHeap::empty();

pub struct LockedHeap(Mutex<BumpAllocator>);

impl LockedHeap {
    pub const fn empty() -> Self {
        LockedHeap(Mutex::new(BumpAllocator::new()))
    }
    
    pub unsafe fn init(&self, heap_start: usize, heap_size: usize) {
        self.0.lock().init(heap_start, heap_size);
    }
}

// 🚀 Bare-Metal Bump Allocator Implementation
pub struct BumpAllocator {
    heap_start: usize,
    heap_end: usize,
    next: usize,
    allocations: usize,
}

impl BumpAllocator {
    pub const fn new() -> Self {
        BumpAllocator {
            heap_start: 0,
            heap_end: 0,
            next: 0,
            allocations: 0,
        }
    }

    pub unsafe fn init(&mut self, heap_start: usize, heap_size: usize) {
        self.heap_start = heap_start;
        self.heap_end = heap_start + heap_size;
        self.next = heap_start;
    }
}

unsafe impl GlobalAlloc for LockedHeap {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let mut bump = self.0.lock(); // Lock the allocator

        let alloc_start = align_up(bump.next, layout.align());
        let alloc_end = match alloc_start.checked_add(layout.size()) {
            Some(end) => end,
            None => return null_mut(), // Integer overflow
        };

        if alloc_end > bump.heap_end {
            return null_mut(); // Out of memory
        }

        bump.next = alloc_end;
        bump.allocations += 1;
        alloc_start as *mut u8
    }

    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {
        let mut bump = self.0.lock();
        
        bump.allocations -= 1;
        // Bump allocators only free memory when ALL allocations are freed
        if bump.allocations == 0 {
            bump.next = bump.heap_start;
        }
    }
}

// Memory Alignment Helper
fn align_up(addr: usize, align: usize) -> usize {
    let remainder = addr % align;
    if remainder == 0 {
        addr
    } else {
        addr - remainder + align
    }
}

// 🚀 Init Routine: Mapping Physical Pages to Virtual Heap
pub fn init_heap(
    mapper: &mut impl Mapper<Size4KiB>,
    frame_allocator: &mut impl FrameAllocator<Size4KiB>,
) -> Result<(), MapToError<Size4KiB>> {
    let page_range = {
        let heap_start = VirtAddr::new(HEAP_START as u64);
        let heap_end = heap_start + HEAP_SIZE - 1u64;
        let heap_start_page = Page::containing_address(heap_start);
        let heap_end_page = Page::containing_address(heap_end);
        Page::range_inclusive(heap_start_page, heap_end_page)
    };

    for page in page_range {
        let frame = frame_allocator
            .allocate_frame()
            .ok_or(MapToError::FrameAllocationFailed)?;
        let flags = PageTableFlags::PRESENT | PageTableFlags::WRITABLE;
        unsafe {
            mapper.map_to(page, frame, flags, frame_allocator)?.flush();
        }
    }

    unsafe {
        ALLOCATOR.init(HEAP_START, HEAP_SIZE);
    }

    Ok(())
}
pub fn init_kernel_heap() {
    // 🚀 We carve out 2 Megabytes of raw RAM from the OS footprint!
    static mut KERNEL_HEAP: [u8; 2 * 1024 * 1024] = [0; 2 * 1024 * 1024];
    unsafe {
        ALLOCATOR.init(core::ptr::addr_of_mut!(KERNEL_HEAP) as usize, KERNEL_HEAP.len());
    }
}
