# FinFlow

Full-stack personal finance manager: salary engine, pay slips, spending, investments, growth planning and a family workspace.

**Stack:** Node.js 22.13+ (built-in `node:sqlite`, `crypto`, `http`) — zero npm dependencies. Vanilla JS frontend with hand-rolled SVG charts.

## Run
```
node server.js        # http://127.0.0.1:3000
node test.js          # 17 API tests on a throwaway database
```
Env: `PORT`, `HOST` (use `0.0.0.0` to expose), `SECRET` (cookie signing key; otherwise generated in `data/secret.key`), `DB_FILE`.

## Structure
- `server.js` – REST API, auth (scrypt + signed HttpOnly cookie), SQLite schema, static hosting
- `calc.js` – multi-cadence salary engine (weekly / bi-weekly / monthly / yearly / hourly, deductions, overtime)
- `public/` – SPA (`index.html`, `app.js`, `styles.css`)
- `data/` – SQLite database and secret (git-ignored)

## Ideas adopted from dogiemagi/revenue-management
Salary engine, pay slips with print view + CSV export, accounts, family workspace with invite codes, demo account.

## Notes
- Demo account is shared by everyone who clicks it; use "Reset demo data" to restore it. Don't expose it publicly with real data.
- For public deployment: put behind HTTPS and add the `Secure` cookie flag in `setCookie`.
