# Mailer Server

A standalone Node.js + Express server that receives contact form submissions and delivers them via the [Resend](https://resend.com) email API. Exposes a single endpoint: `POST /api/contact`.

> Resend sends over HTTPS, which is why this works on hosts that block outbound SMTP (such as Render's free tier).

Each submission sends **two** emails:
1. A **notification** to the business (`RECIPIENT_EMAIL`), with the visitor's address as reply-to.
2. An **auto-confirmation** to the visitor, from `CONFIRMATION_FROM_EMAIL`.

The notification is the critical send (a failure returns HTTP 500). The confirmation is best-effort — if it fails, the failure is logged but the request still succeeds, so a captured lead is never lost.

## Requirements

- Node.js 18+ (ESM project — `"type": "module"`)
- A [Resend](https://resend.com) account and API key (free tier ~3,000 emails/month)

## Setup

```bash
# 1. Clone and enter the project
git clone <repo-url>
cd mailer-server

# 2. Install dependencies
npm install

# 3. Create your environment file from the template
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env

# 4. Fill in .env with your credentials (see below)

# 5. Run in development (auto-reload via nodemon)
npm run dev

# ...or run in production
npm start
```

On startup you should see:

```
Resend email client initialized.
Mailer server running on port 3001
```

If `RESEND_API_KEY` is missing you'll instead see `RESEND_API_KEY is not set — email sending will fail...` — the server still starts, but sends will fail until the key is configured.

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on (default `3001`). On Render, leave unset — the platform injects it. |
| `RESEND_API_KEY` | Your Resend API key |
| `FROM_EMAIL` | "From" address on the notification email, e.g. `Cavalucci Construction <ralph@cavalucci.com>` (must be a mailbox on your verified domain) |
| `CONFIRMATION_FROM_EMAIL` | "From" address on the auto-confirmation sent to the visitor, e.g. `Cavalucci Construction <noreply@cavalucci.com>` (must be on your verified domain) |
| `RECIPIENT_EMAIL` | Where notifications are delivered; also the reply-to on confirmation emails |
| `GOOGLE_PLACES_API_KEY` | Google Places API (New) key for address autocomplete. Used server-side only; restrict it to Places API (New). |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key. When set, `/api/contact` requires a valid `turnstileToken`; when unset, the check is skipped with a warning. Cloudflare's always-pass test secret is `1x0000000000000000000000000000000AA`. |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated (e.g. `https://cavalucci.com,https://www.cavalucci.com`). Blank in local dev allows any localhost origin. |

### Resend setup

1. Create an account at [resend.com](https://resend.com).
2. **API Keys → Create API Key** → paste into `RESEND_API_KEY`.
3. **From address:**
   - *Testing:* use `onboarding@resend.dev`. Without a verified domain, Resend only delivers to the email address you signed up with — set `RECIPIENT_EMAIL` to that address.
   - *Production:* add and verify your domain (**Domains → Add Domain**, then add the DNS records Resend gives you). Then you can send from `contact@cavalucci.com` to any recipient.

## API

### `POST /api/contact`

Request body (`application/json`):

```json
{
  "name": "Jane Smith",
  "phone": "212-555-0101",
  "email": "jane@example.com",
  "address": {
    "line1": "123 Main St",
    "line2": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "zip": "10001"
  },
  "projectDetails": "I'd love to build a deck off the back of the house..."
}
```

Responses:

| Scenario | Status | Body |
|---|---|---|
| Success | 200 | `{ "success": true, "message": "Your message has been sent." }` |
| Validation failure | 400 | `{ "success": false, "message": "<validation detail>" }` |
| Rate limit exceeded | 429 | `{ "success": false, "message": "Too many submissions. Please try again later." }` |
| Server / email error | 500 | `{ "success": false, "message": "Something went wrong. Please try again later." }` |

Rate limit: **5 requests per IP per 10 minutes** (override with `CONTACT_RATE_MAX`).

Validation rules (server-side, Joi): state must be NJ/NY/PA/CT and the ZIP prefix must match it; name needs a plausible first + last name; street must start with a house number (or PO Box); phone must be a valid 10-digit US number; unknown fields are rejected; a populated `_honey` honeypot field returns 400 and never reaches Resend. Rejections are logged as JSON (reason + field names only, no personal data). Request bodies are capped at 10kb.

## Project Structure

```
src/
├── index.js              # Entry point — starts the server
├── app.js                # Express app (middleware + routes)
├── routes/contact.js     # POST /api/contact handler + rate limiter
├── services/mailer.js    # Resend client + sendMail()
├── validators/contactSchema.js  # Joi validation schema
└── middleware/errorHandler.js   # Centralized error handler
```
