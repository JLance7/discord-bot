$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $project '.aws-sam/source'
New-Item -ItemType Directory -Force -Path $stage | Out-Null
# Only Lambda source and its dependency manifests go into the AWS build.
foreach ($file in @('handler.js', 'commands.js', 'store.js', 'package.json', 'package-lock.json', 'template.yaml')) {
    Copy-Item -LiteralPath (Join-Path $project $file) -Destination $stage -Force
}
Push-Location $project
try {
    sam build --template-file (Join-Path $stage 'template.yaml')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
