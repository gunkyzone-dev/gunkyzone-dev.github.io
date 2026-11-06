# gunkyzone-dev.github.io

## Building and optimizing comics

The Astro project lives in `Astro Site/`. Run `npm ci` and then `npm run build` from that directory. The build converts every PDF in `public/comics/` into size-limited WebP pages and a `pages.json` manifest in `dist/comics/`; source PDFs are preserved. It also creates a WebP thumbnail from the first page and adds new issues to the built `dist/data/media.json`, so they appear in the homepage and comics archive without a separate metadata entry. The comics viewer uses generated pages when available and only loads pages near the reader's scroll position.

To publish a comic, place its PDF directly in `Astro Site/public/comics/` with a filename using letters, numbers, `_` or `-` (for example, `TEAR4_compressed.pdf`), then commit and push. GitHub Actions builds and deploys the converted pages, thumbnail, and catalog entry. The default title comes from the filename; an existing Firebase comic entry for that issue can still override its title, URL, and thumbnail. Generated pages and catalog changes are build output and should not be committed separately.

## Firebase access setup

The site uses Firebase's public web configuration. The chat interface offers Firebase email/password registration and sign-in, Google sign-in, and password reset. Homepage presence, guestbook, and visit-count writes still use anonymous Authentication. The existing Realtime Database rules are unchanged by the chat UI update; they remain the actual access-control boundary. Admin edits require an email/password account whose UID is listed at `/admins/<uid>`. Do not restore broad public `.write` rules.