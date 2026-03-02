# Sobriety Plan - Variation B (Proofs + Subscriptions First, Local Only)

This plan is intentionally local-only for planning and validation.  
No deployment, no chain writes to production, and no feature enablement in live environments.

## Scope Choice
- Included: proof-of-attendance integrity, hash-only proof pipeline, subscription gating, governance hardening.
- Deferred: SPL token minting and public tokenomics launch.

## 1. Phase 0 - Baseline Stabilization
### Phase goal
Harden the current attendance and subscription baseline before any blockchain dependency.

### Core tasks
- Lock attendance v2 request/response contracts and validation behavior.
- Confirm subscription gating rules for proof features.
- Finalize audit trail shape for attendance submissions and email outcomes.

### Dependencies
- Existing auth/session flows.
- Existing attendance models and admin endpoints.

### Risks
- Hidden contract drift between frontend and backend.
- Email queue reliability masking true submission success.

### Verification steps
- Run unit/integration smoke tests for attendance + subscription paths.
- Verify duplicate upsert behavior and masked public verification output.
- Confirm admin retry-email flow can recover failed notifications.

## 2. Phase 1 - Proof-Only Ledger (Hash-Only, Non-PII)
### Phase goal
Create tamper-evident proof records without storing personal data on-chain.

### Core tasks
- Define canonical proof payload schema from attendance submissions:
  - `submissionKey`, `certificateId`, normalized meeting date/time, and content hash.
- Add local proof generation service to create deterministic hashes.
- Add local verification utility to recompute and validate proof matches.
- Prepare chain adapter interface (disabled by default) for later memo writes.

### Dependencies
- Stable attendance submission schema.
- Deterministic normalization utilities.

### Risks
- Hash mismatches from inconsistent normalization.
- Accidental inclusion of PII in proof payload.

### Verification steps
- Same input always produces identical hash.
- Hash changes on meaningful field edits only.
- Proof validation fails on any tampered payload.

## 3. Phase 2 - Payments Reliability (Stripe Readiness)
### Phase goal
Ensure subscription lifecycle is accurate and auditable before governance restrictions.

### Core tasks
- Validate checkout/session creation mapping for monthly/annual plans.
- Add idempotency handling for webhook processing.
- Define clear downgrade/expiry behavior for gated features.
- Add operational dashboard counters: checkout success, webhook success, desync count.

### Dependencies
- Existing subscription routes and billing models.
- Webhook endpoint integrity checks.

### Risks
- Webhook retries causing duplicate state updates.
- False active/inactive subscription states.

### Verification steps
- Local replay tests: checkout -> webhook -> active subscription.
- Replay same webhook event and confirm no duplicate side effects.
- Validate access control flips correctly on expiry/cancel paths.

## 4. Phase 3 - Governance Hardening (No Token Minting Yet)
### Phase goal
Enable controlled proposal/vote mechanics tied to trust and active subscription.

### Core tasks
- Restrict proposal and voting actions to active qualified users.
- Add anti-spam thresholds and audit logging for governance actions.
- Introduce admin moderation controls for emergency freeze/review.

### Dependencies
- Reliable subscription state.
- Audit log storage and admin auth.

### Risks
- Governance abuse via sybil or burst actions.
- Poor observability for disputed actions.

### Verification steps
- Access tests: inactive users cannot propose/vote.
- Audit logs capture actor, action, timestamp, and decision path.
- Emergency freeze prevents state transitions as designed.

## 5. Phase 4 - Optional Tokenization Prep (Design-Only)
### Phase goal
Prepare for future minting without enabling any mint path now.

### Core tasks
- Define mint trigger policy from verified milestones.
- Define abuse protections (cooldowns, one-time milestone proofs, replay guards).
- Document wallet-linking UX and recovery/fallback options.

### Dependencies
- Proven proof integrity and governance controls.

### Risks
- Incentive manipulation before abuse controls are mature.
- User support load from wallet errors.

### Verification steps
- Threat model review for replay and farming vectors.
- Dry-run simulations with mocked mint adapter only.

## 6. Config Checklist (Local Planning Baseline)
- `ATTENDANCE_VERIFICATION_FORM_V2=true`
- `ATTENDANCE_SUBMISSION_REQUIRE_SUBSCRIPTION=true`
- `ATTENDANCE_DISABLE_EMAIL_QUEUE=false` (or true for isolated tests)
- `STRIPE_SECRET_KEY` (test key)
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`
- `STRIPE_WEBHOOK_SECRET`
- `SOLANA_ENABLED=false` (until proof adapter validation complete)
- `PROOF_ONLY=true` (for future chain adapter mode)
- `SOLANA_MINT_ENABLED=false`

## 7. Migrations and Admin Setup (Planning)
- Add migration for proof hash fields and verification metadata (if not present).
- Ensure admin role can:
  - review attendance submissions,
  - retry failed emails,
  - view proof verification outcomes,
  - freeze governance actions.

## 8. Rollback Plan
- Feature flags remain the primary rollback switch.
- If proof pipeline misbehaves: disable proof writes, keep attendance submits active.
- If payments desync occurs: freeze gated actions, re-run webhook reconciliation job.
- If governance abuse detected: enable emergency freeze and manual admin review mode.

## 9. Execution Policy
- This variation is local planning only.
- Do not deploy, do not enable production flags, and do not activate minting.
