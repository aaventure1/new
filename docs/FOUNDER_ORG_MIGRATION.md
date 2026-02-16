# Founder to Org Migration Playbook

This guide helps you move AAVenture into a company-owned GitHub organization and collaborate with a cofounder without exposing personal commit history in the new repo.

## Recommended Path (Best for identity separation)
Use a fresh repository import with a new initial commit.

Benefits:
- Removes old commit authorship from the new repo timeline.
- Lets you use a neutral business Git identity.
- Keeps your personal account out of day-to-day collaboration.

Limit:
- Existing public history cannot be erased from places where it already exists.

## Before You Start
- Create a business email (example: `founder@yourdomain.com`).
- Create a GitHub organization (you are doing this now).
- Decide repo visibility (`private` recommended until legal docs are signed).
- Prepare founder docs (LLC + IP assignment + equity + vesting + confidentiality).

## Step 1: Configure Neutral Git Identity (for this migration only)
Run in the new export repo (not globally):

```bash
git config user.name "AAVenture Founding Team"
git config user.email "founder@yourdomain.com"
```

## Step 2: Create Fresh-History Company Repo
From the current project root (`/Users/smk/dev/apps/aaventure`):

```bash
./scripts/admin/bootstrap-org-repo.sh /tmp/aaventure-company aaventure-org/aaventure
```

What this does:
- Copies project files to a new folder.
- Excludes local/sensitive/dev-only files (`.git`, `.env`, `node_modules`, logs, cache).
- Initializes a new git repo.
- Creates one clean initial commit.
- Attempts to create/push to your org repo via `gh` if authenticated.

## Step 3: If `gh` Is Not Authenticated Yet
Use either option:

1. Authenticate and rerun script push step:
```bash
gh auth login
```

2. Or create repo manually in GitHub UI and push:
```bash
cd /tmp/aaventure-company
git remote add origin git@github.com:aaventure-org/aaventure.git
git push -u origin main
```

## Step 4: Add Cofounder Safely
- Invite cofounder to organization with least privilege needed.
- Keep admin access limited.
- Enable branch protection on `main`:
  - Require pull requests
  - Require at least 1 approval
  - Block force pushes

## Step 5: Business Ownership Guardrails
Set these before major joint development:
- LLC formed (or your chosen entity)
- Signed founder IP assignment to company
- Equity split in writing
- Vesting schedule documented
- Confidentiality and invention assignment in writing

## Quick Command Checklist

```bash
# 1) Build clean export + initial commit
./scripts/admin/bootstrap-org-repo.sh /tmp/aaventure-company aaventure-org/aaventure

# 2) If needed, login to GH CLI
gh auth login

# 3) Manual push fallback
cd /tmp/aaventure-company
git remote add origin git@github.com:aaventure-org/aaventure.git
git push -u origin main
```

## Notes
- Keep your current repo as private archive/history if needed.
- Use org-owned secrets and deployment accounts (not personal where possible).
