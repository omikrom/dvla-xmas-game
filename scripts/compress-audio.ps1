<#
compress-audio.ps1 - PowerShell helper to convert all public\*.mp3 into public\optimized\*.webm using ffmpeg.
Usage: Open PowerShell in repository root and run: .\scripts\compress-audio.ps1
Requires ffmpeg on PATH.
#>
param(
  [int]$Bitrate = 96
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$publicDir = Join-Path $scriptDir '..\public' | Resolve-Path -ErrorAction Stop
$optDir = Join-Path $publicDir 'optimized'
















nWrite-Host "Conversion complete. Optimized files placed in: $optDir"}  & ffmpeg -y -i $in -c:a libopus -b:a "${Bitrate}k" -vbr on -ac 2 -ar 48000 $out  Write-Host "Converting $($f.Name) -> $out"  $out = Join-Path $optDir $outName  $outName = "${($f.BaseName)}_${Bitrate}k.webm"  $in = $f.FullName
nforeach ($f in $files) {}  return  Write-Host "No .mp3 files found in $publicDir"if (-not $files -or $files.Count -eq 0) {
n$files = Get-ChildItem -Path $publicDir -Filter *.mp3 -File -ErrorAction SilentlyContinuenif (-not (Test-Path $optDir)) { New-Item -ItemType Directory -Path $optDir | Out-Null }