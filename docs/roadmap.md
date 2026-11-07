# Roadmap

Each phase leaves the site usable, so the team can start sharing text after Phase 1.

## Phase 1: Text pastes

Build the Next.js project, database schema, team passcode, slug handling, and the create, view and raw routes.

**Done when:**

- [x] A visitor without a session is redirected from `/` to `/login`.
- [x] A wrong passcode is rejected, and the sixth attempt within 15 minutes returns `429`.
- [x] A team member can create a paste at a custom slug and open it in a private window.
- [x] An empty slug field produces a random 7-character slug.
- [x] Invalid and reserved slugs are rejected with the matching error code.
- [x] Two simultaneous creates with one slug produce one `201` and one `409`.
- [x] `/Standup-Notes` redirects to `/standup-notes`.
- [x] Markdown containing a `<script>` tag or a `javascript:` link renders without either.
- [x] `/{slug}/raw` returns `text/plain` with `nosniff` and the sandbox policy.

## Phase 2: Files and images

Add R2, signed uploads, the upload interface, image previews and downloads.

Two R2 behaviors must be tested first, because the documentation couldn't confirm them:

- Whether `Content-Disposition` set at upload is stored and returned on download. If it isn't, try `response-content-disposition` on the signed download URL, and update [Security](security.md) and [Data model](data-model.md) with the result.
- Whether signing `Content-Length` makes R2 reject an upload of a different size. If it doesn't, the `HEAD` check still enforces the limit, and [Security](security.md#abuse-limits) should be corrected.

**Done when:**

- [ ] A 100 MB file uploads and downloads successfully on the deployed site.
- [ ] A file over 100 MB is refused before any upload starts.
- [ ] The bucket can't be read without a signed URL.
- [ ] A signed download link stops working after 5 minutes.
- [ ] An uploaded HTML file and SVG file both download and never display in the browser.
- [ ] PNG, JPEG, GIF and WebP images display on the paste page.
- [ ] Creating a paste with a file whose actual size doesn't match returns `422`.
- [ ] A paste can hold 10 files, and an eleventh is rejected.

## Phase 3: Expiry, passwords and burn after read

Add paste options, the unlock and reveal routes, and the cleanup cron job.

**Done when:**

- [x] An expired paste returns `404` right away, before cleanup runs.
- [x] A slug held by an expired paste can be claimed right away.
- [x] A password-protected paste shows no content, title or file links before unlock.
- [ ] `/{slug}/raw` and `/{slug}/download` return `401 locked` for a locked paste.
- [x] The sixth wrong password within 15 minutes returns `429`.
- [x] Opening a burn-after-read link in a chat app preview doesn't burn it.
- [x] Two simultaneous reveals produce one `200` and one `404`.
- [ ] Files from a burned paste download for at least 5 minutes after reveal, and inline media stays available for 1 hour.
- [ ] Cleanup removes expired pastes, abandoned uploads and old rate-limit rows from both the database and R2.
- [ ] Cleanup returns `401` without `CRON_SECRET`.

## Phase 4: Managing pastes

Add the edit page, renaming, deletion and storage limits.

**Done when:**

- [x] A team member can edit content, title, expiry and password.
- [x] Renaming to a taken slug returns `409` and changes nothing.
- [x] After a rename, the old link returns `404`.
- [x] Changing a password invalidates existing unlock cookies.
- [ ] Deleting a paste frees its slug, and cleanup removes its files.
- [ ] An upload that would exceed `MAX_TOTAL_STORAGE_BYTES` returns `507`.
- [x] Edit and delete return `401` without a session.

## Phase 5: Production and polish

Finish deployment, the interface details and security checks.

**Done when:**

- [ ] The site runs on its final domain, deployed from GitHub.
- [ ] Response headers match [Security](security.md#response-headers) on all page types.
- [ ] The site has no public listing of pastes, and paste routes send `noindex`.
- [ ] The Content Security Policy shows no violations during create, upload, view and download.
- [ ] The create, view and unlock pages work on a phone.
- [ ] Pages can be used with a keyboard alone.
- [ ] A backup has been restored successfully, if the team uses backups.
- [ ] The README quick start has been tested from an empty environment.

## Later ideas

These aren't planned, and should wait for a real need:

- Individual team logins with a record of who created what
- Client-side encryption for sensitive pastes
- A command-line tool for sharing from the terminal
- Paste version history
- Virus scanning for uploads
- Resumable uploads for files over 100 MB
