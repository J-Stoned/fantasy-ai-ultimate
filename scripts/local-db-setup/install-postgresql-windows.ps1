# PostgreSQL 16 Automated Installer for Windows
# Run this script as Administrator in PowerShell

param(
    [string]$PostgresPassword = "postgres",
    [string]$InstallPath = "C:\Program Files\PostgreSQL\16",
    [int]$Port = 5432
)

Write-Host "🚀 PostgreSQL 16 Automated Installer" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Gray

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if PostgreSQL is already installed
$pgPath = Get-Command psql -ErrorAction SilentlyContinue
if ($pgPath) {
    Write-Host "✅ PostgreSQL is already installed at: $($pgPath.Source)" -ForegroundColor Green
    $version = & psql --version
    Write-Host "Version: $version" -ForegroundColor Gray
    
    $continue = Read-Host "Continue with setup? (y/n)"
    if ($continue -ne 'y') {
        exit 0
    }
} else {
    Write-Host "PostgreSQL not found. Starting installation..." -ForegroundColor Yellow
    
    # Download PostgreSQL installer
    $installerUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.1-1-windows-x64.exe"
    $installerPath = "$env:TEMP\postgresql-16-installer.exe"
    
    Write-Host "📥 Downloading PostgreSQL 16 installer..." -ForegroundColor Yellow
    Write-Host "This may take a few minutes..." -ForegroundColor Gray
    
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
        $ProgressPreference = 'Continue'
        
        Write-Host "✅ Download complete!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to download installer: $_" -ForegroundColor Red
        Write-Host "Please download manually from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
        exit 1
    }
    
    # Run installer silently
    Write-Host "📦 Installing PostgreSQL 16..." -ForegroundColor Yellow
    Write-Host "Password will be: $PostgresPassword" -ForegroundColor Gray
    
    $installArgs = @(
        "--mode", "unattended",
        "--unattendedmodeui", "minimal",
        "--superpassword", $PostgresPassword,
        "--servicename", "postgresql-16",
        "--servicepassword", $PostgresPassword,
        "--serverport", $Port,
        "--prefix", $InstallPath,
        "--datadir", "$InstallPath\data"
    )
    
    try {
        Start-Process -FilePath $installerPath -ArgumentList $installArgs -Wait -NoNewWindow
        Write-Host "✅ PostgreSQL 16 installed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Installation failed: $_" -ForegroundColor Red
        exit 1
    }
    
    # Add to PATH
    Write-Host "🔧 Adding PostgreSQL to PATH..." -ForegroundColor Yellow
    $pgBinPath = "$InstallPath\bin"
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    
    if ($currentPath -notlike "*$pgBinPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$pgBinPath", "Machine")
        Write-Host "✅ Added to PATH!" -ForegroundColor Green
        Write-Host "⚠️  You may need to restart PowerShell for PATH changes to take effect" -ForegroundColor Yellow
    }
    
    # Refresh PATH in current session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
}

# Create fantasy_ai_local database
Write-Host "`n🗄️  Creating fantasy_ai_local database..." -ForegroundColor Yellow

# Set PGPASSWORD environment variable for this session
$env:PGPASSWORD = $PostgresPassword

# Create database
try {
    & "$InstallPath\bin\psql.exe" -U postgres -c "CREATE DATABASE fantasy_ai_local;" 2>$null
    Write-Host "✅ Database created!" -ForegroundColor Green
} catch {
    Write-Host "Database might already exist, continuing..." -ForegroundColor Gray
}

# Create extensions
Write-Host "🔧 Creating required extensions..." -ForegroundColor Yellow
& "$InstallPath\bin\psql.exe" -U postgres -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS `"uuid-ossp`";"
& "$InstallPath\bin\psql.exe" -U postgres -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# Apply performance settings
Write-Host "`n⚡ Applying performance optimizations..." -ForegroundColor Yellow

$configPath = "$InstallPath\data\postgresql.conf"
$performanceSettings = @"

# Fantasy AI Performance Settings (32GB RAM, Ryzen 5 7600X)
# Added by automated installer
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 256MB
maintenance_work_mem = 2GB
max_worker_processes = 12
max_parallel_workers = 12
max_parallel_workers_per_gather = 6
random_page_cost = 1.1
effective_io_concurrency = 200
synchronous_commit = off
jit = on
"@

# Backup original config
Copy-Item $configPath "$configPath.backup" -Force
Add-Content -Path $configPath -Value $performanceSettings

# Restart PostgreSQL service
Write-Host "🔄 Restarting PostgreSQL service..." -ForegroundColor Yellow
Restart-Service -Name "postgresql-16" -Force
Start-Sleep -Seconds 3

Write-Host "`n✅ PostgreSQL 16 Installation Complete!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Gray
Write-Host "Database: fantasy_ai_local" -ForegroundColor Cyan
Write-Host "Port: $Port" -ForegroundColor Cyan
Write-Host "Username: postgres" -ForegroundColor Cyan
Write-Host "Password: $PostgresPassword" -ForegroundColor Cyan
Write-Host "`nConnection string for .env.local:" -ForegroundColor Yellow
Write-Host "DATABASE_URL=postgresql://postgres:$PostgresPassword@localhost:$Port/fantasy_ai_local" -ForegroundColor Green

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Export data from Supabase Dashboard" -ForegroundColor White
Write-Host "2. Import data: psql -U postgres fantasy_ai_local < your_dump.sql" -ForegroundColor White
Write-Host "3. Run: npx tsx scripts/local-db-setup/update-env-local.ts" -ForegroundColor White
Write-Host "4. Test: npx tsx scripts/local-db-setup/test-local-performance.ts" -ForegroundColor White

# Clean up installer
if (Test-Path $installerPath) {
    Remove-Item $installerPath -Force
}

Write-Host "`n🎉 Your Ryzen 5 7600X is ready for BLAZING FAST queries!" -ForegroundColor Magenta