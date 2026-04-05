---
description: Signal work complete and submit to merge queue
allowed-tools: Bash(gt done:*), Bash(git status:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(bd close:*)
argument-hint: [--status COMPLETED|ESCALATED|DEFERRED] [--pre-verified] [--target BRANCH]
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

## Deployment Verification (Pre-Verification)

Deployment verification allows you to signal that you've already run the full gate
suite on your rebased branch, enabling the refinery to fast-path merge your work
without re-running gates (~5s merge instead of minutes).

### When to Use --pre-verified

Use `--pre-verified` when you have completed the pre-merge rebase verification step:

1. Rebased your branch onto the latest target branch (e.g., `origin/main`)
2. Run ALL configured quality gates on the rebased result:
   - Build command (if configured)
   - Type check (if configured)
   - Lint (if configured)
   - Full test suite (if configured)
3. All gates passed successfully

### How It Works

**Without --pre-verified (default):**
```
Your MR → Refinery queues it → Refinery runs full gates → Merge if green
```

**With --pre-verified:**
```
Your MR → Refinery trusts your verification → Fast-path merge (~5s)
```

The refinery can skip gate execution because you've certified the work is already
verified on the target branch.

### Requirements for Pre-Verification

To use `--pre-verified`, you MUST:

1. **Rebase onto target first**:
   ```bash
   git fetch origin main
   git rebase origin/main
   ```

2. **Run the full gate suite** (not just targeted tests):
   ```bash
   # Example for this project:
   npm run lint && npm run format && npm test  # Node.js
   # OR
   go test ./... && go vet ./...               # Go
   # OR
   python -m unittest discover tests           # Python
   ```

3. **All gates must pass** — do NOT use --pre-verified if any gate failed

### Example Workflow

```bash
# After implementing your changes:
git add <files>
git commit -m "feat: add new feature (issue-123)"

# Pre-verification step:
git fetch origin main
git rebase origin/main          # Rebase onto target

# Run ALL gates on rebased code:
npm run lint                    # Must pass
npm run format                  # Must pass
npm test                        # Must pass

# If all gates passed, use --pre-verified:
gt done --pre-verified --target main
```

## Execute

Run `gt done` with any provided arguments:

```bash
gt done $ARGUMENTS
```

**Common usage:**
- `gt done` — Submit completed work without pre-verification (default: --status COMPLETED)
- `gt done --pre-verified --target main` — Submit with pre-verification (fast-path merge)
- `gt done --target main` — Submit to specific target branch
- `gt done --status ESCALATED` — Signal blocker, skip MR
- `gt done --status DEFERRED` — Pause work, skip MR

**If the bead has nothing to implement** (already fixed, can't reproduce):
```bash
bd close <issue-id> --reason="no-changes: <brief explanation>"
gt done
```

This command pushes your branch, submits an MR to the merge queue, and transitions
you to IDLE. The Refinery handles the actual merge. You are done after this.

## Notes

- Pre-verification is OPTIONAL but RECOMMENDED when gates are fast enough to run
- Pre-verification saves refinery resources and speeds up merge times
- NEVER use --pre-verified if you skipped gates or any gate failed
- If unsure whether gates passed, omit --pre-verified and let refinery run them
