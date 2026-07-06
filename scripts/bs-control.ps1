# BlueStacks control tool
# Author: Mavis | Purpose: wrap ADB operations for BlueStacks 5 + fallback Android devices
# Usage:
#   .\bs-control.ps1 <command> [args]
#   .\bs-control.ps1 devices                # list connected devices
#   .\bs-control.ps1 connect                # auto-connect 5555/5556/5557
#   .\bs-control.ps1 screenshot             # screenshot to reports/screen-YYYYMMDD-HHMMSS.png
#   .\bs-control.ps1 tap 540 960            # tap coordinates
#   .\bs-control.ps1 text "Hello World"     # input text
#   .\bs-control.ps1 swipe 540 1500 540 500 # swipe
#   .\bs-control.ps1 keyevent home          # key (home/back/recent/volume_up/...)
#   .\bs-control.ps1 install app.apk        # install APK
#   .\bs-control.ps1 launch com.app.id      # launch app
#   .\bs-control.ps1 logcat [tag]           # logcat
#   .\bs-control.ps1 record [seconds=10]    # screen record
#   .\bs-control.ps1 pull /sdcard/x ./out/  # pull file
#   .\bs-control.ps1 push ./local /sdcard/  # push file
#   .\bs-control.ps1 info                   # device info
#   .\bs-control.ps1 shell <cmd>            # passthrough adb shell
#   .\bs-control.ps1 sleep 3                # sleep seconds
#
# Set $env:BS_DEVICE = "127.0.0.1:5555" to specify default device

