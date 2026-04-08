---
phase: 08-dead-code-config-cleanup
reviewed: 2026-04-07T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - vite.config.ts
  - vitest.smoke.config.ts
  - nginx.conf
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-04-07T12:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed three configuration files: `vite.config.ts` (Vite build + Vitest unit test config), `vitest.smoke.config.ts` (separate smoke test config), and `nginx.conf` (production server config). The Vite/Vitest configs are clean and well-structured. The nginx config has a header inheritance issue and is missing important security headers recommended for production SPAs.

## Warnings

### WR-01: Nginx `add_header` inheritance bypasses security headers on static assets

**File:** `nginx.conf:14-21`
**Issue:** In nginx, when a `location` block contains any `add_header` directive, the headers defined at the `server` level are NOT inherited for that location. The regex location block (lines 14-16) has `add_header Cache-Control "public, immutable"`, which means the security headers `X-Frame-Options` and `X-Content-Type-Options` defined at server level (lines 20-21) will NOT be applied to static assets (JS, CSS, images, fonts). This is a common nginx gotcha.

**Fix:** Duplicate the security headers inside the static assets location block:

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

### WR-02: Missing security headers in nginx config for production

**File:** `nginx.conf:19-21`
**Issue:** The nginx config lacks several security headers recommended for production SPAs: `Strict-Transport-Security` (HSTS), `Content-Security-Policy`, and `Referrer-Policy`. Given this app connects to external AI APIs (OpenAI, Gemini, Groq) and Supabase from the browser, a Content-Security-Policy would help mitigate XSS risks. HSTS is essential if the app is served over HTTPS.

**Fix:** Add these headers at server level (and duplicate in location blocks per WR-01):

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co https://api.openai.com https://generativelanguage.googleapis.com https://api.groq.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:;" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

Note: The CSP `connect-src` directives should be adjusted to match the actual external endpoints used by the app. The `style-src 'unsafe-inline'` is likely needed for Tailwind CSS v4 inline styles.

## Info

### IN-01: Low coverage thresholds in Vitest config

**File:** `vite.config.ts:26-31`
**Issue:** Coverage thresholds are set quite low (25% branches, 30% functions, 35% statements, 40% lines). While this is better than zero and coverage only includes two files (`openai.ts`, `geminiLive.ts`), these thresholds provide minimal protection against regressions.
**Fix:** Consider gradually raising thresholds as more tests are added, and expanding the `include` list to cover more service files.

---

_Reviewed: 2026-04-07T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
