# Mailer Server

A standalone Node.js + Express server that receives contact form submissions and delivers them via the [Resend](https://resend.com) email API. Exposes a single endpoint: `POST /api/contact`.

> Resend sends over HTTPS, which is why this works on hosts that block outbound SMTP (such as Render's free tier).

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
| `FROM_EMAIL` | The "from" address, e.g. `Cavalucci Contact <onboarding@resend.dev>` for testing, or `Cavalucci Contact <contact@cavalucci.com>` once your domain is verified |
| `RECIPIENT_EMAIL` | Where contact form submissions are delivered |
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
| Rate limit exceeded | 429 | express-rate-limit default response |
| Server / email error | 500 | `{ "success": false, "message": "Something went wrong. Please try again later." }` |

Rate limit: **10 requests per IP per 15 minutes**.

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
