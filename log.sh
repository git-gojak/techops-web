
#!/usr/bin/env bash
# GOJAK TECHOPS - LINUX HARDWARE SCANNER
# Ubuntu / Linux - local scanner bridge for TechOps Web

set -Eeuo pipefail

PORT=47831
ALLOWED_ORIGIN="https://git-gojak.github.io"
IDLE_TIMEOUT=900

for cmd in python3 sudo hostname lscpu lsblk awk sed tr sort wc; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "ERROR: Perintah '$cmd' belum tersedia."
    exit 1
  }
done

echo
echo "========== GOJAK TECHOPS LINUX SCANNER =========="
echo "Meminta izin sudo untuk membaca Serial BIOS..."

sudo -v || {
  echo "ERROR: Izin sudo diperlukan."
  exit 1
}

clean() {
  local value="${1:-}"
  value="$(printf '%s' "$value" |
    tr '\r\n' ' ' |
    sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"

  [[ -n "$value" ]] && printf '%s' "$value" || printf '%s' "-"
}

read_dmi() {
  local file="$1"
  local value="-"

  if [[ -r "$file" ]]; then
    value="$(cat "$file" 2>/dev/null || true)"
  else
    value="$(sudo -n cat "$file" 2>/dev/null || true)"
  fi

  clean "$value"
}

# ==============================
# IDENTITAS KOMPUTER
# ==============================

computer_name="$(clean "$(hostname 2>/dev/null || true)")"
manufacturer="$(read_dmi /sys/class/dmi/id/sys_vendor)"
model="$(read_dmi /sys/class/dmi/id/product_name)"
serial="$(read_dmi /sys/class/dmi/id/product_serial)"

case "${serial^^}" in
  ""|"-"|"TO BE FILLED BY O.E.M."|"TO BE FILLED BY OEM"|"DEFAULT STRING"|"SYSTEM SERIAL NUMBER"|"UNKNOWN"|"NONE"|"NOT SPECIFIED")
    serial="-"
    ;;
esac

# ==============================
# CPU
# ==============================

cpu="$(
  LC_ALL=C lscpu 2>/dev/null |
  awk -F: '/^Model name:/ {
    sub(/^[ \t]+/,"",$2)
    print $2
    exit
  }'
)"
cpu="$(clean "$cpu")"

core="$(
  LC_ALL=C lscpu -p=CORE,SOCKET 2>/dev/null |
  awk -F, '!/^#/ && NF>=2 {print $1 "," $2}' |
  sort -u |
  wc -l |
  tr -d ' '
)"

thread="$(
  LC_ALL=C lscpu -p=CPU 2>/dev/null |
  awk '!/^#/ && NF {n++} END {print n+0}'
)"

[[ "$core" == "0" ]] && core="-"
[[ "$thread" == "0" ]] && thread="-"

# ==============================
# RAM
# ==============================

ram="$(
  awk '/MemTotal:/ {
    printf "%.1f GB", $2/1048576
  }' /proc/meminfo 2>/dev/null
)"
ram="$(clean "$ram")"

# ==============================
# STORAGE
# ==============================

storage="$(
  lsblk -dn -o NAME,SIZE,TYPE,MODEL 2>/dev/null |
  awk '$3=="disk" {
    model=""
    for(i=4;i<=NF;i++)
      model=model (i==4?"":" ") $i

    item=$1 " " $2

    if(model!="")
      item=item " (" model ")"

    printf "%s%s", sep, item
    sep=" + "
  }
  END {
    if(sep=="") print "-"
  }'
)"
storage="$(clean "$storage")"

# ==============================
# GPU
# ==============================

gpu="-"

if command -v lspci >/dev/null 2>&1; then
  gpu="$(
    lspci 2>/dev/null |
    awk 'BEGIN{IGNORECASE=1}
      /VGA compatible controller|3D controller|Display controller/ {
        sub(/^[^:]*: /,"")
        printf "%s%s", sep, $0
        sep=" + "
      }
      END {
        if(sep=="") print "-"
      }'
  )"
fi

gpu="$(clean "$gpu")"

# ==============================
# OPERATING SYSTEM
# ==============================

operating_system="-"

if [[ -r /etc/os-release ]]; then
  operating_system="$(
    . /etc/os-release
    printf '%s' "${PRETTY_NAME:-${NAME:-Linux}}"
  )"
fi

operating_system="$(clean "$operating_system")"

# ==============================
# NETWORK
# ==============================

ip_address="$(hostname -I 2>/dev/null || true)"
ip_address="$(clean "$ip_address")"

gateway="-"

if command -v ip >/dev/null 2>&1; then
  gateway="$(
    ip route 2>/dev/null |
    awk '/^default/ {print $3; exit}'
  )"
fi

gateway="$(clean "$gateway")"

# ==============================
# VALIDASI SERIAL
# ==============================

if [[ "$serial" == "-" ]]; then
  echo
  echo "ERROR: Serial BIOS tidak terbaca."
  echo "Data tidak dikirim karena pencocokan inventaris"
  echo "TechOps menggunakan Asset / Serial ID."
  echo
  echo "Periksa dukungan DMI/BIOS dan izin sudo."
  exit 2
fi

# ==============================
# TAMPILKAN HASIL SCAN
# ==============================

