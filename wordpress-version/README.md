# AAVenture WordPress Parallel Build

This folder contains a standalone WordPress implementation of Attendance Verification v2.

## What is included

- Docker stack for local WordPress + MySQL
- Plugin: `aaventure-attendance-v2`
- Auto-provisioned site pages:
  - Home
  - Meetings
  - Attendance Verification Form
  - Certificate Verification
  - About
- Custom post type for meetings (`aav_meeting`)
- REST API endpoints for:
  - metadata token
  - helper suggestions
  - submit verification form
  - public verification lookup
  - admin list/detail/retry email
- WordPress admin review screen: `Attendance Submissions`
- Shortcodes:
  - Attendance form: `[aaventure_attendance_form]`
  - Public certificate verifier: `[aaventure_verify_certificate]`

## Run locally

1. Start services:

```bash
cd /Users/smk/dev/apps/aaventure/wordpress-version
docker compose up -d
```

2. Open:

- WordPress: `http://localhost:8081`
- WP Admin: `http://localhost:8081/wp-admin`

3. Activate plugin:

- `Plugins` -> `AAVenture Attendance Verification v2` -> `Activate`

4. Add a page and insert shortcode:

```text
[aaventure_attendance_form]
```

Note: plugin activation now auto-creates core pages and sets Home as front page.
You only need manual page creation if you want custom slugs/content.

5. Optional: Add a public verify page:

```text
[aaventure_verify_certificate]
```

6. Admin operations:

- Open `WP Admin -> Attendance Submissions`
- Filter by status/search
- Retry email delivery
- Set/update certificate ID

## Notes

- This WordPress build is intentionally separate from the Node stack.
- It mirrors the same flow and API contracts where practical.
- Subscription gate is optional and controlled by filter or constant:
  - Define `AAVENTURE_WP_REQUIRE_SUBSCRIPTION` as `true` to enforce.
  - Integrate your membership plugin by hooking `aaventure_attendance_user_has_active_subscription`.
- REST routes always work through `?rest_route=/aaventure/v1/...`.
  - Pretty route style (`/wp-json/aaventure/v1/...`) requires permalink rewrite support in the environment.

## Free Deployment Reality

- Fully free + always-on WordPress hosting is usually not reliable for production workloads.
- Best zero-cost mode:
  - run local with Docker (`localhost:8081`) for development/demo.
  - publish code to GitHub for collaborators and iterate quickly.
- If you need a stable public production site, use low-cost WordPress hosting (recommended).

## Node + WordPress Sync

This WordPress build can sync attendance submissions into the custom Node app.

- WordPress service env:
  - `AAVENTURE_NODE_SYNC_URL` (default in compose: `http://host.docker.internal:3000`)
  - `AAVENTURE_SYNC_TOKEN` (shared secret)
- Node app env:
  - `AAV_SYNC_TOKEN` must match WordPress token
  - `WORDPRESS_BRIDGE_URL` optional verify fallback (e.g. `http://localhost:8081`)

With both apps running, form submissions in WordPress are pushed to Node so certificate lookups/admin stay aligned.
