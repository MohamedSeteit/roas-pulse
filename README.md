[roas_pulse_readme.md](https://github.com/user-attachments/files/34942456/roas_pulse_readme.md)
# ROAS Pulse 🚀

**ROAS Pulse** is an all-in-one, white-label B2B SaaS reporting and analytics workspace built by **Mohamed Seteit** for digital marketers, media buyers, and marketing agencies. It unifies multi-channel ad performance, tracks Month-over-Month (MoM) growth, and leverages cumulative AI analysis to deliver actionable campaign insights.

🌐 **Live App:** [https://roas-pulse.vercel.app/](https://roas-pulse.vercel.app/)

## ✨ Key Features

### 1. Client MoM Workspace (Multi-Client & Historical Tracking)

* **Dedicated Client Profiles:** Create, switch, and manage isolated workspaces for each client.

* **Monthly Snapshots (`YYYY-MM`):** Save and retrieve historical monthly performance records with instant **Month-over-Month (MoM) Deltas** for Spend, Revenue, ROAS, and CPA.

* **White-Label Customization:** Customize report titles, agency/brand headers, target KPIs (Target CPA & Target ROAS), currencies, executive notes, and toggle dashboard/PDF sections.

* **Cumulative AI Campaign Analysis (`/api/ai-analyze`):** Passes client profiles, historical monthly records, and past learnings to Google Gemini AI to generate historical comparisons, identify recurring patterns, and recommend next-month targets.

### 2. Print-Ready PDF Reports (`PrintReportModal`)

* **High-Resolution Inline SVG Charts:** Built with `print-color-adjust: exact` for crisp, reliable PDF exports.

* **Focused Financial Visuals:**

  * **Spend vs. Revenue Chart**

  * **ROAS vs. Target ROAS Benchmark Chart**

* **Flexible Grouping:** Toggle chart views seamlessly between **Platform-by-Platform** and **Month-over-Month (MoM)**.

### 3. Authentication & Subscription Management (`AuthSubscriptionModal`)

* **Email & Password Auth:** Powered by Firebase Authentication with encrypted session management.

* **30-Day Free Trial:** Automatic 30-day trial activation upon signup with a live countdown badge in the header.

* **Pro Subscription (\$2.95/month):** Seamless upgrade flow integrated with **Creem** (`creem.io`) and automated webhook status synchronization.

### 4. Automated Integrations (`IntegrationsModal`)

* **Google Sheets & CSV Sync:** Automatically converts Google Sheets links to CSV format and imports campaign rows with built-in SSRF protection.

* **Custom Client Webhooks:** Unique JSON webhook endpoints per client to ingest real-time data from **Zapier**, **Make**, or **n8n**, complete with a one-click test trigger.

* **Ad Platform Templates:** Ready-to-use export templates and formatting guides for **Meta**, **Google Ads**, **TikTok**, and **Snapchat**.

## 🛠️ Tech Stack

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Motion

* **Backend:** Node.js, Express (`server.ts`), `express-rate-limit`

* **Database & Auth:** Firebase Admin SDK, Cloud Firestore, Firebase Authentication

* **AI Engine:** Google Gemini (`@google/genai`)

* **Payments:** Creem (`creem.io`) Checkout & Webhooks

* **Hosting:** Vercel (Serverless Functions + Static Edge CDN)

## ⚙️ Environment Variables

To run this project locally or deploy it to Vercel, configure the following environment variables:

```env
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
FIREBASE_PROJECT_ID=roas-pulse
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_WEB_API_KEY=your-firebase-web-api-key

# Security & Sessions
SESSION_SECRET=your-strong-random-session-secret

# AI Analysis
GEMINI_API_KEY=your-google-gemini-api-key

# Payments (Creem)
CREEM_PAYMENT_URL=https://www.creem.io/payment/your-product-id
CREEM_WEBHOOK_SECRET=your-creem-webhook-secret
```

## 🚀 Local Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/MohamedSeteit/ROAS-PULSE.git
   cd ROAS-PULSE
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add the keys listed above.

4. **Run the development server:**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000` (or the port configured in `server.ts`).

## 👨‍💻 Author & License

Designed & Developed by **Mohamed Seteit** ([GitHub](https://github.com/MohamedSeteit))

© 2026 **ROAS Pulse**. All rights reserved.
