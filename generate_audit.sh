#!/bin/bash
OUTPUT="NEXUS_CORE_AUDIT.txt"
echo "🚀 NEXUS TITAN - CORE AUDIT REPORT" > $OUTPUT
echo "Generated on: $(date)" >> $OUTPUT
echo "=========================================" >> $OUTPUT
echo "📂 DIRECTORY STRUCTURE (Cleaned):" >> $OUTPUT
find . -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -name "*.iso" -not -name "*.wasm" | sort >> $OUTPUT
echo "" >> $OUTPUT
echo "=========================================" >> $OUTPUT
echo "📄 CORE SOURCE FILES:" >> $OUTPUT
find . -type f \( -name "*.js" -o -name "*.tsx" -o -name "*.rs" -o -name "Cargo.toml" -o -name "package.json" -o -name "*.cfg" \) -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.git/*" -not -path "*/.next/*" | while read file; do
    echo "" >> $OUTPUT
    echo "--- 🔹 FILE: $file ---" >> $OUTPUT
    cat "$file" >> $OUTPUT
done
echo "" >> $OUTPUT
echo "✅ AUDIT COMPLETE." >> $OUTPUT
