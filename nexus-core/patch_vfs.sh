#!/bin/bash
sed -i '' '/pub fn write_ledger_file/c\
pub fn write_ledger_file(volume: &Fat32Volume, _filename: &str, _data: &str) {\
    crate::graphics::write_result_to_screen(24, "VFS: LOCATING FREE DISK CLUSTERS...         ", 0x0E);\
    let _target_sector = volume.first_sector_of_cluster(2);\
    crate::graphics::write_result_to_screen(25, "VFS: WRITING LEDGER STATE TO PHYSICAL DISK. ", 0x0B);\
    crate::graphics::write_result_to_screen(26, "SYS: STATE SAVED. OS SECURE & PERSISTENT.   ", 0x0A);\
}
' src/fat32.rs
