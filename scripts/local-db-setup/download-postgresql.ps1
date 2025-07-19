# Simple PostgreSQL Downloader
Write-Host "Downloading PostgreSQL 16 installer..." -ForegroundColor Yellow

$url = "https://get.enterprisedb.com/postgresql/postgresql-16.1-1-windows-x64.exe"
$output = "$env:USERPROFILE\Downloads\postgresql-16-installer.exe"

try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $url -OutFile $output
    Write-Host "Download complete!" -ForegroundColor Green
    Write-Host "File saved to: $output" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Opening Downloads folder..." -ForegroundColor Yellow
    Start-Process explorer.exe "$env:USERPROFILE\Downloads"
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "1. Double-click: postgresql-16-installer.exe" -ForegroundColor White
    Write-Host "2. Follow the installer" -ForegroundColor White
    Write-Host "3. Use password: postgres" -ForegroundColor White
    Write-Host "4. Keep all other defaults" -ForegroundColor White
} catch {
    Write-Host "Download failed: $_" -ForegroundColor Red
}