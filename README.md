# jordandarby.com — Static Rebuild

Your complete site, rebuilt as fast, secure, plugin-free static files.
Same look, same content — minus the noindex tag, dead links, and hosting bill.

## Your 4 steps (about 20 minutes total)

### 1. Download your images (one command)
While your current SiteGround site is STILL LIVE, open Terminal,
drag this folder's `get-images.sh` file into the window (or `cd` into this
folder), and run:

    bash get-images.sh

It pulls all 76 images from your live site into the right folders with the
right names. When it finishes it prints "Done. Downloaded: 76  Failed: 0".
If anything fails, tell Claude the failed URLs.

Sanity check: double-click `index.html` — the full site should open in your
browser with every photo showing.

### 2. Put it on Netlify (free)
- Go to https://app.netlify.com and sign up (free tier).
- On the dashboard choose "Add new site" → "Deploy manually".
- Drag this ENTIRE folder into the drop zone.
- Netlify gives you a temporary URL like `something.netlify.app` — open it
  and confirm the site works.

### 3. Point your domain
- In Netlify: Site settings → Domain management → Add custom domain →
  enter `jordandarby.com`. Netlify shows you the DNS records it needs.
- Wherever your domain is registered (likely SiteGround): edit DNS to match
  what Netlify shows (typically an A record to Netlify's IP and a CNAME for
  `www`). Netlify's on-screen instructions are exact — follow them.
- Wait for DNS to update (minutes to a few hours). Netlify auto-issues a
  free SSL certificate; the padlock appears on its own.

### 4. Confirm, then cancel
- Visit https://jordandarby.com and click through both pages.
- ONLY THEN cancel the SiteGround **hosting** plan.
- KEEP the domain registration (~$18/yr) — that's separate from hosting.
  (Optional later: transfer the domain to Cloudflare for ~$10/yr.)

## ⚠️ Email warning — read before canceling
If `hello@jordandarby.com` is hosted through SiteGround, canceling hosting
kills that address. Check first (SiteGround dashboard → Email). If it is:
set up Cloudflare Email Routing (free forwarding to Gmail) or Google
Workspace (~$7/mo) BEFORE canceling. Ask Claude for a walkthrough.

## What's in this folder
- `index.html` — homepage (hero, services, work grid, testimonials,
  process, CTA, about)
- `inspiration.html` — inspiration gallery with credits
- `css/style.css` — all styling (colors match your current palette)
- `js/main.js` — subtle scroll reveals + mobile menu (~1 KB, no libraries)
- `get-images.sh` — one-time image downloader
- `images/` — fills up when you run the script

## What got fixed vs. the old site
- noindex/nofollow tag REMOVED — Google can finally find you
- Dead "Sign up" links removed
- Every image has descriptive alt text
- Email is now a clickable mailto button
- Copy nits fixed (double space, odd bolding)
- Proper meta description + Open Graph tags for link previews
- No WordPress/Elementor = nothing to hack, nothing to update, loads fast

## Future edits
Open the HTML in any text editor, change what you need, re-drag the folder
to Netlify. Or bring the folder back to Claude and describe the change.
