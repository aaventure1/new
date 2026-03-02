# Cofounder Access and Branch Protection (GitHub)

This is the fastest safe setup for a two-founder team.

## A) Add Cofounder Access
1. Open repo settings:
   - `https://github.com/aaventure1/new/settings/access`
2. Click `Invite teams or people`.
3. Add cofounder GitHub username.
4. Choose role:
   - `Admin` only for true cofounders.
   - `Write` for collaborators/contractors.
5. Ask cofounder to accept the invite.

## B) Enable Branch Protection on `main`
1. Open branch rules:
   - `https://github.com/aaventure1/new/settings/branches`
2. Click `Add branch ruleset` (or add rule for `main`).
3. Apply to branch name pattern: `main`.
4. Turn on:
   - Require a pull request before merging
   - Require approvals: `1`
   - Dismiss stale approvals when new commits are pushed
   - Block force pushes
   - Block branch deletion
5. Save.

## C) CODEOWNERS Note
This repo includes `.github/CODEOWNERS` with a temporary owner. Update it when your founder team/usernames are final.

## D) Recommended Org Hardening
1. Require 2FA for organization members.
2. Keep admin role limited to founders.
3. Review access monthly and remove stale collaborators.

## E) First Week Operating Rule
- No direct commits to `main`.
- Every change goes through PR with one founder approval.
