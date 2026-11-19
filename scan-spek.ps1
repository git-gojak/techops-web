
# ============================================================
# GoJak TechOps - Temporary Hardware Scanner
# Version : 2.0.0
# Mode    : Temporary localhost bridge (no installation)
# Port    : 47831
# ============================================================

$ErrorActionPreference = "Stop"

$Port = 47831
$AllowedOrigin = "https://git-gojak.github.io"
$IdleTimeoutSeconds = 900
$LastActivity = Get-Date

function Get-SafeCim {
    param(
        [string]$ClassName,
        [string]$Filter
    )

    try {
        if ($Filter) {
            return @(Get-CimInstance -ClassName $ClassName -Filter $Filter -ErrorAction Stop)
        }

        return @(Get-CimInstance -ClassName $ClassName -ErrorAction Stop)
    }
    catch {
        return @()
    }
}

function Get-HardwareData {

    $computer = Get-SafeCim "Win32_ComputerSystem"
    $bios = Get-SafeCim "Win32_BIOS"
    $processors = Get-SafeCim "Win32_Processor"
    $memory = Get-SafeCim "Win32_PhysicalMemory"
    $disks = Get-SafeCim "Win32_DiskDrive"
    $gpus = Get-SafeCim "Win32_VideoController"
    $os = Get-SafeCim "Win32_OperatingSystem"
    $network = Get-SafeCim "Win32_NetworkAdapterConfiguration" "IPEnabled = TRUE"

    $ramGB = 0
    foreach ($item in $memory) {
        if ($item.Capacity) {
            $ramGB += [double]$item.Capacity
        }
    }

    $ramText = if ($ramGB -gt 0) {
        "$([math]::Round($ramGB / 1GB, 0)) GB"
    } else {
        "-"
    }

    $storageList = @()

    foreach ($disk in $disks) {
        if ($disk.Size) {
            $sizeGB = [math]::Round(([double]$disk.Size / 1GB), 0)
            $diskName = ([string]$disk.Model).Trim()

            if ($diskName) {
                $storageList += "$diskName ($sizeGB GB)"
            } else {
                $storageList += "$sizeGB GB"
            }
        }
    }

    $storageText = if ($storageList.Count -gt 0) {
        $storageList -join ", "
    } else {
        "-"
    }

    $cpuNames = @(
        $processors |
        ForEach-Object { ([string]$_.Name).Trim() } |
        Where-Object { $_ } |
        Select-Object -Unique
    )

    $cpuText = if ($cpuNames.Count -gt 0) {
        $cpuNames -join " / "
    } else {
        "-"
    }

    $coreCount = 0
    $threadCount = 0

    foreach ($processor in $processors) {
        $coreCount += [int]$processor.NumberOfCores
        $threadCount += [int]$processor.NumberOfLogicalProcessors
    }

    $gpuNames = @(
        $gpus |
        ForEach-Object { ([string]$_.Name).Trim() } |
        Where-Object { $_ } |
        Select-Object -Unique
    )

    $gpuText = if ($gpuNames.Count -gt 0) {
        $gpuNames -join " / "
    } else {
        "-"
    }

    $ipAddresses = @()
    $gateways = @()

    foreach ($adapter in $network) {

        if ($adapter.IPAddress) {
            $ipAddresses += @(
                $adapter.IPAddress |
                Where-Object {
                    $_ -match '^\d{1,3}(\.\d{1,3}){3}$' -and
                    $_ -ne "127.0.0.1"
                }
            )
        }

        if ($adapter.DefaultIPGateway) {
            $gateways += @(
                $adapter.DefaultIPGateway |
                Where-Object {
                    $_ -match '^\d{1,3}(\.\d{1,3}){3}$'
                }
            )
        }
    }

    $ipText = if ($ipAddresses.Count -gt 0) {
        ($ipAddresses | Select-Object -Unique) -join ", "
    } else {
        "-"
    }

    $gatewayText = if ($gateways.Count -gt 0) {
        ($gateways | Select-Object -Unique) -join ", "
    } else {
        "-"
    }

    $computerName = $env:COMPUTERNAME

    $manufacturer = "-"
    $model = "-"
    $serial = "-"

    if ($computer.Count -gt 0) {
        if ($computer[0].Manufacturer) {
            $manufacturer = ([string]$computer[0].Manufacturer).Trim()
        }

        if ($computer[0].Model) {
            $model = ([string]$computer[0].Model).Trim()
        }
    }

    if ($bios.Count -gt 0 -and $bios[0].SerialNumber) {
        $serial = ([string]$bios[0].SerialNumber).Trim()
    }

    $osText = "-"

    if ($os.Count -gt 0) {
        $osText = ([string]$os[0].Caption).Trim()

        if ($os[0].OSArchitecture) {
            $osText += " ($($os[0].OSArchitecture))"
        }
    }

    return [ordered]@{
        computerName    = $computerName
        manufacturer    = $manufacturer
        model           = $model
        assetSerialID   = $serial
        cpu             = $cpuText
        core            = $coreCount
        thread          = $threadCount
        ram             = $ramText
        storage         = $storageText
        gpu             = $gpuText
        operatingSystem = $osText
        ipAddress       = $ipText
        gateway         = $gatewayText
        scannedAt       = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
}

function Send-HttpResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [string]$Body,
        [string]$Origin
    )

    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)

    $headers = @(
        "HTTP/1.1 $StatusCode $StatusText"
        "Content-Type: application/json; charset=utf-8"
        "Content-Length: $($bodyBytes.Length)"
        "Connection: close"
        "Cache-Control: no-store"
        "X-Content-Type-Options: nosniff"
    )

    if ($Origin -eq $AllowedOrigin) {
        $headers += "Access-Control-Allow-Origin: $AllowedOrigin"
        $headers += "Vary: Origin"
        $headers += "Access-Control-Allow-Methods: GET, OPTIONS"
        $headers += "Access-Control-Allow-Headers: Content-Type"
        $headers += "Access-Control-Allow-Private-Network: true"
    }

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes(
        ($headers -join "`r`n") + "`r`n`r`n"
    )

    $Stream.Write($headerBytes, 0, $headerBytes.Length)

    if ($bodyBytes.Length -gt 0) {
        $Stream.Write($bodyBytes, 0, $bodyBytes.Length)
    }

    $Stream.Flush()
}

