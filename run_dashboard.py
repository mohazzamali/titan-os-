import http.server
import socketserver
import webbrowser
import os

PORT = 8080
Handler = http.server.SimpleHTTPRequestHandler

# Ensure we are serving the directory containing the HTML file
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"🌍 COMMAND CENTER ONLINE AT: http://localhost:{PORT}/nexus_dashboard.html")
    print("Press Ctrl+C to shut down.")
    webbrowser.open(f'http://localhost:{PORT}/nexus_dashboard.html')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Command Center.")
