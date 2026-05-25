param([switch]$Build)

$Image     = "docviewer"
$Container = "docviewer"
$Root      = Split-Path -Parent $PSScriptRoot

if (-not $env:OPENROUTER_API_KEY) {
    Write-Warning "OPENROUTER_API_KEY is not set — AI chat will return 503."
}

$imageExists = docker image inspect $Image 2>$null
if ($Build -or -not $imageExists) {
    Write-Host "Building Docker image…"
    docker build -t $Image $Root
}

docker rm -f $Container 2>$null

docker run -d `
    --name $Container `
    -v "${Root}\docs:/app/docs" `
    -e "OPENROUTER_API_KEY=$env:OPENROUTER_API_KEY" `
    -p 8000:8000 `
    $Image

Write-Host "App running at http://localhost:8000"