function Send-Json {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        $Object,
        [string]$Origin
    )

    $json = ConvertTo-Json -InputObject $Object -Depth 8 -Compress

    Send-HttpResponse `
        -Stream $Stream `
        -StatusCode $StatusCode `
        -StatusText $StatusText `
        -Body $json `
        -Origin $Origin
}

function Handle-Client {
    param(
        [System.Net.Sockets.TcpClient]$Client
    )

    $stream = $Client.GetStream()

    try {
        $reader = New-Object System.IO.StreamReader(
            $stream,
            [System.Text.Encoding]::ASCII,
            $false,
            1024,
            $true
        )

        $requestLine = $reader.ReadLine()

        if ([string]::IsNullOrWhiteSpace($requestLine)) {
            return
        }

        $parts = $requestLine.Split(" ")

        if ($parts.Count -lt 2) {
            return
        }

        $method = $parts[0].ToUpperInvariant()
        $path = $parts[1].Split("?")[0]

        $headers = @{}

        while ($true) {
            $line = $reader.ReadLine()

            if ([string]::IsNullOrEmpty($line)) {
                break
            }

            $separator = $line.IndexOf(":")

            if ($separator -gt 0) {
                $key = $line.Substring(0, $separator).Trim().ToLowerInvariant()
                $value = $line.Substring($separator + 1).Trim()
                $headers[$key] = $value
            }
        }

        $origin = ""
        if ($headers.ContainsKey("origin")) {
            $origin = $headers["origin"]
        }

        if ($origin -and $origin -ne $AllowedOrigin) {
            Send-Json $stream 403 "Forbidden" @{
                success = $false
                message = "Origin tidak diizinkan."
            } $origin
            return
        }

        if ($method -eq "OPTIONS") {
            Send-HttpResponse $stream 204 "No Content" "" $origin
            return
        }

        if ($method -ne "GET") {
            Send-Json $stream 405 "Method Not Allowed" @{
                success = $false
                message = "Method tidak didukung."
            } $origin
            return
        }

        if ($path -eq "/health") {
            Send-Json $stream 200 "OK" @{
                success = $true
                service = "GoJak Hardware Scanner"
                version = "2.0.0"
                status = "running"
            } $origin
            return
        }

        if ($path -eq "/scan") {

            Write-Host ""
            Write-Host "Membaca spesifikasi hardware..." -ForegroundColor Cyan

            $data = Get-HardwareData

            Send-Json $stream 200 "OK" @{
                success = $true
                data = $data
            } $origin

            Write-Host "Scan selesai: $($data.computerName)" -ForegroundColor Green
            return
        }

        Send-Json $stream 404 "Not Found" @{
            success = $false
            message = "Endpoint tidak ditemukan."
        } $origin
    }
    catch {
        Write-Host "Request error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    finally {
        $stream.Dispose()
        $Client.Close()
    }
}

# ============================================================
# START TEMPORARY LOCAL BRIDGE
# ============================================================

$listener = $null

try {
    $listener = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback,
        $Port
    )

    $listener.Start()

    Clear-Host

    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host "       GoJak TechOps Hardware Scanner         " -ForegroundColor Cyan
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Status       : AKTIF" -ForegroundColor Green
    Write-Host "Versi        : 2.0.0"
    Write-Host "Alamat       : http://127.0.0.1:$Port"
    Write-Host "Mode         : Temporary / Read Only"
    Write-Host "Auto Stop    : $IdleTimeoutSeconds detik tanpa aktivitas"
    Write-Host ""
    Write-Host "Silakan kembali ke GoJak TechOps." -ForegroundColor Yellow
    Write-Host "Klik tombol Scan Spesifikasi." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Tekan CTRL+C untuk menghentikan scanner." -ForegroundColor Gray
    Write-Host "==============================================" -ForegroundColor Cyan

    while ($true) {

        if ($listener.Pending()) {
            $client = $listener.AcceptTcpClient()
            $LastActivity = Get-Date
            Handle-Client $client
            $LastActivity = Get-Date
        }
        else {
            if (((Get-Date) - $LastActivity).TotalSeconds -ge $IdleTimeoutSeconds) {
                Write-Host ""
                Write-Host "Scanner berhenti otomatis karena tidak digunakan." -ForegroundColor Yellow
                break
            }

            Start-Sleep -Milliseconds 200
        }
    }
}
catch {
    Write-Host ""
    Write-Host "Gagal menjalankan Hardware Scanner:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
finally {
    if ($listener) {
        $listener.Stop()
    }

    Write-Host ""
    Write-Host "GoJak Hardware Scanner sudah dihentikan." -ForegroundColor Gray
}
