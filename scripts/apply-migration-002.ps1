# Load environment variables
$envFile = "C:\Users\Administrateur\Downloads\morodeutsh\.env.local"
$env = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $env[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$supabaseUrl = $env['NEXT_PUBLIC_SUPABASE_URL']
$serviceRoleKey = $env['SUPABASE_SERVICE_ROLE_KEY']

if (-not $supabaseUrl -or -not $serviceRoleKey) {
    Write-Host "❌ Missing Supabase credentials" -ForegroundColor Red
    Write-Host "NEXT_PUBLIC_SUPABASE_URL: $($supabaseUrl ? '✓' : '✗')" -ForegroundColor Yellow
    Write-Host "SUPABASE_SERVICE_ROLE_KEY: $($serviceRoleKey ? '✓' : '✗')" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔄 Applying migration 002_add_approval_flow..." -ForegroundColor Cyan

# Read migration file
$migrationPath = "C:\Users\Administrateur\Downloads\morodeutsh\supabase\migrations\002_add_approval_flow.sql"
$migrationSQL = Get-Content $migrationPath -Raw

# Split into statements
$statements = $migrationSQL -split ';' | 
    Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('--') } |
    ForEach-Object { $_.Trim() }

$successCount = 0
$errorCount = 0

foreach ($statement in $statements) {
    Write-Host "📝 Executing: $($statement.Substring(0, [Math]::Min(60, $statement.Length)))..." -ForegroundColor Gray
    
    # For this approach, we'll execute via PostgreSQL connection string
    # Since direct SQL execution via REST API isn't available in Supabase
    # We would need to use the database connection or Supabase Studio
}

Write-Host ""
Write-Host "⚠️  Note: To complete this migration, please:" -ForegroundColor Yellow
Write-Host "1. Go to: https://app.supabase.com/project/$(($supabaseUrl -split 'https://')[1] -split '\.supabase')[0]" 
Write-Host "2. Navigate to SQL Editor"
Write-Host "3. Create a new query and paste the migration SQL below:"
Write-Host ""
Write-Host "--- Migration 002: Add Approval Flow ---" -ForegroundColor Cyan
Write-Host $migrationSQL
Write-Host ""
Write-Host "4. Execute the query"
Write-Host "5. Return here and verify"
