# gunkyzone-dev.github.io

## Building and optimizing comics

The Astro project lives in `Astro Site/`. Run `npm ci` and then `npm run build` from that directory. The build converts every PDF in `public/comics/` into size-limited WebP pages and a `pages.json` manifest in `dist/comics/`; source PDFs are preserved. The comics viewer uses those generated pages when available and only loads pages near the reader's scroll position.

To generate optimized pages for a comic, place its PDF in `Astro Site/public/comics/` with a URL-safe filename using letters, numbers, `_` or `-` (for example, `TEAR4_compressed.pdf`). Add the issue to the existing comic metadata/admin flow as well so it appears in the archive. Generated pages are build output and should not be committed separately.

## Firebase access setup

The site uses Firebase's public web configuration. Realtime Database access is enforced by `JS/firebase-db.rules`: visitors use anonymous Authentication for chat, presence, guestbook, and visit-count writes; admin edits require an email/password account whose UID is listed at `/admins/<uid>`. Enable Anonymous and Email/Password sign-in in Firebase Authentication, create the admin account, add its UID as `true` under `/admins`, then publish the rules from `JS/firebase-db.rules` in the Realtime Database Rules tab. Do not restore broad public `.write` rules.