
# GoJak TechOps - Temporary Hardware Scanner
# Version 1.1.0
# Hardware identification follows INVENTARIS KOMPUTER V6
# Read-only. No Google Sheets writes.
# Runs only on 127.0.0.1:47831

$ErrorActionPreference = "Stop"

$Port = 47831
$AllowedOrigin = "https://git-gojak.github.io"
$IdleTimeout = 900
$LastActivity = Get-Date

# ==========================================
# NORMALISASI DATA - MENGIKUTI invcpu.ps1
# ==========================================

function Safe($v) {
    if ($null -eq $v) { return "-" }

    $s = "$v".Trim()

    if ([string]::IsNullOrWhiteSpace($s)) {
        return "-"
    }

    return $s
}

function Serial($v) {
    $s = Safe $v

    $bad = @(
        'TO BE FILLED BY O.E.M.'
        'TO BE FILLED BY OEM'
        'DEFAULT STRING'
        'SYSTEM SERIAL NUMBER'
        'UNKNOWN'
        'NONE'
        'NOT SPECIFIED'
    )

    if ($bad -contains $s.ToUpperInvariant()) {
        return "-"
    }

    return $s
}

function RamType($smbios, $legacy) {
    $map = @{
        20 = 'DDR'
        21 = 'DDR2'
        22 = 'DDR2 FB-DIMM'
        24 = 'DDR3'
        26 = 'DDR4'
        27 = 'LPDDR'
        28 = 'LPDDR2'
        29 = 'LPDDR3'
        30 = 'LPDDR4'
        31 = 'LPDDR5'
        34 = 'DDR5'
    }

    $n = 0

    if ([int]::TryParse("$smbios", [ref]$n) -and $map.ContainsKey($n)) {
        return $map[$n]
    }

    if ([int]::TryParse("$legacy", [ref]$n)) {
        switch ($n) {
            20 { return 'DDR' }
            21 { return 'DDR2' }
            22 { return 'DDR2 FB-DIMM' }
            24 { return 'DDR3' }
            26 { return 'DDR4' }
            30 { return 'DDR4' }
        }
    }

    return 'Unknown'
}

function Manufacturer($v) {
    $s = Safe $v
    $u = $s.ToUpperInvariant()

    if ($u -match 'DELL') { return 'Dell' }
    if ($u -match 'LENOVO') { return 'Lenovo' }
    if ($u -match 'HP|HEWLETT') { return 'HP' }
    if ($u -match 'ASUSTEK|ASUS') { return 'ASUS' }
    if ($u -match 'ACER') { return 'Acer' }
    if ($u -match 'ZYREX') { return 'Zyrex' }

    return $s
}

# ==========================================
# MEMBACA SPESIFIKASI KOMPUTER
# ==========================================

