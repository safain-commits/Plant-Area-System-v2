# Dot-source from a new PowerShell terminal: . .\scripts\activate-dev.ps1
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskNodeDirectory = Join-Path $taskRoot '.tools\node-v26.12.1-win-x64'
$taskPnpmDirectory = Join-Path $taskRoot '.tools\pnpm'
if (!(Test-Path -LiteralPath (Join-Path $taskNodeDirectory 'node.exe'))) {
  throw 'Node 26.12.1 lokal belum tersedia. Ikuti bagian Persiapan pada README.md.'
}
if (!(Test-Path -LiteralPath (Join-Path $taskPnpmDirectory 'pnpm.cmd'))) {
  throw 'pnpm lokal belum tersedia. Ikuti perintah instalasi .tools/pnpm pada README.md.'
}
$env:PATH = "$taskNodeDirectory;$taskPnpmDirectory;$env:PATH"
$taskNodeVersion = & (Join-Path $taskNodeDirectory 'node.exe') --version
$taskPnpmVersion = & (Join-Path $taskPnpmDirectory 'pnpm.cmd') --version
if ($LASTEXITCODE -ne 0) { throw 'pnpm lokal gagal dijalankan; periksa instalasi .tools/pnpm.' }
Write-Host "Development terminal aktif: Node $taskNodeVersion / pnpm $taskPnpmVersion"
