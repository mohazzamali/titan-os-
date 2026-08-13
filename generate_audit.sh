echo "=====================================================" > project_audit_report.txt
echo " 🚀 NEXUS TITAN: MASTER PROJECT AUDIT REPORT" >> project_audit_report.txt
echo "=====================================================" >> project_audit_report.txt
echo "Generated on Host Machine (macOS)" >> project_audit_report.txt
echo "" >> project_audit_report.txt

echo "[1] DIRECTORY & FILE STRUCTURE:" >> project_audit_report.txt
find . -not -path '*/.*' -not -path './target*' >> project_audit_report.txt
echo -e "\n\n" >> project_audit_report.txt

echo "[2] SOURCE CODE CONTENTS:" >> project_audit_report.txt
find nexus-core/src -name "*.rs" | while read file; do
    echo "-----------------------------------------------------" >> project_audit_report.txt
    echo "FILE PATH: $file" >> project_audit_report.txt
    echo "-----------------------------------------------------" >> project_audit_report.txt
    cat "$file" >> project_audit_report.txt
    echo -e "\n\n" >> project_audit_report.txt
done

echo "Audit Report Generated Successfully: project_audit_report.txt"