function Get-HardwareData {

    $cs = Get-CimInstance Win32_ComputerSystem
    $bios = Get-CimInstance Win32_BIOS
    $os = Get-CimInstance Win32_OperatingSystem

    # Mengikuti invcpu.ps1: processor pertama
    $cpuInfo = Get-CimInstance Win32_Processor |
        Select-Object -First 1

    # IDENTITAS
    $computerName = Safe $env:COMPUTERNAME

    $manufacturer = Manufacturer $cs.Manufacturer
    $model = Safe $cs.Model

    if (
        [string]::IsNullOrWhiteSpace($manufacturer) -or
        $manufacturer -match "System manufacturer|To Be Filled|Default string"
    ) {
        $manufacturer = "-"
    }

    if (
        [string]::IsNullOrWhiteSpace($model) -or
        $model -match "System Product Name|To Be Filled|Default string"
    ) {
        $model = "-"
    }

    # Normalisasi vendor mengikuti invcpu.ps1
    if ($manufacturer -match '^Dell') {
        $manufacturer = "Dell"
    }
    elseif ($manufacturer -match '^HP|Hewlett') {
        $manufacturer = "HP"
    }
    elseif ($manufacturer -match 'Lenovo') {
        $manufacturer = "Lenovo"
    }
    elseif ($manufacturer -match '^ASUSTeK|^ASUS') {
        $manufacturer = "ASUS"
    }
    elseif ($manufacturer -match '^Acer') {
        $manufacturer = "Acer"
    }
    elseif ($manufacturer -match '^Zyrex') {
        $manufacturer = "Zyrex"
    }
    elseif ($manufacturer -eq "-") {
        $manufacturer = "Rakitan"
    }

    $assetSerialID = Serial $bios.SerialNumber

    # CPU
    $cpu = Safe $cpuInfo.Name

    $cpu = $cpu -replace '\(R\)', ''
    $cpu = $cpu -replace '\(TM\)', ''
    $cpu = $cpu -replace '\s+CPU\s+', ' '
    $cpu = ($cpu -replace '\s+', ' ').Trim()

    $core = Safe $cpuInfo.NumberOfCores
    $thread = Safe $cpuInfo.NumberOfLogicalProcessors

    # RAM - detail setiap modul mengikuti invcpu.ps1
    $ramModules = @(Get-CimInstance Win32_PhysicalMemory)

    $total = ($ramModules | Measure-Object Capacity -Sum).Sum

    $totalGB = if ($total) {
        [math]::Round($total / 1GB, 0)
    }
    else {
        '-'
    }

    $parts = @()

    foreach ($r in $ramModules) {

        $gb = if ($r.Capacity) {
            [math]::Round($r.Capacity / 1GB, 0)
        }
        else {
            '-'
        }

        $type = RamType $r.SMBIOSMemoryType $r.MemoryType

        $speed = $r.ConfiguredClockSpeed

        if (!$speed) {
            $speed = $r.Speed
        }

        if ($speed) {
            $parts += "$gb GB $type $speed MHz"
        }
        else {
            $parts += "$gb GB $type"
        }
    }

    $ram = if ($parts.Count) {
        "$totalGB GB (" + ($parts -join ' + ') + ')'
    }
    else {
        '-'
    }

    # STORAGE - format mengikuti invcpu.ps1
    $disks = @(Get-CimInstance Win32_DiskDrive)

    $storageParts = @()

    foreach ($d in $disks) {

        $cap = if ($d.Size) {
            "$([math]::Round($d.Size / 1GB, 0)) GB"
        }
        else {
            '-'
        }

        $storageParts += "$(Safe $d.Model) ($cap)"
    }

    $storage = if ($storageParts.Count) {
        $storageParts -join ' + '
    }
    else {
        '-'
    }

    # GPU - penyaringan mengikuti invcpu.ps1
    $gpuParts = @()

    foreach ($g in @(Get-CimInstance Win32_VideoController)) {

        $n = Safe $g.Name
        $u = $n.ToUpperInvariant()

        if (
            $u -match 'MICROSOFT REMOTE|BASIC DISPLAY|REMOTE|VIRTUAL|VMWARE|VIRTUALBOX|HYPER-V'
        ) {
            continue
        }

        if ($n -ne '-') {
            $gpuParts += $n
        }
    }

    $gpuParts = @($gpuParts | Select-Object -Unique)

    $gpu = if ($gpuParts.Count) {
        $gpuParts -join ' + '
    }
    else {
        '-'
    }

    $gpu = $gpu -replace '\(R\)', ''
    $gpu = $gpu -replace '\(TM\)', ''
    $gpu = ($gpu -replace '\s+', ' ').Trim()

    # SISTEM OPERASI
    $operatingSystem = Safe $os.Caption

    # NETWORK - tambahan TechOps
    $net = @(
        Get-CimInstance Win32_NetworkAdapterConfiguration |
        Where-Object { $_.IPEnabled }
    )

    $ip = @(
        $net.IPAddress |
        ForEach-Object {
            $_ | Where-Object {
                $_ -match '^\d{1,3}(\.\d{1,3}){3}$'
            }
        }
    ) | Select-Object -Unique

    $gateways = @(
        $net.DefaultIPGateway |
        Where-Object { $_ }
    ) | Select-Object -Unique

    # FORMAT DATA TETAP SESUAI hardware-scan.js
    [PSCustomObject]@{
        computerName    = $computerName
        manufacturer    = $manufacturer
        model           = $model
        assetSerialID   = $assetSerialID
        cpu             = $cpu
        core            = "$core"
        thread          = "$thread"
        ram             = $ram
        storage         = $storage
        gpu             = $gpu
        operatingSystem = $operatingSystem
        ipAddress       = ($ip -join ', ')
        gateway         = ($gateways -join ', ')
        scannedAt       = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
}

# ==========================================
# RESPONSE HTTP
# ==========================================

function Send-Response {
    param(
        $Stream,
        [int]$Status,
        [string]$Body,
        [string]$Origin
    )

    $bytes = [Text.Encoding]::UTF8.GetBytes($Body)

    $headers = @(
        "HTTP/1.1 $Status"
        "Content-Type: application/json; charset=utf-8"
        "Content-Length: $($bytes.Length)"
        "Connection: close"
        "Access-Control-Allow-Origin: $Origin"
        "Access-Control-Allow-Methods: GET, OPTIONS"
        "Access-Control-Allow-Headers: Content-Type"
        "Access-Control-Allow-Private-Network: true"
        ""
        ""
    ) -join "`r`n"

    $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)

    $Stream.Write($headerBytes, 0, $headerBytes.Length)

    if ($bytes.Length -gt 0) {
        $Stream.Write($bytes, 0, $bytes.Length)
    }

    $Stream.Flush()
}