echo
printf '%-18s: %s\n' "Computer Name" "$computer_name"
printf '%-18s: %s\n' "Manufacturer" "$manufacturer"
printf '%-18s: %s\n' "Model" "$model"
printf '%-18s: %s\n' "Asset/Serial ID" "$serial"
printf '%-18s: %s\n' "CPU" "$cpu"
printf '%-18s: %s\n' "Core" "$core"
printf '%-18s: %s\n' "Thread" "$thread"
printf '%-18s: %s\n' "RAM" "$ram"
printf '%-18s: %s\n' "Storage" "$storage"
printf '%-18s: %s\n' "GPU" "$gpu"
printf '%-18s: %s\n' "Operating System" "$operating_system"
printf '%-18s: %s\n' "IP Address" "$ip_address"
printf '%-18s: %s\n' "Gateway" "$gateway"

# ==============================
# DATA UNTUK LOCAL API
# ==============================

export SCAN_COMPUTER_NAME="$computer_name"
export SCAN_MANUFACTURER="$manufacturer"
export SCAN_MODEL="$model"
export SCAN_SERIAL="$serial"
export SCAN_CPU="$cpu"
export SCAN_CORE="$core"
export SCAN_THREAD="$thread"
export SCAN_RAM="$ram"
export SCAN_STORAGE="$storage"
export SCAN_GPU="$gpu"
export SCAN_OS="$operating_system"
export SCAN_IP="$ip_address"
export SCAN_GATEWAY="$gateway"
export SCAN_ORIGIN="$ALLOWED_ORIGIN"
export SCAN_IDLE_TIMEOUT="$IDLE_TIMEOUT"

echo
echo "=============================================="
echo "GoJak TechOps Linux Hardware Scanner aktif"
echo "Local API : http://127.0.0.1:$PORT"
echo "=============================================="
echo
echo "Kembali ke TechOps Web lalu klik Scan Spesifikasi."
echo "Berhenti otomatis setelah 15 menit tanpa aktivitas."
echo "Tekan Ctrl+C untuk berhenti."
echo

# ==============================
# LOCAL HTTP BRIDGE
# ==============================

python3 - <<'PY'
import json
import os
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 47831
ALLOWED_ORIGIN = os.environ["SCAN_ORIGIN"]
IDLE_TIMEOUT = int(os.environ["SCAN_IDLE_TIMEOUT"])

last_activity = time.monotonic()

data = {
    "computerName": os.environ.get("SCAN_COMPUTER_NAME", "-"),
    "manufacturer": os.environ.get("SCAN_MANUFACTURER", "-"),
    "model": os.environ.get("SCAN_MODEL", "-"),
    "assetSerialID": os.environ.get("SCAN_SERIAL", "-"),
    "cpu": os.environ.get("SCAN_CPU", "-"),
    "core": os.environ.get("SCAN_CORE", "-"),
    "thread": os.environ.get("SCAN_THREAD", "-"),
    "ram": os.environ.get("SCAN_RAM", "-"),
    "storage": os.environ.get("SCAN_STORAGE", "-"),
    "gpu": os.environ.get("SCAN_GPU", "-"),
    "operatingSystem": os.environ.get("SCAN_OS", "-"),
    "ipAddress": os.environ.get("SCAN_IP", "-"),
    "gateway": os.environ.get("SCAN_GATEWAY", "-"),
    "scannedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
}

class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print("[TechOps Linux Scanner] " + (fmt % args))

    def respond(self, status, payload=None):
        body = b""

        if payload is not None:
            body = json.dumps(
                payload,
                ensure_ascii=False
            ).encode("utf-8")

        self.send_response(status)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.send_header(
            "Access-Control-Allow-Origin",
            ALLOWED_ORIGIN
        )
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, OPTIONS"
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )
        self.send_header(
            "Access-Control-Allow-Private-Network",
            "true"
        )
        self.send_header("Vary", "Origin")
        self.end_headers()

        if body:
            self.wfile.write(body)

    def origin_allowed(self):
        return self.headers.get("Origin", "") == ALLOWED_ORIGIN

    def do_OPTIONS(self):
        global last_activity

        if not self.origin_allowed():
            self.respond(
                403,
                {"success": False, "message": "Origin ditolak"}
            )
            return

        last_activity = time.monotonic()
        self.respond(204)

    def do_GET(self):
        global last_activity

        if not self.origin_allowed():
            self.respond(
                403,
                {"success": False, "message": "Origin ditolak"}
            )
            return

        last_activity = time.monotonic()
        path = self.path.split("?", 1)[0]

        if path == "/health":
            self.respond(200, {
                "success": True,
                "service": "GoJak Linux Hardware Scanner",
                "version": "1.0.0"
            })

        elif path == "/scan":
            self.respond(200, {
                "success": True,
                "data": data
            })
            print("Scan berhasil: " + data["computerName"])

        else:
            self.respond(404, {
                "success": False,
                "message": "Endpoint tidak ditemukan"
            })

class LocalServer(HTTPServer):
    allow_reuse_address = True

server = LocalServer(("127.0.0.1", PORT), Handler)

try:
    while True:
        if time.monotonic() - last_activity >= IDLE_TIMEOUT:
            print("Scanner berhenti karena idle.")
            break

        server.timeout = 1
        server.handle_request()

finally:
    server.server_close()
    print("GoJak Linux Hardware Scanner dihentikan.")
PY
