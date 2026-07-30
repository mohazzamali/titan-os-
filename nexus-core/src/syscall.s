.global syscall_handler
syscall_handler:
    # 🎯 SAVE USER STATE
    # Yahan hum registers save karenge aur kernel stack par switch karenge
    # Fir actual driver function call karenge (sys_read, sys_write, etc.)
    
    # Placeholder: Bas ek print statement print karke wapas jao
    mov rax, 0
    sysretq
