# Read-only collection of a pull request's reviews, inline comments and conversation comments.
# Uses the caller's existing gh auth; writes nothing.
# Usage: .\read-review.ps1 -PrNumber 12 [-Repository OWNER/REPO]   (default: the course upstream)
param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 2147483647)]
    [int]$PrNumber,
    [string]$Repository = 'COURSE-REPO-OWNER/COURSE-REPO'
)
$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' -or $Repository -like 'COURSE-REPO-OWNER/*') {
    throw 'Pass the upstream repository as OWNER/REPO with -Repository.'
}
gh pr view $PrNumber --repo $Repository --json number,url,headRefOid,headRefName,baseRefName
if ($LASTEXITCODE -ne 0) { throw 'Could not read upstream PR metadata.' }
foreach ($endpoint in @(
    "repos/$Repository/pulls/$PrNumber/reviews",
    "repos/$Repository/pulls/$PrNumber/comments",
    "repos/$Repository/issues/$PrNumber/comments"
)) {
    gh api --method GET --paginate $endpoint
    if ($LASTEXITCODE -ne 0) { throw "Could not read $endpoint" }
}
