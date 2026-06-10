# Mailer Server

A standalone Node.js + Express server that receives contact form submissions and delivers them via Nodemailer over Gmail SMTP. Exposes a single endpoint: `POST /api/contact`.

## Requirements

- Node.js 18+ (ESM project — `"type": "module"`)
- A Gmail account with 2-Step Verification enabled and an **App Password**

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
SMTP transporter is ready to send messages.
Mailer server running on port 3001
```

If the credentials are missing or wrong you'll instead see `SMTP transporter verification failed: ...` — the server still starts, but sends will fail until the credentials are corrected.

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on (default `3001`) |
| `GMAIL_USER` | The Gmail address used to authenticate with SMTP |
| `GMAIL_APP_PASSWORD` | A Gmail **App Password** (not your account password) |
| `RECIPIENT_EMAIL` | Where contact form submissions are delivered |
| `CORS_ORIGIN` | The allowed frontend origin (e.g. `https://cavalucci.com`) |

### Generating a Gmail App Password

`myaccount.google.com` → **Security** → **2-Step Verification** → **App Passwords**. Generate a password and paste it into `GMAIL_APP_PASSWORD`. Never use your real account password.

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
  "idea": "I'd love to build a deck off the back of the house..."
}
```

Responses:

| Scenario | Status | Body |
|---|---|---|
| Success | 200 | `{ "success": true, "message": "Your message has been sent." }` |
| Validation failure | 400 | `{ "success": false, "message": "<validation detail>" }` |
| Rate limit exceeded | 429 | express-rate-limit default response |
| Server / SMTP error | 500 | `{ "success": false, "message": "Something went wrong. Please try again later." }` |

Rate limit: **10 requests per IP per 15 minutes**.

## Project Structure

```
src/
├── index.js              # Entry point — starts the server
├── app.js                # Express app (middleware + routes)
├── routes/contact.js     # POST /api/contact handler + rate limiter
├── services/mailer.js    # Nodemailer transporter + sendMail()
├── validators/contactSchema.js  # Joi validation schema
└── middleware/errorHandler.js   # Centralized error handler
```