[CmdletBinding()]
param(
    [Parameter(Position=0, Mandatory=$true)]
    [string]$Command,

    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

# Default device
$Device = if ($env:BS_DEVICE) { $env:BS_DEVICE } else { "127.0.0.1:5555" }

# Fallback ports (BlueStacks multi-instance / Android Studio emulator)
$AltPorts = @(5555, 5556, 5557)

# Screenshot directory (project-internal)
$ScreenshotDir = Join-Path $ProjectRoot "scripts\bs-app-test\reports\screenshots"
if (-not (Test-Path $ScreenshotDir)) { New-Item -ItemType Directory -Path $ScreenshotDir -Force | Out-Null }

# ---------- ADB utility functions ----------

function Get-AdbPath {
    $adb = Get-Command adb -ErrorAction SilentlyContinue
    if ($adb) { return $adb.Source }
    # Fallback paths
    $candidates = @(
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "D:\Android\platform-tools\adb.exe",
        "C:\Android\platform-tools\adb.exe"
    )
    foreach ($p in $candidates) { if (Test-Path $p) { return $p } }
    throw "adb not found. Please install Android Platform Tools and add to PATH."
}

function Invoke-Adb {
    # Stream output (for piping to file/etc). For binary streams like screencap.
    param([string[]]$AdbArgs)
    $adb = Get-AdbPath
    & $adb @AdbArgs
}

function Invoke-AdbCapture {
    # Capture stdout+stderr as array (for parsing). Uses 2>&1 to merge ErrorRecords.
    param([string[]]$AdbArgs)
    $adb = Get-AdbPath
    $output = & $adb @AdbArgs 2>&1
    # Convert ErrorRecord to string for clean output
    $lines = @()
    foreach ($line in $output) {
        if ($line -is [System.Management.Automation.ErrorRecord]) {
            $lines += $line.ToString()
        } else {
            $lines += $line
        }
    }
    return $lines
}

function Invoke-Device {
    # Stream mode (for binary output like screencap)
    param([string[]]$ShellArgs)
    $fullArgs = @('-s', $Device) + $ShellArgs
    Invoke-Adb -AdbArgs $fullArgs
}

function Invoke-DeviceCapture {
    # Capture mode (for parsing text output like getprop)
    param([string[]]$ShellArgs)
    $fullArgs = @('-s', $Device) + $ShellArgs
    Invoke-AdbCapture -AdbArgs $fullArgs
}

# ---------- Sub-commands ----------

function Cmd-Devices {
    Invoke-Adb devices -l
}

function Cmd-Connect {
    foreach ($port in $AltPorts) {
        Write-Host "[bs] Trying 127.0.0.1:$port ..." -ForegroundColor Gray
        $out = Invoke-Adb connect "127.0.0.1:$port" 2>&1
        Write-Host $out
        if ($out -match "connected to") {
            $script:Device = "127.0.0.1:$port"
            Write-Host "[bs] Current device: $Device" -ForegroundColor Green
            return
        }
    }
    Write-Warning "[bs] All ports failed. Make sure BlueStacks is running and ADB is enabled."
}

function Cmd-Screenshot {
    param([string]$Out = "")
    if (-not $Out) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $Out = Join-Path $ScreenshotDir "screen-$stamp.png"
    }
    # Use Start-Process + RedirectStandardOutput to avoid PowerShell 5.1 binary stream bug
    $adb = Get-AdbPath
    $proc = Start-Process -FilePath $adb `
        -ArgumentList @('-s', $Device, 'exec-out', 'screencap', '-p') `
        -RedirectStandardOutput $Out `
        -NoNewWindow -Wait -PassThru
    if (Test-Path $Out) {
        $size = (Get-Item $Out).Length
        Write-Host "[bs] Screenshot -> $Out ($size bytes)" -ForegroundColor Green
    } else {
        throw "Screenshot failed (exit code $($proc.ExitCode))"
    }
}

function Cmd-Tap {
    param([int]$X, [int]$Y)
    Invoke-Device -ShellArgs @('shell', 'input', 'tap', $X, $Y) | Out-Null
    Write-Host "[bs] tap ($X, $Y)" -ForegroundColor Green
}

function Cmd-Text {
    param([Parameter(Position=0)][string]$Text)
    # Escape space as %s (adb shell input text rule)
    $escaped = $Text -replace ' ', '%s'
    Invoke-Device -ShellArgs @('shell', 'input', 'text', $escaped) | Out-Null
    Write-Host "[bs] text: $Text" -ForegroundColor Green
}

function Cmd-Swipe {
    param(
        [int]$X1, [int]$Y1, [int]$X2, [int]$Y2,
        [int]$Duration = 300
    )
    Invoke-Device -ShellArgs @('shell', 'input', 'swipe', $X1, $Y1, $X2, $Y2, $Duration) | Out-Null
    Write-Host "[bs] swipe ($X1,$Y1) -> ($X2,$Y2) ${Duration}ms" -ForegroundColor Green
}

function Cmd-KeyEvent {
    param([Parameter(Position=0)][string]$Key)
    # Alias map
    $map = @{
        "home"        = "KEYCODE_HOME"
        "back"        = "KEYCODE_BACK"
        "recent"      = "KEYCODE_APP_SWITCH"
        "menu"        = "KEYCODE_MENU"
        "power"       = "KEYCODE_POWER"
        "enter"       = "KEYCODE_ENTER"
        "delete"      = "KEYCODE_DEL"
        "backspace"   = "KEYCODE_DEL"
        "tab"         = "KEYCODE_TAB"
        "esc"         = "KEYCODE_ESCAPE"
        "volume_up"   = "KEYCODE_VOLUME_UP"
        "volume_down" = "KEYCODE_VOLUME_DOWN"
        "volume_mute" = "KEYCODE_VOLUME_MUTE"
    }
    $keyLower = $Key.ToLower()
    $code = if ($map.ContainsKey($keyLower)) { $map[$keyLower] } else { $Key }
    Invoke-Device -ShellArgs @('shell', 'input', 'keyevent', $code) | Out-Null
    Write-Host "[bs] keyevent $Key ($code)" -ForegroundColor Green
}

function Cmd-Install {
    param([Parameter(Mandatory=$true)][string]$Apk)
    $apkPath = Resolve-Path $Apk -ErrorAction Stop
    Invoke-Device -ShellArgs @('install', '-r', $apkPath) | Out-Null
    Write-Host "[bs] install $apkPath" -ForegroundColor Green
}

function Cmd-Launch {
    param([Parameter(Mandatory=$true)][string]$Package)
    # Monkey launch (avoid querying main activity)
    Invoke-Device -ShellArgs @('shell', 'monkey', '-p', $Package, '-c', 'android.intent.category.LAUNCHER', '1') | Out-Null
    Write-Host "[bs] launch $Package" -ForegroundColor Green
}

function Cmd-Logcat {
    param([string]$Tag = "")
    if ($Tag) {
        Invoke-Device -ShellArgs @('logcat', '-s', $Tag)
    } else {
        Invoke-Device -ShellArgs @('logcat', '-v', 'time')
    }
}

function Cmd-Record {
    param([int]$Seconds = 10)
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $remote = "/sdcard/record-$stamp.mp4"
    $local = Join-Path $ScreenshotDir "record-$stamp.mp4"
    Write-Host "[bs] Recording ${Seconds}s ..." -ForegroundColor Yellow
    $adb = Get-AdbPath
    # Background start
    $proc = Start-Process -FilePath $adb -ArgumentList @("-s", $Device, "shell", "screenrecord", "--time-limit", $Seconds, $remote) -PassThru -NoNewWindow
    Start-Sleep -Seconds ($Seconds + 1)
    Invoke-Device -ShellArgs @('pull', $remote, $local) | Out-Null
    Invoke-Device -ShellArgs @('shell', 'rm', $remote) | Out-Null
    Write-Host "[bs] Record -> $local" -ForegroundColor Green
}

function Cmd-Pull {
    param([Parameter(Mandatory=$true)][string]$Remote, [string]$Local = ".")
    Invoke-Device -ShellArgs @('pull', $Remote, $Local) | Out-Null
}

function Cmd-Push {
    param([Parameter(Mandatory=$true)][string]$Local, [Parameter(Mandatory=$true)][string]$Remote)
    $localPath = Resolve-Path $Local -ErrorAction Stop
    Invoke-Device -ShellArgs @('push', $localPath, $Remote) | Out-Null
}

function Cmd-Info {
    $props = @("ro.build.version.release", "ro.build.version.sdk", "ro.product.cpu.abi", "ro.product.model", "ro.product.manufacturer")
    foreach ($p in $props) {
        $lines = Invoke-DeviceCapture -ShellArgs @('shell', 'getprop', $p)
        $v = ($lines -join ' ').Trim()
        Write-Host ("{0,-32} {1}" -f $p, $v) -ForegroundColor Cyan
    }
    $sizeLines = Invoke-DeviceCapture -ShellArgs @('shell', 'wm', 'size')
    $size = ($sizeLines -join ' ').Trim()
    Write-Host ("{0,-32} {1}" -f "screen", $size) -ForegroundColor Cyan
}

function Cmd-Shell {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Cmd)
    Invoke-Device -ShellArgs $Cmd
}

function Cmd-Sleep {
    param([int]$Seconds = 1)
    Start-Sleep -Seconds $Seconds
    Write-Host "[bs] sleep ${Seconds}s" -ForegroundColor Gray
}

# ---------- Router ----------

try {
    switch ($Command.ToLower()) {
        "devices"     { Cmd-Devices }
        "connect"     { Cmd-Connect }
        "screenshot"  { Cmd-Screenshot -Out $Args[0] }
        "tap"         { Cmd-Tap -X $Args[0] -Y $Args[1] }
        "text"        { Cmd-Text -Text ($Args -join ' ') }
        "swipe"       {
            $duration = 300
            if ($Args.Count -ge 5 -and $Args[4]) { $duration = [int]$Args[4] }
            Cmd-Swipe -X1 $Args[0] -Y1 $Args[1] -X2 $Args[2] -Y2 $Args[3] -Duration $duration
        }
        "keyevent"    { Cmd-KeyEvent -Key $Args[0] }
        "key"         { Cmd-KeyEvent -Key $Args[0] }
        "install"     { Cmd-Install -Apk $Args[0] }
        "launch"      { Cmd-Launch -Package $Args[0] }
        "logcat"      { Cmd-Logcat -Tag $Args[0] }
        "record"      {
            $secs = 10
            if ($Args.Count -ge 1 -and $Args[0]) { $secs = [int]$Args[0] }
            Cmd-Record -Seconds $secs
        }
        "pull"        { Cmd-Pull -Remote $Args[0] -Local ($Args[1]) }
        "push"        { Cmd-Push -Local $Args[0] -Remote $Args[1] }
        "info"        { Cmd-Info }
        "shell"       { Cmd-Shell -Cmd $Args }
        "sleep"       {
            $secs = 1
            if ($Args.Count -ge 1 -and $Args[0]) { $secs = [int]$Args[0] }
            Cmd-Sleep -Seconds $secs
        }
        default {
            Write-Host "Unknown command: $Command" -ForegroundColor Red
            Write-Host "Usage: .\bs-control.ps1 <devices|connect|screenshot|tap|text|swipe|keyevent|install|launch|logcat|record|pull|push|info|shell|sleep> [args]"
            exit 1
        }
    }
} catch {
    Write-Host "[bs] Error: $_" -ForegroundColor Red
    exit 1
}
