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
  if ($LASTEXITCODE -ne 0) {
    throw 'GitHub CLI is not authenticated. Run: gh auth login --web --hostname github.com'
  }
}

function Ensure-Milestone {
  param([string]$Title)

  $milestonesJson = gh api "repos/$Owner/$Repo/milestones?state=all"
  if ($LASTEXITCODE -ne 0 -or -not $milestonesJson) {
    throw "Failed to list milestones for $Owner/$Repo"
  }

  $milestones = $milestonesJson | ConvertFrom-Json
  $existing = $milestones | Where-Object { $_.title -eq $Title } | Select-Object -ExpandProperty number -First 1

  if (-not $existing) {
    $payload = @{ title = $Title; state = 'open' } | ConvertTo-Json -Compress
    $payload | gh api "repos/$Owner/$Repo/milestones" --method POST --input - | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to create milestone: $Title"
    }
    Write-Host "Created milestone: $Title"
  }
  else {
    Write-Host "Milestone exists: $Title"
  }
}

function Ensure-Project {
  param([string]$Title)

  $allProjects = gh project list --owner $Owner --format json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to list projects for owner: $Owner"
  }

  $existingProject = $allProjects.projects | Where-Object { $_.title -eq $Title } | Select-Object -First 1

  if (-not $existingProject) {
    $created = gh project create --owner $Owner --title "$Title" --format json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $created.id -or -not $created.number) {
      throw "Failed to create project: $Title"
    }
    Write-Host "Created project: $Title"
    return $created
  }
  else {
    Write-Host "Project exists: $Title"
    return $existingProject
  }
}

function Ensure-SingleSelectField {
  param(
    [int]$ProjectNumber,
    [string]$Name,
    [string[]]$Options
  )

  $fields = gh project field-list $ProjectNumber --owner $Owner --format json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to list project fields for project number: $ProjectNumber"
  }

  $exists = $fields.fields | Where-Object { $_.name -eq $Name }
  if ($exists) {
    Write-Host "Field exists: $Name"
    return
  }

  $optionsArg = ($Options -join ',')
  gh project field-create $ProjectNumber --owner $Owner --name "$Name" --data-type SINGLE_SELECT --single-select-options "$optionsArg" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create project field: $Name"
  }
  Write-Host "Created field: $Name"
}

function Get-FieldId {
  param(
    [int]$ProjectNumber,
    [string]$FieldName
  )

  $fields = gh project field-list $ProjectNumber --owner $Owner --format json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $fields) {
    throw "Failed to get field id for field: $FieldName"
  }
  $fieldId = $fields.fields | Where-Object { $_.name -eq $FieldName } | Select-Object -ExpandProperty id -First 1
  return $fieldId
}

function Get-SingleSelectOptionId {
  param(
    [int]$ProjectNumber,
    [string]$FieldName,
    [string]$OptionName
  )

  $fields = gh project field-list $ProjectNumber --owner $Owner --format json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $fields) {
    throw "Failed to get option id for $FieldName/$OptionName"
  }
  $optionId = $fields.fields | Where-Object { $_.name -eq $FieldName } | Select-Object -ExpandProperty options -First 1 | Where-Object { $_.name -eq $OptionName } | Select-Object -ExpandProperty id -First 1
  return $optionId
}

function Ensure-Issue {
  param(
    [string]$Title,
    [string]$Body,
    [string]$Milestone,
    [string]$Priority,
    [string]$Area
  )

  $existingIssues = gh issue list --repo "$Owner/$Repo" --state all --limit 200 --json number,title | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to list issues for $Owner/$Repo"
  }

  $existingNumber = $existingIssues | Where-Object { $_.title -eq $Title } | Select-Object -ExpandProperty number -First 1
  if ($existingNumber) {
    Write-Host "Issue exists: #$existingNumber $Title"
    return [int]$existingNumber
  }

  $tempFile = New-TemporaryFile
  Set-Content -Path $tempFile -Value $Body -Encoding utf8

  $issueUrl = gh issue create --repo "$Owner/$Repo" --title "$Title" --body-file $tempFile --milestone "$Milestone" --label "type:task" --label "priority:$Priority" --label "area:$Area" --label "status:ready"
  if ($LASTEXITCODE -ne 0 -or -not $issueUrl) {
    Remove-Item $tempFile -Force
    throw "Failed to create issue: $Title"
  }

  Remove-Item $tempFile -Force

  $number = [int]($issueUrl.Trim().Split('/')[-1])
  Write-Host "Created issue: #$number $Title"
  return $number
}

