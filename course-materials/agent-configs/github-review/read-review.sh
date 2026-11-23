#!/usr/bin/env bash
# Read-only collection of a pull request's reviews, inline comments and conversation comments.
# Uses the caller's existing gh auth; writes nothing.
# Usage: bash read-review.sh PR_NUMBER [OWNER/REPO]   (default: the course upstream)
set -euo pipefail
pr_number="${1:?Usage: bash read-review.sh PR_NUMBER [OWNER/REPO]}"
upstream="${2:-COURSE-REPO-OWNER/COURSE-REPO}"
if [[ ! "$pr_number" =~ ^[1-9][0-9]*$ ]]; then
  printf '%s\n' 'PR number must be a positive integer.' >&2
  exit 2
fi
if [[ ! "$upstream" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ || "$upstream" == COURSE-REPO-OWNER/* ]]; then
  printf '%s\n' 'Pass the upstream repository as OWNER/REPO.' >&2
  exit 2
fi
gh pr view "$pr_number" --repo "$upstream" --json number,url,headRefOid,headRefName,baseRefName
gh api --method GET --paginate "repos/$upstream/pulls/$pr_number/reviews"
gh api --method GET --paginate "repos/$upstream/pulls/$pr_number/comments"
gh api --method GET --paginate "repos/$upstream/issues/$pr_number/comments"
