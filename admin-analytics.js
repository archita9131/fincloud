// Admin analytics: dashboard insights + login activity graph (day / month / year) + broadcast controls.
import { collection, getDocs, query, orderBy, limit, doc, setDoc, getDoc, deleteDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const COLORS = ["#6744e5", "#df4b88", "#09a878", "#ef7c36", "#3b9cff", "#b04fd8"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let charts = {}, cache = null, cacheAt = 0, mode = "day", sample = false, ctx = null;

function draw(id, cfg) {
  charts[id]?.destroy();
  const el = $(id);
  if (el && window.Chart) charts[id] = new Chart(el, cfg);
}

async function loadEvents(db) {
  if (cache && Date.now() - cacheAt < 30000) return cache;
  const snap = await getDocs(query(collection(db, "loginEvents"), orderBy("createdAt", "desc"), limit(5000)));
  cache = snap.docs.map(d => {
    const x = d.data(), t = x.createdAt?.toDate?.() || new Date();
    return { uid: x.uid, name: x.name || x.email || "User", type: x.type, t,
      day: x.day || dayKey(t), month: x.month || dayKey(t).slice(0, 7), year: x.year || String(t.getFullYear()) };
  });
  cacheAt = Date.now();
  return cache;
}

// Synthetic events for presentations (never written to Firestore).
function sampleEvents() {
  const out = [], now = new Date();
  for (let i = 0; i < 400; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const weekend = [0, 6].includes(d.getDay());
    const n = Math.round((weekend ? 6 : 16) + Math.random() * 14 * (1 - i / 700));
    for (let k = 0; k < n; k++) {
      const u = Math.floor(Math.random() * 28), t = new Date(d);
      t.setHours(8 + Math.floor(Math.random() * 13), Math.floor(Math.random() * 60));
      out.push({ uid: "s" + u, name: "Sample User " + (u + 1), type: Math.random() < .06 ? "signup" : "login",
        t, day: dayKey(t), month: dayKey(t).slice(0, 7), year: String(t.getFullYear()) });
    }
  }
  return out;
}

function buckets(events) {
  const now = new Date(), labels = [], keys = [];
  if (mode === "day") for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    keys.push(dayKey(d)); labels.push(`${d.getDate()} ${MONTHS[d.getMonth()]}`);
  } else if (mode === "month") for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); labels.push(`${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
  } else for (let y = now.getFullYear() - 4; y <= now.getFullYear(); y++) { keys.push(String(y)); labels.push(String(y)); }
  const total = Object.fromEntries(keys.map(k => [k, 0])), uniq = Object.fromEntries(keys.map(k => [k, new Set()]));
  events.forEach(e => { const k = e[mode]; if (k in total) { total[k]++; uniq[k].add(e.uid); } });
  return { labels, logins: keys.map(k => total[k]), users: keys.map(k => uniq[k].size) };
}

function renderActivity(events) {
  const b = buckets(events);
  const title = { day: "last 30 days", month: "last 12 months", year: "last 5 years" }[mode];
  $("activityRange").textContent = `Logins per ${mode} · ${title}`;
  document.querySelectorAll("#activityMode button").forEach(x => x.classList.toggle("on", x.dataset.mode === mode));
  draw("activityChart", {
    data: { labels: b.labels, datasets: [
      { type: "bar", label: "Total logins", data: b.logins, backgroundColor: "#8d6cf0", borderRadius: 6, order: 2 },
      { type: "line", label: "Unique active users", data: b.users, borderColor: "#df4b88", backgroundColor: "#df4b88", tension: .35, pointRadius: 3, order: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#eef0f6" } }, x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } } } }
  });
}

async function initBroadcastControls(db) {
  const msgInput = $("broadcastMessage");
  const typeSelect = $("broadcastType");
  const pubBtn = $("publishBroadcastBtn");
  const clearBtn = $("clearBroadcastBtn");
  const feedback = $("broadcastFeedback");
  const badge = $("announcementBadge");
  if (!pubBtn) return;

  // Load existing notice if present
  try {
    const snap = await getDoc(doc(db, "announcements", "current"));
    if (snap.exists() && snap.data().active) {
      const data = snap.data();
      if (msgInput) msgInput.value = data.message || "";
      if (typeSelect) typeSelect.value = data.type || "info";
      if (badge) badge.textContent = "Notice Active";
    } else {
      if (badge) badge.textContent = "No Notice Active";
    }
  } catch (err) { console.warn("Broadcast load error:", err); }

  pubBtn.onclick = async () => {
    const text = msgInput.value.trim();
    if (!text) {
      if (feedback) { feedback.textContent = "Please enter an announcement message."; feedback.className = "message error"; }
      return;
    }
    pubBtn.disabled = true;
    pubBtn.textContent = "Publishing...";
    try {
      await setDoc(doc(db, "announcements", "current"), {
        message: text,
        type: typeSelect.value || "info",
        active: true,
        updatedAt: serverTimestamp()
      });
      if (feedback) { feedback.textContent = "Announcement published live to user dashboards!"; feedback.className = "message success"; }
      if (badge) badge.textContent = "Notice Active";
    } catch (err) {
      console.error("Publish error:", err);
      if (feedback) { feedback.textContent = "Failed to publish notice: " + (err.message || "Permission error"); feedback.className = "message error"; }
    } finally {
      pubBtn.disabled = false;
      pubBtn.textContent = "Publish Notice";
    }
  };

  clearBtn.onclick = async () => {
    clearBtn.disabled = true;
    try {
      await setDoc(doc(db, "announcements", "current"), { active: false, updatedAt: serverTimestamp() });
      if (msgInput) msgInput.value = "";
      if (feedback) { feedback.textContent = "Announcement cleared."; feedback.className = "message success"; }
      if (badge) badge.textContent = "No Notice Active";
    } catch (err) {
      console.error("Clear notice error:", err);
    } finally {
      clearBtn.disabled = false;
    }
  };
}

export async function renderAdminAnalytics(c) {
  ctx = c;
  if (!$("activityChart")) return;             // not the admin dashboard page
  const { db, users, txs, money, escapeHtml } = c;
  let events = [];
  try { events = sample ? sampleEvents() : await loadEvents(db); }
  catch (e) { console.warn("Could not load login events:", e); }

  // Init Broadcast controls
  initBroadcastControls(db);

  // ----- KPIs & Analytics Calculations -----
  const now = new Date(), today = dayKey(now), month = today.slice(0, 7), year = String(now.getFullYear());
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const todayEv = events.filter(e => e.day === today);
  const monthEv = events.filter(e => e.month === month);
  const income = txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);
  const rate = income ? Math.round(((income - expense) / income) * 100) : 0;
  const banked = users.filter(u => u.bankName).length;

  // Platform Txn Stats & Risk Indicators
  const totalTxnVol = txs.length;
  const totalTxnAmt = txs.reduce((s, t) => s + Number(t.amount || 0), 0);
  const avgTxnSize = totalTxnVol ? Math.round(totalTxnAmt / totalTxnVol) : 0;

  const userFinances = {};
  txs.forEach(t => {
    const k = t.userId || t.userName;
    userFinances[k] ||= { inc: 0, exp: 0 };
    if (t.type === "income") userFinances[k].inc += Number(t.amount || 0);
    else userFinances[k].exp += Number(t.amount || 0);
  });
  const deficitCount = Object.values(userFinances).filter(u => u.exp > u.inc).length;
  const highSpendersCount = Object.values(userFinances).filter(u => u.exp > 50000).length;

  // DAU / MAU Calculation
  const dauSet = new Set(todayEv.map(e => e.uid));
  const mauSet = new Set(monthEv.map(e => e.uid));
  const dauCount = dauSet.size;
  const mauCount = mauSet.size || users.length || 1;
  const dauMauRatio = Math.min(100, Math.round((dauCount / mauCount) * 100));

  // Peak Login Hour Calculation
  const hourCounts = Array(24).fill(0);
  events.forEach(e => { if (e.t) hourCounts[e.t.getHours()]++; });
  let peakHour = 10, maxHourCount = 0;
  hourCounts.forEach((cnt, h) => { if (cnt > maxHourCount) { maxHourCount = cnt; peakHour = h; } });
  const formatHour = h => {
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    return `${displayH}:00 ${period}`;
  };
  const peakStr = maxHourCount ? `${formatHour(peakHour)}` : "10:00 AM";

  const set = (id, v) => { if ($(id)) $(id).textContent = v; };
  set("kpiLoginsToday", todayEv.length);
  set("kpiUniqueToday", `${dauCount} unique users`);
  set("kpiNet", money(income - expense));
  set("kpiRate", `Savings rate ${rate}%`);
  set("kpiBank", users.length ? Math.round((banked / users.length) * 100) + "%" : "0%");
  set("kpiBankSub", `${banked} of ${users.length} users linked a bank`);
  set("kpiSignups", events.filter(e => e.type === "signup" && e.t >= weekAgo).length);

  set("kpiAvgTxnSize", `Avg txn: ${money(avgTxnSize)}`);
  set("kpiDeficitCount", deficitCount);
  set("kpiHighSpenders", highSpendersCount);
  set("kpiDauMau", `${dauMauRatio}%`);
  set("kpiPeakTime", `Peak activity: ${peakStr}`);

  set("sumToday", todayEv.length);
  set("sumMonth", monthEv.length);
  set("sumYear", events.filter(e => e.year === year).length);
  set("sumDauMau", `${dauMauRatio}%`);
  set("sumPeak", peakStr);

  // ----- Income vs expense, last 6 months -----
  const ml = [], mk = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    mk.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); ml.push(MONTHS[d.getMonth()]);
  }
  const sum = (type, k) => txs.filter(t => t.type === type && (t.date || "").startsWith(k)).reduce((s, t) => s + Number(t.amount || 0), 0);
  draw("trendChart", { type: "bar",
    data: { labels: ml, datasets: [
      { label: "Income", data: mk.map(k => sum("income", k)), backgroundColor: "#09a878", borderRadius: 6 },
      { label: "Expense", data: mk.map(k => sum("expense", k)), backgroundColor: "#ef7c36", borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: { y: { beginAtZero: true, grid: { color: "#eef0f6" } }, x: { grid: { display: false } } } } });

  // ----- Spending by category -----
  const cat = {};
  txs.filter(t => t.type === "expense").forEach(t => { const k = t.category || "Other"; cat[k] = (cat[k] || 0) + Number(t.amount || 0); });
  const top = Object.entries(cat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  draw("categoryChart", { type: "doughnut",
    data: { labels: top.map(x => x[0]), datasets: [{ data: top.map(x => x[1]), backgroundColor: COLORS, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } } } });

  // ----- Most active users (by transaction count) -----
  const byUser = {};
  txs.forEach(t => { const k = t.userId || t.userName; (byUser[k] ||= { name: t.userName, n: 0, vol: 0 }).n++; byUser[k].vol += Number(t.amount || 0); });
  const rank = Object.values(byUser).sort((a, b) => b.n - a.n).slice(0, 5);
  $("topUsers").innerHTML = rank.length ? rank.map((u, i) => `<div class="rank"><b>${i + 1}</b>
    <span style="flex:1">${escapeHtml(u.name)}</span><span class="muted">${u.n} txns</span><strong>${money(u.vol)}</strong></div>`).join("")
    : `<div class="empty">No transactions yet</div>`;

  // ----- Activity graph + recent logins -----
  renderActivity(events);
  $("sampleNote").classList.toggle("hidden", !sample);
  $("sampleToggle").textContent = sample ? "Use real data" : "Preview sample data";
  $("recentLogins").innerHTML = events.length ? events.slice(0, 10).map(e => `<tr><td>${e.t.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
    <td>${escapeHtml(e.name)}</td><td>${e.type === "signup" ? "New signup" : "Login"}</td></tr>`).join("")
    : `<tr><td colspan="3" class="empty">No logins recorded yet. Logins are tracked from now on.</td></tr>`;

  document.querySelectorAll("#activityMode button").forEach(btn => btn.onclick = () => { mode = btn.dataset.mode; renderActivity(events); });
  $("sampleToggle").onclick = () => { sample = !sample; renderAdminAnalytics(ctx); };
}