function Ensure-IssueOnProjectBacklog {
  param(
    [int]$ProjectNumber,
    [string]$ProjectId,
    [int]$IssueNumber,
    [string]$WorkflowFieldName,
    [string]$BacklogOptionName
  )

  $issueUrl = "https://github.com/$Owner/$Repo/issues/$IssueNumber"
  $workflowFieldId = Get-FieldId -ProjectNumber $ProjectNumber -FieldName $WorkflowFieldName
  $backlogOptionId = Get-SingleSelectOptionId -ProjectNumber $ProjectNumber -FieldName $WorkflowFieldName -OptionName $BacklogOptionName

  if (-not $workflowFieldId -or -not $backlogOptionId) {
    throw "Could not find workflow field or backlog option in project number $ProjectNumber"
  }

  $itemId = $null
  try {
    $itemId = gh project item-add $ProjectNumber --owner $Owner --url $issueUrl --format json --jq .id
  }
  catch {
    Write-Host "Issue likely already on project, resolving item id from project list: $issueUrl"
  }

  if (-not $itemId) {
    $items = gh project item-list $ProjectNumber --owner $Owner --limit 500 --format json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $items) {
      throw "Unable to list project items for project number $ProjectNumber"
    }
    $itemId = $items.items | Where-Object { $_.content.url -eq $issueUrl } | Select-Object -ExpandProperty id -First 1
  }

  if (-not $itemId) {
    throw "Unable to get project item id for issue: $issueUrl"
  }

  gh project item-edit --id $itemId --project-id $ProjectId --field-id $workflowFieldId --single-select-option-id $backlogOptionId | Out-Null
  Write-Host "Placed issue in Backlog: #$IssueNumber"
}

