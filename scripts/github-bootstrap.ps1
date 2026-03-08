param(
  [Parameter(Mandatory = $true)]
  [string]$Owner,
  [Parameter(Mandatory = $true)]
  [string]$Repo,
  [string]$ProjectTitle = 'PharmaCare Pro - Delivery Board'
)

$ErrorActionPreference = 'Stop'

function Ensure-GhAuth {
  gh auth status | Out-Null
}

function Ensure-Milestone {
  param([string]$Title)
  $existing = gh api "repos/$Owner/$Repo/milestones?state=all" --jq ".[] | select(.title == \"$Title\") | .number"
  if (-not $existing) {
    gh api "repos/$Owner/$Repo/milestones" -f title="$Title" -f state="open" | Out-Null
    Write-Host "Created milestone: $Title"
  } else {
    Write-Host "Milestone exists: $Title"
  }
}

function Ensure-Project {
  param([string]$Title)
  $projectId = gh project list --owner $Owner --format json | ConvertFrom-Json | ForEach-Object { $_.projects } | Where-Object { $_.title -eq $Title } | Select-Object -ExpandProperty id -First 1
  if (-not $projectId) {
    $created = gh project create --owner $Owner --title "$Title" --format json | ConvertFrom-Json
    $projectId = $created.id
    Write-Host "Created project: $Title"
  } else {
    Write-Host "Project exists: $Title"
  }
  return $projectId
}

function Ensure-ProjectField {
  param(
    [string]$ProjectId,
    [string]$Name,
    [string]$DataType,
    [string[]]$Options = @()
  )

  $fields = gh project field-list $ProjectId --owner $Owner --format json | ConvertFrom-Json
  $exists = $fields.fields | Where-Object { $_.name -eq $Name }
  if ($exists) {
    Write-Host "Field exists: $Name"
    return
  }

  if ($DataType -eq 'SINGLE_SELECT') {
    $optionsJson = ($Options | ForEach-Object { @{ name = $_; color = 'GRAY' } } | ConvertTo-Json -Compress)
    gh project field-create $ProjectId --owner $Owner --name "$Name" --data-type SINGLE_SELECT --single-select-options "$optionsJson" | Out-Null
  } else {
    gh project field-create $ProjectId --owner $Owner --name "$Name" --data-type $DataType | Out-Null
  }

  Write-Host "Created field: $Name"
}

Write-Host "Checking GitHub auth..."
Ensure-GhAuth

Write-Host "Running label sync workflow..."
gh workflow run sync-labels.yml --repo "$Owner/$Repo"

Write-Host "Creating milestones M0-M6..."
$milestones = @(
  'M0 Repo Stabilization',
  'M1 Auth + App Shell',
  'M2 Medicine Master',
  'M3 Billing Core',
  'M4 Purchase + Customer',
  'M5 Reports + Backup',
  'M6 Hardening + Release'
)
$milestones | ForEach-Object { Ensure-Milestone -Title $_ }

Write-Host "Creating/updating GitHub Project..."
$projectId = Ensure-Project -Title $ProjectTitle

Write-Host "Creating project fields..."
Ensure-ProjectField -ProjectId $projectId -Name 'Priority' -DataType SINGLE_SELECT -Options @('p0', 'p1', 'p2', 'p3')
Ensure-ProjectField -ProjectId $projectId -Name 'Area' -DataType SINGLE_SELECT -Options @('billing', 'medicine', 'purchase', 'customers', 'reports', 'infra')
Ensure-ProjectField -ProjectId $projectId -Name 'Milestone' -DataType SINGLE_SELECT -Options @('M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6')
Ensure-ProjectField -ProjectId $projectId -Name 'Estimate' -DataType SINGLE_SELECT -Options @('0.5d', '1d', '3d', '1w')
Ensure-ProjectField -ProjectId $projectId -Name 'Owner' -DataType TEXT
Ensure-ProjectField -ProjectId $projectId -Name 'Due Date' -DataType DATE

Write-Host "Bootstrap complete."
Write-Host "Project ID: $projectId"
Write-Host "Next: add repository secrets TAURI_PRIVATE_KEY and TAURI_KEY_PASSWORD from GitHub Settings."