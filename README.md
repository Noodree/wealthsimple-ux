# Wealthsimple net worth: practice copy

A copy of Wealthsimple's Net worth page, built to practice editing with Claude Code and Git.
All the numbers are made up.

## Files

- `index.html`: the page structure
- `styles.css`: colours, spacing and fonts (measured from the real site), plus the mobile layout
- `data.js`: the accounts and balances. Change these to change what the page shows
- `app.js`: draws the chart, breakdown bar, account list and side panel

## Open it

Double-click `index.html`, or run `python3 -m http.server 8765` in this folder and go to http://localhost:8765.
Make the window narrower than 720px to see the mobile layout.

## Prototypes: leaving accounts out of net worth

Open `prototypes.html` for five ways to let someone leave accounts (like a child's RESP) out of their net worth.
Each one is the same page with `?v=a` to `?v=e` on the URL, and a slim purple bar on the left switches between them.
