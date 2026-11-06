# gunkyzone-dev.github.io

## Building and optimizing comics

The Astro project lives in `Astro Site/`. Run `npm ci` and then `npm run build` from that directory. The build converts every PDF in `public/comics/` into size-limited WebP pages and a `pages.json` manifest in `dist/comics/`; source PDFs are preserved. The comics viewer uses those generated pages when available and only loads pages near the reader's scroll position.

To generate optimized pages for a comic, place its PDF in `Astro Site/public/comics/` with a URL-safe filename using letters, numbers, `_` or `-` (for example, `TEAR4_compressed.pdf`). Add the issue to the existing comic metadata/admin flow as well so it appears in the archive. Generated pages are build output and should not be committed separately.

## Firebase access setup

The site uses Firebase's public web configuration. The chat interface offers Firebase email/password registration and sign-in, Google sign-in, and password reset. Homepage presence, guestbook, and visit-count writes still use anonymous Authentication. The existing Realtime Database rules are unchanged by the chat UI update; they remain the actual access-control boundary. Admin edits require an email/password account whose UID is listed at `/admins/<uid>`. Do not restore broad public `.write` rules.