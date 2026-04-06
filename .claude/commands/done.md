---
description: Signal work complete and submit to merge queue
allowed-tools: Bash(gt done:*), Bash(git status:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(bd close:*)
argument-hint: [--status COMPLETED|ESCALATED|DEFERRED] [--pre-verified]
---

# Done — Submit Work to Merge Queue

Signal that your work is complete and ready for the merge queue.

Arguments: $ARGUMENTS

## Pre-flight Checks

Before running `gt done`, verify your work is ready:

```bash
git status                          # Must be clean (no uncommitted changes)
git log --oneline origin/main..HEAD # Must have at least 1 commit
```

If there are uncommitted changes, commit them first:
```bash
git add <files>
git commit -m "<type>: <description>"
```

## Deployment Verification (Web-Admin Changes)

If your changes include web-admin files, verify the Vercel deployment:

```bash
scripts/polecat-verify-deployment.sh
```

**CRITICAL:** If deployment verification fails:
- DO NOT call `gt done`
- Create escalation bead:
  ```bash
  bd create --title="Vercel deployment failed for [work description]" \
    --type=bug --priority=2 --stdin <<DETAILS
  Deployment verification failed after pushing [bead-id].

  Changes pushed: [commit SHA]
  Error: [paste error output]

  Vercel logs: vercel logs [deployment-url]
  DETAILS
  ```
- File escalation:
  ```bash
  gt escalate -s HIGH "Deployment verification failed for [bead-id]"
  ```
- Exit session WITHOUT calling `gt done`

**Success path:** Deployment verified → Continue to Execute section

## Execute

Run `gt done` with any provided arguments:

```bash
gt done $ARGUMENTS
```

**Common usage:**
- `gt done` — Submit completed work (default: --status COMPLETED)
- `gt done --pre-verified` — Submit with pre-verification (you ran gates after rebase)
- `gt done --status ESCALATED` — Signal blocker, skip MR
- `gt done --status DEFERRED` — Pause work, skip MR

**If the bead has nothing to implement** (already fixed, can't reproduce):
```bash
bd close <issue-id> --reason="no-changes: <brief explanation>"
gt done
```

This command pushes your branch, submits an MR to the merge queue, and transitions
you to IDLE. The Refinery handles the actual merge. You are done after this.
