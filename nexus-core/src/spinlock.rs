// nexus-core/src/spinlock.rs
use core::sync::atomic::{AtomicBool, Ordering};
use core::cell::UnsafeCell;

pub struct SpinLock<T> {
    locked: AtomicBool,
    data: UnsafeCell<T>,
}

unsafe impl<T> Sync for SpinLock<T> {}

impl<T> SpinLock<T> {
    pub const fn new(value: T) -> Self {
        Self { locked: AtomicBool::new(false), data: UnsafeCell::new(value) }
    }

    // 🚀 ZERO-WARNING FIX: Explicit lifetime match ('_)
    pub fn lock(&self) -> SpinLockGuard<'_, T> {
        while self.locked.compare_exchange_weak(false, true, Ordering::Acquire, Ordering::Relaxed).is_err() {
            core::hint::spin_loop(); 
        }
        SpinLockGuard { lock: self }
    }
}

pub struct SpinLockGuard<'a, T> { lock: &'a SpinLock<T> }

impl<T> core::ops::Deref for SpinLockGuard<'_, T> {
    type Target = T;
    fn deref(&self) -> &T { unsafe { &*self.lock.data.get() } }
}

impl<T> core::ops::DerefMut for SpinLockGuard<'_, T> {
    fn deref_mut(&mut self) -> &mut T { unsafe { &mut *self.lock.data.get() } }
}

impl<T> Drop for SpinLockGuard<'_, T> {
    fn drop(&mut self) { self.lock.locked.store(false, Ordering::Release); }
}
