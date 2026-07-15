param(
  [string]$IndexPath = "Builds/WuxieGameHub_TOY/index.html",
  [string]$ToyDir = "Builds/WuxieGameHub_TOY",
  [long]$ToyId = 0,
  [switch]$Publish,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ToyId {
  param(
    [long]$ExplicitToyId,
    [string]$ToyDirectory
  )

  if ($ExplicitToyId -gt 0) {
    return $ExplicitToyId
  }

  $toyYamlPath = Join-Path $ToyDirectory "toy.yaml"
  if (-not (Test-Path -LiteralPath $toyYamlPath)) {
    throw "Toy ID not provided and toy.yaml not found at: $toyYamlPath"
  }

  $toyYamlContent = Get-Content -LiteralPath $toyYamlPath -Raw -Encoding UTF8
  $matchedId = [regex]::Match($toyYamlContent, "(?m)^\s*id:\s*(\d+)\s*$")
  if (-not $matchedId.Success) {
    throw "Toy ID not provided and no 'id:' field found in: $toyYamlPath"
  }

  return [long]$matchedId.Groups[1].Value
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$indexFile = Join-Path $repoRoot $IndexPath
$toyDirectory = Join-Path $repoRoot $ToyDir

if (-not (Test-Path -LiteralPath $indexFile)) {
  throw "index.html not found: $indexFile"
}

$shortHash = (git -C $repoRoot rev-parse --short HEAD).Trim()
if (-not $shortHash) {
  throw "Failed to read git short hash from repository: $repoRoot"
}

$content = Get-Content -LiteralPath $indexFile -Raw -Encoding UTF8

$versionRules = @(
  @{
    Name = "style.css"
    Pattern = 'href="\./css/style\.css(?:\?v=[^"]*)?"'
    Replacement = "href=`"./css/style.css?v=$shortHash`""
  },
  @{
    Name = "games.js"
    Pattern = 'src="\./js/games\.js(?:\?v=[^"]*)?"'
    Replacement = "src=`"./js/games.js?v=$shortHash`""
  },
  @{
    Name = "app.js"
    Pattern = 'src="\./js/app\.js(?:\?v=[^"]*)?"'
    Replacement = "src=`"./js/app.js?v=$shortHash`""
  }
)

$updatedContent = $content
foreach ($rule in $versionRules) {
  if (-not [regex]::IsMatch($updatedContent, $rule.Pattern)) {
    throw "Failed to locate cache-busting target for $($rule.Name) in $IndexPath"
  }

  $nextContent = [regex]::Replace($updatedContent, $rule.Pattern, $rule.Replacement)
  $updatedContent = $nextContent
}

if ($updatedContent -ne $content) {
  if ($DryRun) {
    Write-Host "[DryRun] Would update asset version query to git short hash: $shortHash"
  } else {
    Set-Content -LiteralPath $indexFile -Value $updatedContent -Encoding UTF8
    Write-Host "Updated asset version query to git short hash: $shortHash"
  }
} else {
  Write-Host "No cache-busting changes were required."
}

$resolvedToyId = 0
try {
  $resolvedToyId = Resolve-ToyId -ExplicitToyId $ToyId -ToyDirectory $toyDirectory
} catch {
  if ($Publish) {
    throw
  }
}

if ($Publish) {
  if (-not (Test-Path -LiteralPath $toyDirectory)) {
    throw "TOY directory not found: $toyDirectory"
  }

  Write-Host "Publishing TOY id=$resolvedToyId from $ToyDir ..."
  & toy.exe update $resolvedToyId $toyDirectory --yes
  exit $LASTEXITCODE
}

if ($resolvedToyId -gt 0) {
  Write-Host "Ready to publish:"
  Write-Host "toy.exe update $resolvedToyId $ToyDir --yes"
} else {
  Write-Host "Ready to publish (Toy ID unresolved):"
  Write-Host "toy.exe update <TOY_ID> $ToyDir --yes"
}
