<#
.SYNOPSIS
  SolScope — Full deployment + submission checklist runner

.DESCRIPTION
  Run this when you're ready to deploy and submit. It walks through every step.
  Set NOSANA_API_KEY before running.

.EXAMPLE
  $env:NOSANA_API_KEY = "nos_xxx_your_key"
  .\submit.ps1
#>

Write-Host "`n=== SolScope Submission Checklist ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify Docker image exists on registry
Write-Host "[1/7] Checking Docker image..." -ForegroundColor Yellow
$manifest = docker manifest inspect thetroll888/solscope:latest 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: thetroll888/solscope:latest exists on Docker Hub" -ForegroundColor Green
} else {
    Write-Host "  MISSING: Run 'docker push thetroll888/solscope:latest' first" -ForegroundColor Red
}

# Step 2: Verify git state
Write-Host "[2/7] Checking git state..." -ForegroundColor Yellow
$branch = git rev-parse --abbrev-ref HEAD
$dirty = git status --porcelain
Write-Host "  Branch: $branch"
if ($dirty) {
    Write-Host "  WARNING: Uncommitted changes detected" -ForegroundColor Yellow
    git status --short
} else {
    Write-Host "  OK: Working tree clean" -ForegroundColor Green
}

# Step 3: Run tests
Write-Host "[3/7] Running tests..." -ForegroundColor Yellow
npx vitest run 2>&1 | Select-Object -Last 5

# Step 4: Check Nosana API key
Write-Host "[4/7] Checking Nosana API key..." -ForegroundColor Yellow
if ($env:NOSANA_API_KEY) {
    Write-Host "  OK: NOSANA_API_KEY is set" -ForegroundColor Green
} else {
    Write-Host "  MISSING: Set `$env:NOSANA_API_KEY first" -ForegroundColor Red
    Write-Host "  Get one at: deploy.nosana.com -> Account -> API Keys"
}

# Step 5: Verify repos starred
Write-Host "[5/7] Repos to star (manual check):" -ForegroundColor Yellow
Write-Host "  - https://github.com/nosana-ci/agent-challenge"
Write-Host "  - https://github.com/nosana-ci/nosana-programs"
Write-Host "  - https://github.com/nosana-ci/nosana-kit"
Write-Host "  - https://github.com/nosana-ci/nosana-cli"

# Step 6: Social media
Write-Host "[6/7] Social media post:" -ForegroundColor Yellow
Write-Host "  Copy this to Twitter/X:" -ForegroundColor Cyan
Write-Host ""
$post = Get-Content "$PSScriptRoot\SUBMISSION.md" | Select-String -Pattern "Built SolScope" -Context 0,20
if ($post) {
    Write-Host "  --- POST START ---"
    $inPost = $false
    Get-Content "$PSScriptRoot\SUBMISSION.md" | ForEach-Object {
        if ($_ -match "^Built SolScope") { $inPost = $true }
        if ($inPost -and $_ -match "^#") { $inPost = $false }
        if ($inPost) { Write-Host "  $_" }
    }
    Write-Host "  --- POST END ---"
}

# Step 7: Deploy
Write-Host ""
Write-Host "[7/7] Deploy to Nosana:" -ForegroundColor Yellow
if ($env:NOSANA_API_KEY) {
    $confirm = Read-Host "  Deploy now? (y/n)"
    if ($confirm -eq "y") {
        Write-Host "  Deploying..." -ForegroundColor Cyan
        npx tsx deploy.ts
    } else {
        Write-Host "  Skipped. Run manually: npx tsx deploy.ts"
    }
} else {
    Write-Host "  Skipped (no API key). Set NOSANA_API_KEY and run: npx tsx deploy.ts"
}

Write-Host ""
Write-Host "=== Submission Link ===" -ForegroundColor Cyan
Write-Host "  https://superteam.fun/earn/listing/nosana-builders-elizaos-challenge"
Write-Host ""
Write-Host "Required fields:" -ForegroundColor Yellow
Write-Host "  1. GitHub repo: https://github.com/TheTroll88/agent-challenge (elizaos-challenge branch)"
Write-Host "  2. Nosana deployment URL: (from deploy dashboard after step 7)"
Write-Host "  3. Description: see SUBMISSION.md"
Write-Host "  4. Video demo: record <1 min screen recording of the web UI"
Write-Host "  5. Social media post URL: your tweet/post link"
Write-Host ""
