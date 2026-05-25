$Image     = "docviewer"
$Container = "docviewer"
$Root      = Split-Path -Parent $PSScriptRoot

$EnvFile = Join-Path $Root ".env"
if (Test-Path $EnvFile) {
    if (-not (Select-String -Path $EnvFile -Pattern "^OPENROUTER_API_KEY=.+" -Quiet) -and -not $env:OPENROUTER_API_KEY) {
        Write-Warning "OPENROUTER_API_KEY is not set — AI chat will return 503."
    }
} elseif (-not $env:OPENROUTER_API_KEY) {
    Write-Warning "OPENROUTER_API_KEY is not set — AI chat will return 503."
}

Write-Host "Building Docker image…"
docker build -t $Image $Root

docker rm -f $Container 2>$null

$EnvArg = if (Test-Path $EnvFile) { @("--env-file", $EnvFile) } else { @() }

docker run -d `
    --name $Container `
    -v "${Root}\docs:/app/docs" `
    @EnvArg `
    -p 8000:8000 `
    $Image

Write-Host "App running at http://localhost:8000"