# ==========================================
# LOCAL SERVER
# ==========================================

$listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Loopback,
    $Port
)

try {

    $listener.Start()

    Write-Host ""
    Write-Host "GoJak TechOps Hardware Scanner aktif." -ForegroundColor Green
    Write-Host "Alamat: http://127.0.0.1:$Port"
    Write-Host "Kembali ke GoJak TechOps, lalu klik Scan Spesifikasi."
    Write-Host "Otomatis berhenti setelah 15 menit tanpa aktivitas."
    Write-Host "Tekan Ctrl+C untuk berhenti."
    Write-Host ""

    while ($true) {

        if (((Get-Date) - $LastActivity).TotalSeconds -ge $IdleTimeout) {
            Write-Host "Scanner berhenti karena idle."
            break
        }

        if (-not $listener.Pending()) {
            Start-Sleep -Milliseconds 150
            continue
        }

        $client = $listener.AcceptTcpClient()

        $LastActivity = Get-Date

        try {

            $stream = $client.GetStream()
            $stream.ReadTimeout = 5000

            $reader = [System.IO.StreamReader]::new(
                $stream,
                [Text.Encoding]::ASCII,
                $false,
                1024,
                $true
            )

            $requestLine = $reader.ReadLine()

            $origin = ""
            $method = ""
            $path = ""

            if ($requestLine -match '^(\S+)\s+(\S+)') {
                $method = $Matches[1]
                $path = $Matches[2].Split("?")[0]
            }

            while ($true) {
                $line = $reader.ReadLine()

                if ([string]::IsNullOrEmpty($line)) {
                    break
                }

                if ($line -match '^Origin:\s*(.+)$') {
                    $origin = $Matches[1].Trim()
                }
            }

            # Origin wajib cocok. Origin kosong ditolak.
            if ($origin -ne $AllowedOrigin) {

                Send-Response $stream 403 `
                    '{"success":false,"message":"Origin ditolak"}' `
                    $AllowedOrigin
            }
            elseif ($method -eq "OPTIONS") {

                Send-Response $stream 204 "" $AllowedOrigin
            }
            elseif ($method -eq "GET" -and $path -eq "/health") {

                $body = @{
                    success = $true
                    service = "GoJak Hardware Scanner"
                    version = "1.1.0"
                } | ConvertTo-Json -Compress

                Send-Response $stream 200 $body $AllowedOrigin
            }
            elseif ($method -eq "GET" -and $path -eq "/scan") {

                Write-Host "Membaca spesifikasi komputer..." -ForegroundColor Cyan

                $data = Get-HardwareData

                $body = @{
                    success = $true
                    data = $data
                } | ConvertTo-Json -Depth 6 -Compress

                Send-Response $stream 200 $body $AllowedOrigin

                Write-Host "Scan berhasil: $($data.computerName)" -ForegroundColor Green
            }
            else {

                Send-Response $stream 404 `
                    '{"success":false,"message":"Endpoint tidak ditemukan"}' `
                    $AllowedOrigin
            }
        }
        catch {
            Write-Host "Kesalahan: $($_.Exception.Message)" -ForegroundColor Red
        }
        finally {
            if ($client) {
                $client.Close()
            }
        }
    }
}
finally {

    $listener.Stop()

    Write-Host "GoJak Hardware Scanner dihentikan."
}
