
# GoJak TechOps - Temporary Hardware Scanner
# Version 1.0.0
# Read-only. No Google Sheets writes.
# Runs only on 127.0.0.1:47831

$ErrorActionPreference = "Stop"

$Port = 47831
$AllowedOrigin = "https://git-gojak.github.io"
$IdleTimeout = 900
$LastActivity = Get-Date

function Get-HardwareData {
    $cs  = Get-CimInstance Win32_ComputerSystem
    $bios = Get-CimInstance Win32_BIOS
    $cpu = Get-CimInstance Win32_Processor
    $os = Get-CimInstance Win32_OperatingSystem
    $ram = Get-CimInstance Win32_PhysicalMemory
    $disk = Get-CimInstance Win32_DiskDrive
    $gpu = Get-CimInstance Win32_VideoController
    $net = Get-CimInstance Win32_NetworkAdapterConfiguration |
        Where-Object { $_.IPEnabled }

    $totalRam = [math]::Round(
        (($ram | Measure-Object Capacity -Sum).Sum / 1GB), 0
    )

    $storage = @(
        $disk | ForEach-Object {
            $size = [math]::Round($_.Size / 1GB, 0)
            if ($size -gt 0) {
                "$($_.Model) ($size GB)"
            }
        }
    ) -join ", "

    $ip = @(
        $net.IPAddress | ForEach-Object {
            $_ | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' }
        }
    ) | Select-Object -Unique

    $gateways = @(
        $net.DefaultIPGateway | Where-Object { $_ }
    ) | Select-Object -Unique

    [PSCustomObject]@{
        computerName   = $cs.Name
        manufacturer   = $cs.Manufacturer
        model          = $cs.Model
        assetSerialID  = $bios.SerialNumber
        cpu            = (($cpu | ForEach-Object { $_.Name.Trim() }) -join ", ")
        core           = ($cpu | Measure-Object NumberOfCores -Sum).Sum
        thread         = ($cpu | Measure-Object NumberOfLogicalProcessors -Sum).Sum
        ram            = "$totalRam GB"
        storage        = $storage
        gpu            = (($gpu | ForEach-Object { $_.Name }) -join ", ")
        operatingSystem = $os.Caption
        ipAddress      = ($ip -join ", ")
        gateway        = ($gateways -join ", ")
        scannedAt      = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
}

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

$listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Loopback, $Port
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
                $stream, [Text.Encoding]::ASCII, $false, 1024, $true
            )

            $requestLine = $reader.ReadLine()
            $origin = $AllowedOrigin
            $method = ""
            $path = ""

            if ($requestLine -match '^(\S+)\s+(\S+)') {
                $method = $Matches[1]
                $path = $Matches[2].Split("?")[0]
            }

            while ($true) {
                $line = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($line)) { break }
                if ($line -match '^Origin:\s*(.+)$') {
                    $origin = $Matches[1].Trim()
                }
            }

            if ($origin -ne $AllowedOrigin) {
                Send-Response $stream 403 '{"success":false,"message":"Origin ditolak"}' $AllowedOrigin
            }
            elseif ($method -eq "OPTIONS") {
                Send-Response $stream 204 "" $AllowedOrigin
            }
            elseif ($method -eq "GET" -and $path -eq "/health") {
                $body = @{
                    success = $true
                    service = "GoJak Hardware Scanner"
                    version = "1.0.0"
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
                Send-Response $stream 404 '{"success":false,"message":"Endpoint tidak ditemukan"}' $AllowedOrigin
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
