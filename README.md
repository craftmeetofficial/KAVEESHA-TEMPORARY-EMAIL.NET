# KAVEESHA TEMPORARY EMAIL.NET

Premium temporary / disposable email service with **real inbound email** delivery.

## Features
- Random unique temporary addresses on your domain
- Real email receiving via Mailgun Inbound Routes
- OTP / verification code detection + copy button
- Auto-refresh inbox every 5 seconds
- Configurable expiration (default 10 min)
- Secure token-based access (no public inbox enumeration)
- HTML sanitization
- Dark premium UI with glassmorphism

## Tech Stack
- Frontend: Vanilla HTML / CSS / JS
- Backend: Vercel Serverless Functions (Node.js)
- Database: Firebase Firestore
- Email: Mailgun Inbound Webhooks

## Quick Start

### 1. Prerequisites
- Node.js 18+
- A domain you control
- Firebase project
- Mailgun account (free tier works)

### 2. Firebase Setup
1. Create a Firebase project → Firestore (start in production mode).
2. Project Settings → Service Accounts → Generate new private key.
3. Copy `project_id`, `client_email`, `private_key`.

Create collections (they are created automatically on first write):
- `inboxes/{localPart}`
- `inboxes/{localPart}/messages/{id}`

### 3. Mailgun + Domain
1. Add your domain in Mailgun (e.g. `temp.yourdomain.com` or apex).
2. Set the **MX records** Mailgun gives you on your DNS.
3. Create an **Inbound Route**:
   - Expression: `match_recipient(".*@yourdomain.com")` (catch-all)
   - Action: Forward to  
     `https://your-vercel-app.vercel.app/api/webhook`
4. Copy API Key and Webhook Signing Key from Mailgun settings.

### 4. Environment Variables (Vercel)