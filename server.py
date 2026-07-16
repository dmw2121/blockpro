import http.server
import socketserver
import socket
import subprocess
import threading
import json
import time
import sys
import re

PORT = 3002
CONFIG_FILE = "config.json"

# State dictionary to hold config data
config_data = {
    "local_ips": [],
    "tunnel_url": None,
    "port": PORT
}

def get_local_ips():
    ips = []
    # Try connecting to external host to find the active interface IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        primary_ip = s.getsockname()[0]
        ips.append(primary_ip)
        s.close()
    except Exception:
        pass

    # Fallback/Additional check using hostname
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if ip not in ips and not ip.startswith("127."):
                ips.append(ip)
    except Exception:
        pass

    if not ips:
        ips = ["127.0.0.1"]
    return ips

def save_config():
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config_data, f, indent=4)
        print(f"[CONFIG] Updated config.json: {config_data}")
    except Exception as e:
        print(f"[CONFIG] Error saving config: {e}", file=sys.stderr)

def start_tunnel():
    print("[TUNNEL] Starting SSH tunnel via localhost.run...")
    # localhost.run ssh command
    cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-R", f"80:127.0.0.1:{PORT}", "nokey@localhost.run"]
    
    try:
        # Merge stderr to stdout to catch all output
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    except FileNotFoundError:
        print("[TUNNEL] Error: 'ssh' command not found. Please make sure OpenSSH client is installed.", file=sys.stderr)
        return
    except Exception as e:
        print(f"[TUNNEL] Error starting SSH process: {e}", file=sys.stderr)
        return

    # Regex to find https URL ending with lhr.life or lhr.run
    url_pattern = re.compile(r"https://[a-zA-Z0-9.-]+\.lhr\.(?:life|run)")

    # Read output line by line
    while True:
        line = proc.stdout.readline()
        if not line:
            break
        
        print(f"[SSH OUTPUT] {line.strip()}")
        
        # Search for tunnel URL
        match = url_pattern.search(line)
        if match:
            url = match.group(0)
            print(f"[TUNNEL] Detected Tunnel URL: {url}")
            config_data["tunnel_url"] = url
            save_config()
            
    # If the process terminates, check return code
    returncode = proc.wait()
    print(f"[TUNNEL] SSH process terminated with exit code {returncode}")

def run_server():
    # Make sure server handles CORS and caches disabled for testing
    class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            super().end_headers()

    class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
        allow_reuse_address = True

    print(f"[SERVER] Starting HTTP server on port {PORT}...")
    with ThreadingTCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"[SERVER] Serving files at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("[SERVER] Shutting down...")
            httpd.shutdown()

if __name__ == "__main__":
    # 1. Discover IPs and save initial config
    config_data["local_ips"] = get_local_ips()
    save_config()

    # 2. Start SSH tunnel in a daemon thread
    tunnel_thread = threading.Thread(target=start_tunnel, daemon=True)
    tunnel_thread.start()

    # 3. Run the HTTP server (blocks main thread)
    run_server()
