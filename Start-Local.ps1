# Restart the prepared demo in its original Codex workspace. For a new machine use the README.
$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$workspaceDir = Split-Path (Split-Path $projectDir -Parent) -Parent
$workDir = Join-Path $workspaceDir 'work'
$pgDataDir = Join-Path $workDir 'postgres'
$postgresExe = 'C:\Program Files\PostgreSQL\18\bin\postgres.exe'
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) { $nodeExe = 'C:\Users\m3m3s\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $pgDataDir)) { throw 'Prepared demo database not found. Follow README.md for a fresh setup.' }
& 'C:\Program Files\PostgreSQL\18\bin\pg_isready.exe' -h 127.0.0.1 -p 55432 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Start-Process -FilePath $postgresExe -ArgumentList @('-D', $pgDataDir, '-p', '55432', '-h', '127.0.0.1') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $workDir 'postgres-start.log') -RedirectStandardError (Join-Path $workDir 'postgres-start-error.log')
  Start-Sleep -Seconds 2
}
try { Invoke-RestMethod 'http://127.0.0.1:3001/api/health' -TimeoutSec 2 | Out-Null } catch {
  Start-Process -FilePath $nodeExe -ArgumentList 'dist/main.js' -WorkingDirectory (Join-Path $projectDir 'apps/api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $workDir 'api-start.log') -RedirectStandardError (Join-Path $workDir 'api-start-error.log')
}
try { Invoke-WebRequest 'http://127.0.0.1:5173' -TimeoutSec 2 | Out-Null } catch {
  Start-Process -FilePath $nodeExe -ArgumentList @('../../node_modules/vite/bin/vite.js', '--host', '127.0.0.1') -WorkingDirectory (Join-Path $projectDir 'apps/web') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $workDir 'web-start.log') -RedirectStandardError (Join-Path $workDir 'web-start-error.log')
}
Write-Output 'Clearwell is starting at http://127.0.0.1:5173. See LOCAL-DEMO.md for accounts.'