$phaseIssues = @(
  @{
    Title = '[PHASE] M0 - Repo Stabilization and Runability Gate'
    Milestone = 'M0 Repo Stabilization'
    Priority = 'p0'
    Area = 'infra'
    Body = @'
## Goal
Bring the repository to a deterministic, runnable baseline where app startup and CI are reliable on a clean machine.

## Modules Implemented In This Phase
- App shell routing scaffold and placeholder pages
- Tauri command wiring and backend module registration
- TypeScript and ESLint baseline configuration
- Windows local bootstrap and command compatibility
- CI checks for lint, typecheck, and tests

## Detailed Tasks
- [ ] Fix unresolved route imports and missing page modules used by the app router.
- [ ] Add compile-safe placeholders for unfinished screens and shared layout dependencies.
- [ ] Align Tauri command registration with existing Rust command modules.
- [ ] Validate frontend typecheck and lint rules execute consistently.
- [ ] Validate backend cargo check executes without unresolved module or command references.
- [ ] Ensure documented setup works in PowerShell environments.
- [ ] Confirm CI workflows are present and passing on pull requests.

## Final Proof For Phase Completion
- [ ] App starts successfully in development mode without blocking compile errors.
- [ ] Local checks pass: typecheck, lint, and tests.
- [ ] Rust backend check passes with no unresolved command/module errors.
- [ ] CI required checks are green on a sample pull request.
'@
  },
  @{
    Title = '[PHASE] M1 - Authentication and App Shell'
    Milestone = 'M1 Auth + App Shell'
    Priority = 'p0'
    Area = 'infra'
    Body = @'
## Goal
Deliver secure user entry with persistent sessions and a role-aware navigation shell suitable for non-technical pharmacy staff.

## Modules Implemented In This Phase
- Authentication service and login flow
- Session restore and logout flow
- Protected route layer
- Core layout shell (sidebar and top header)
- Role-based menu visibility checks

## Detailed Tasks
- [ ] Implement login with clear invalid-credential feedback.
- [ ] Implement logout that clears session state safely.
- [ ] Implement session restore across app restart.
- [ ] Apply protected routes for authenticated screens.
- [ ] Add role-based visibility for sensitive modules.
- [ ] Add loading indicators and user-friendly error toasts in auth flows.
- [ ] Add permission checks before sensitive route actions.

## Final Proof For Phase Completion
- [ ] Valid credentials allow login and route access.
- [ ] Invalid credentials are blocked with clear user messaging.
- [ ] Session remains active after restart within expiry policy.
- [ ] Logout invalidates session and redirects to login.
- [ ] Role-based menus show or hide correctly for test users.
'@
  },
  @{
    Title = '[PHASE] M2 - Medicine Master Core'
    Milestone = 'M2 Medicine Master'
    Priority = 'p0'
    Area = 'medicine'
    Body = @'
## Goal
Build medicine and batch master workflows that support real inventory operations with safe validation and fast lookup.

## Modules Implemented In This Phase
- Medicine list, search, create, and edit flows
- Medicine detail panel and update flow
- Batch create and update workflow
- Barcode lookup for medicine and batches
- Rack location validation
- Low-stock and near-expiry indicators

## Detailed Tasks
- [ ] Implement medicine list with search, filter, and sort support.
- [ ] Implement medicine create and edit commands with validation.
- [ ] Implement medicine detail fetch by id and update save flow.
- [ ] Implement batch create and edit linked to medicine records.
- [ ] Implement barcode lookup to resolve medicine and batch context.
- [ ] Validate rack location and expiry date format.
- [ ] Show low-stock and near-expiry visual indicators.

## Final Proof For Phase Completion
- [ ] User can create and edit medicine records end-to-end from UI to database.
- [ ] User can add and edit batches with valid rack and expiry data.
- [ ] Barcode lookup returns correct medicine or batch records.
- [ ] Low-stock and expiry indicators match stored quantities and dates.
'@
  },
  @{
    Title = '[PHASE] M3 - Billing Core POS'
    Milestone = 'M3 Billing Core'
    Priority = 'p0'
    Area = 'billing'
    Body = @'
## Goal
Ship a transaction-safe billing workflow that is fast enough for live pharmacy counter operations.

## Modules Implemented In This Phase
- POS medicine search and barcode add-to-cart
- Cart quantity, discount, and GST calculations
- Multi-mode payment panel
- Atomic bill save transaction in backend
- Hold and restore bill baseline workflow
- Print baseline integration path

## Detailed Tasks
- [ ] Implement fast medicine search and barcode scan item add flow.
- [ ] Implement cart editing with quantity, discount, and GST breakdown.
- [ ] Implement payment panel with supported split-payment modes.
- [ ] Implement atomic backend transaction for bill, line items, and payment records.
- [ ] Implement hold and restore for interrupted counter flows.
- [ ] Add robust error handling to prevent partial billing writes.
- [ ] Add receipt print baseline trigger path.

## Final Proof For Phase Completion
- [ ] End-to-end bill creation works from cart to saved transaction.
- [ ] Failure scenarios do not leave partial bill data.
- [ ] Hold and restore preserves cart content and totals accurately.
- [ ] Billing interaction is within target usability latency for counter use.
'@
  },
  @{
    Title = '[PHASE] M4 - Purchase, Supplier, and Customer Credit'
    Milestone = 'M4 Purchase + Customer'
    Priority = 'p0'
    Area = 'purchase'
    Body = @'
## Goal
Complete operational loops beyond billing by connecting procurement, suppliers, and customer credit management.

## Modules Implemented In This Phase
- Supplier management workflows
- Manual purchase bill entry
- Purchase order and return baseline flows
- Customer profile and credit outstanding tracking
- Credit payment and reconciliation flow
- Doctor linkage and related supporting entities

## Detailed Tasks
- [ ] Implement supplier CRUD with validation and searchable list.
- [ ] Implement purchase entry with item, batch, and stock update linkage.
- [ ] Implement purchase order and purchase return baseline behavior.
- [ ] Implement customer profile with credit account fields.
- [ ] Implement credit billing and outstanding update flow.
- [ ] Implement credit payment recording and balance reconciliation.
- [ ] Ensure stock movement from purchase updates inventory consistently.

## Final Proof For Phase Completion
- [ ] Purchase entry updates stock correctly for all affected medicines and batches.
- [ ] Supplier and customer records are manageable from UI with validation.
- [ ] Credit bills increase outstanding and payments reduce outstanding correctly.
- [ ] Purchase returns/debit-note flow records reverse stock and amounts correctly.
'@
  },
  @{
    Title = '[PHASE] M5 - Reports, Audit, and Backup Reliability'
    Milestone = 'M5 Reports + Backup'
    Priority = 'p0'
    Area = 'reports'
    Body = @'
## Goal
Provide compliance-grade visibility and recovery confidence through operational reports, auditable actions, and tested backup restore.

## Modules Implemented In This Phase
- Sales, purchase, stock, and GST reporting
- Audit log capture and report view/export
- Backup creation and restore flows
- Validation workflows for post-restore correctness

## Detailed Tasks
- [ ] Implement report commands and UI views for sales, purchase, stock, and GST.
- [ ] Implement audit log view with filtering and export capability.
- [ ] Implement backup generation command and UI trigger.
- [ ] Implement restore command and safety confirmations.
- [ ] Add restore smoke checks for critical module health.
- [ ] Validate report totals against database truth for sample periods.
- [ ] Document operator workflow for backup and restore drills.

## Final Proof For Phase Completion
- [ ] Report totals match source database values for validated periods.
- [ ] Audit log captures create, update, and delete actions in covered modules.
- [ ] Backup file can be restored into a clean environment successfully.
- [ ] Post-restore smoke workflow passes without P0 regressions.
'@
  },
  @{
    Title = '[PHASE] M6 - Hardening and Release Readiness'
    Milestone = 'M6 Hardening + Release'
    Priority = 'p0'
    Area = 'infra'
    Body = @'
## Goal
Reach release-grade quality with strong runtime safety, performance confidence, and reliable distribution packaging.

## Modules Implemented In This Phase
- Runtime hardening and user-safe error surfaces
- Performance and latency optimization pass
- Security and dependency audit pass
- Installer signing and release automation
- Final quality gate workflows

## Detailed Tasks
- [ ] Eliminate panic-prone runtime paths and replace with safe error handling.
- [ ] Run targeted performance tuning for billing and search-critical paths.
- [ ] Execute security hardening and dependency vulnerability review.
- [ ] Validate permissions and sensitive command guards.
- [ ] Complete signed build pipeline and release artifact checks.
- [ ] Close all open P0 and P1 defects before release cut.
- [ ] Execute full release-gate checklist and evidence capture.

## Final Proof For Phase Completion
- [ ] No open P0 or P1 issues remain.
- [ ] Typecheck, lint, tests, and production build are all green.
- [ ] Signed installers are generated and validated.
- [ ] Release candidate passes smoke and rollback confidence checks.
'@
  }
)

Write-Host 'Checking GitHub authentication...'
Ensure-GhAuth

Write-Host 'Ensuring milestones...'
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

Write-Host 'Ensuring project...'
$project = Ensure-Project -Title $ProjectTitle
$projectId = $project.id
$projectNumber = [int]$project.number

Write-Host 'Ensuring workflow field for board columns...'
Ensure-SingleSelectField -ProjectNumber $projectNumber -Name 'Phase State' -Options @('Backlog', 'In Progress', 'Done', 'Blocked')

Write-Host 'Creating phase issues and adding to Backlog...'
foreach ($phase in $phaseIssues) {
  $issueNumber = Ensure-Issue -Title $phase.Title -Body $phase.Body -Milestone $phase.Milestone -Priority $phase.Priority -Area $phase.Area
  Ensure-IssueOnProjectBacklog -ProjectNumber $projectNumber -ProjectId $projectId -IssueNumber $issueNumber -WorkflowFieldName 'Phase State' -BacklogOptionName 'Backlog'
}

Write-Host 'Phase board setup complete.'
Write-Host "Project ID: $projectId"
Write-Host 'Board columns are represented by the Workflow State options: Backlog, In Progress, Done, Blocked.'
