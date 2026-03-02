# Go-Live Security and Reliability Checklist

Use this as a release gate. A production launch is approved only when every `Required` item is complete.

## 1) Secrets and Environment (Required)
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` set to a long random value (not placeholder)
- [ ] `SESSION_SECRET` set to a long random value (not placeholder)
- [ ] At least one origin configured (`BASE_URL` / `CLIENT_URL` / `ALLOWED_ORIGINS`)
- [ ] `ALLOW_DEMO_SUBSCRIPTIONS=false`

## 2) Payments and Webhooks (Required if billing enabled)
- [ ] Valid Stripe production key configured
- [ ] `STRIPE_WEBHOOK_SECRET` configured and verified
- [ ] Test payment + webhook end-to-end in production-like environment

## 3) Security Controls (Required)
- [ ] Helmet headers active
- [ ] API write routes enforce origin/referer checks
- [ ] Auth and registration rate limiting active
- [ ] No fallback placeholder secrets in production

## 4) Reliability (Required)
- [ ] `/api/health` returns healthy status
- [ ] Smoke tests pass (`npm run test:smoke`)
- [ ] CI passing on default branch
- [ ] Error logs monitored (server + deploy platform)

## 5) Dependency and Supply Chain (Required)
- [ ] `npm run audit:prod` returns no high/critical vulnerabilities
- [ ] Lockfile committed and deterministic installs verified

## 6) User Journey Validation (Required)
- [ ] Register/login/logout works with session cookies
- [ ] Join meeting and chat flow works
- [ ] Attendance verification form submit works
- [ ] Certificate verification endpoint returns expected masked identity
- [ ] Subscription success + status checks work

## 7) Data and Recovery (Required)
- [ ] Mongo backups configured and restore tested
- [ ] Incident owner assigned and contact path documented

## 8) Nice-to-have Before Scale
- [ ] Add integration tests for subscription and attendance lifecycle
- [ ] Add structured logging + alert thresholds
- [ ] Add threat model doc with abuse cases
