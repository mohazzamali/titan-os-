import os

ignore_dirs = set(['target', '.git', '.rustup', '.cargo', 'node_modules'])
# Har zaroori file extension include kar liya hai
allowed_exts = ('.rs', '.toml', '.yml', '.yaml', '.html', '.js', '.css', '.sh', '.json', '.md')

def generate_tree(dir_path, prefix=""):
    tree_str = ""
    try:
        entries = sorted([e for e in os.listdir(dir_path) if e not in ignore_dirs])
    except PermissionError:
        return ""
    
    for i, entry in enumerate(entries):
        path = os.path.join(dir_path, entry)
        is_last = (i == len(entries) - 1)
        connector = "└── " if is_last else "├── "
        tree_str += prefix + connector + entry + "\n"
        
        if os.path.isdir(path):
            extension = "    " if is_last else "│   "
            tree_str += generate_tree(path, prefix + extension)
    return tree_str

output_file = "NEXUS_FULL_CODEBASE.txt"

with open(output_file, "w", encoding="utf-8") as out:
    # 1. Folder Structure likhna
    out.write("="*60 + "\n")
    out.write("PROJECT FOLDER STRUCTURE\n")
    out.write("="*60 + "\n")
    out.write(".\n")
    out.write(generate_tree("."))
    out.write("\n\n")
    
    # 2. Saari files ka code likhna
    for root, dirs, files in os.walk("."):
        # Faltu folders (jaise target) ko skip karna
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for file in files:
            if file.endswith(allowed_exts) or "Dockerfile" in file:
                filepath = os.path.join(root, file)
                out.write(f"\n{'='*60}\nFILE: {filepath}\n{'='*60}\n")
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        out.write(f.read() + "\n")
                except Exception as e:
                    out.write(f"[ERROR READING FILE: {e}]\n")

print(f"✅ FULL AUDIT COMPLETE! Pura structure aur codebase '{output_file}' me save ho gaya hai.")
