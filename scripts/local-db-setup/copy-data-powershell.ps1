# PowerShell script to copy data from Supabase to local PostgreSQL

Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow

$env:PGPASSWORD = "postgres"

# Test connection
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -d fantasy_ai_local -c "SELECT version();"

if ($LASTEXITCODE -eq 0) {
    Write-Host "PostgreSQL connection successful!" -ForegroundColor Green
    
    Write-Host "`nNow let's copy some data..." -ForegroundColor Yellow
    
    # Change to project directory
    Set-Location "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"
    
    # Run the Node.js script
    Write-Host "Starting data copy (this may take 5-10 minutes)..." -ForegroundColor Cyan
    npx tsx scripts/local-db-setup/simple-copy-script.ts
    
} else {
    Write-Host "Could not connect to PostgreSQL!" -ForegroundColor Red
    Write-Host "Make sure PostgreSQL is running on port 5432" -ForegroundColor Yellow
}

Write-Host "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")