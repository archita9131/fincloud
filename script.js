import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc, getDoc,
  serverTimestamp, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { renderAdminAnalytics } from "./admin-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCdrUnwGv7gGGcCL0Gf7aEIS88gZEn2uic",
  authDomain: "fincloud-30e77.firebaseapp.com",
  projectId: "fincloud-30e77",
  storageBucket: "fincloud-30e77.firebasestorage.app",
  messagingSenderId: "616303134218",
  appId: "1:616303134218:web:59c80d6f7acb7f047701f3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const rawSegment = location.pathname.split("/").filter(Boolean).pop() || "login.html";
let page = rawSegment;
if (page === "admin") page = "admin.html";
if (page === "login") page = "login.html";
if (page === "admin-users") page = "admin-users.html";
if (page === "index") page = "index.html";
if (page === "income") page = "income.html";
if (page === "expenses") page = "expenses.html";
if (page === "transactions") page = "transactions.html";

const showLogin = new URLSearchParams(location.search).has("login") || new URLSearchParams(location.search).has("logout");
const protectedPages = ["index.html", "income.html", "expenses.html", "transactions.html"];
const adminEmail = "admin@fincloud.com";
let adminUsersCache = [];
let adminTransactionsCache = [];

const txRef = uid => collection(db, "users", uid, "transactions");
const money = n => "₹" + Number(n || 0).toLocaleString("en-IN");

async function saveProfile(user, name = "") {
  const ref = doc(db, "users", user.uid);
  let oldName = "";

  // Firestore contains the name saved during registration.
  // If Firestore is temporarily unavailable, Firebase Auth displayName
  // is still used, so the user's name will not disappear from the dashboard.
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      oldName = String(existing.data().name || "").trim();
    }
  } catch (err) {
    console.warn("Could not read profile:", err);
  }

  const finalName = (
    name ||
    user.displayName ||
    oldName ||
    user.email?.split("@")[0] ||
    "User"
  ).trim();

  // Keep the name in Firebase Authentication as well.
  if (user.displayName !== finalName) {
    try {
      await updateProfile(user, { displayName: finalName });
    } catch (err) {
      console.warn("Could not update Auth profile:", err);
    }
  }

  try {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || "",
      name: finalName,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("Could not save Firestore profile:", err);
  }

  return finalName;
}

// Records one login/signup event for the admin activity graph. Never blocks or breaks login.
async function logLogin(user, type, name = "") {
  if (!user || user.email?.toLowerCase() === adminEmail) return;
  const d = new Date(), p = n => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  try {
    await Promise.race([
      addDoc(collection(db, "loginEvents"), {
        uid: user.uid, email: user.email || "", name: name || user.displayName || "",
        type, createdAt: serverTimestamp(), day, month: day.slice(0, 7), year: day.slice(0, 4)
      }),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]);
  } catch (err) { console.warn("Could not log login event:", err); }
}

function msg(id, text, ok = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = "message " + (ok ? "success" : "error");
}

const adminLoginForm = document.getElementById("adminLoginForm");
if (adminLoginForm) {
  adminLoginForm.onsubmit = async event => {
    event.preventDefault();
    const email = document.getElementById("adminEmail").value.trim().toLowerCase();
    const password = document.getElementById("adminPassword").value;
    const message = document.getElementById("adminAuthMessage");
    if (email !== adminEmail) {
      message.textContent = "Admin access is restricted to the authorized account.";
      message.className = "message error";
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.replace("admin.html");
    } catch (error) {
      message.textContent = error.code === "auth/invalid-credential" ? "Invalid admin email or password." : "Admin login failed. Please try again.";
      message.className = "message error";
    }
  };
}

const authForm = document.getElementById("authForm");
if (authForm) {
  const adminLink = document.querySelector('a[href="/admin"]');
  if (adminLink) {
    const adminButton = document.createElement("button");
    adminButton.type = "button";
    adminButton.className = adminLink.className;
    adminButton.textContent = "Admin Login";
    adminButton.style.cssText = adminLink.style.cssText;
    adminButton.onclick = () => window.location.replace("/admin.html");
    adminLink.replaceWith(adminButton);
  }

  let mode = "login";
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const nameWrap = document.getElementById("nameWrap");
  const nameInput = document.getElementById("name");
  const title = document.getElementById("formTitle");
  const submit = document.getElementById("authSubmit");

  function setMode(m) {
    mode = m;
    const signup = m === "signup";
    nameWrap.style.display = signup ? "block" : "none";
    nameInput.required = signup;
    title.textContent = signup ? "Create your account" : "Welcome back";
    submit.textContent = signup ? "Create Account" : "Login";
    loginTab.classList.toggle("active", !signup);
    signupTab.classList.toggle("active", signup);
    msg("authMessage", "");
  }

  loginTab.onclick = () => setMode("login");
  signupTab.onclick = () => setMode("signup");

  authForm.onsubmit = async e => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const name = nameInput.value.trim();
    submit.disabled = true;
    submit.textContent = "Please wait...";
    try {
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        await saveProfile(result.user, name);
        await logLogin(result.user, "signup", name);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await logLogin(result.user, "login");
      }
      location.href = email.toLowerCase() === adminEmail ? "admin.html" : "index.html";
    } catch (e) {
      let text = "Something went wrong. Please try again.";
      if (e.code === "auth/email-already-in-use") text = "This email is already registered.";
      else if (e.code === "auth/invalid-credential") text = "Invalid email or password.";
      else if (e.code === "auth/weak-password") text = "Password must contain at least 6 characters.";
      else if (e.code === "auth/invalid-email") text = "Please enter a valid email.";
      msg("authMessage", text);
      submit.disabled = false;
      submit.textContent = mode === "signup" ? "Create Account" : "Login";
    }
  };

  document.getElementById("forgotPassword").onclick = async () => {
    const email = document.getElementById("email").value.trim();
    if (!email) return msg("authMessage", "Enter your email first.");
    try {
      await sendPasswordResetEmail(auth, email);
      msg("authMessage", "Password reset email sent. Check your inbox.", true);
    } catch {
      msg("authMessage", "Could not send reset email. Check the email address.");
    }
  };
}

onAuthStateChanged(auth, async user => {
  const isLoginPage = !!document.getElementById("authForm");
  const isAdminPage = !!document.getElementById("adminLogin") || !!document.getElementById("adminUserList");
  const isUserProtectedPage = !isLoginPage && !isAdminPage;

  // 1. On User Login Page (login.html)
  if (isLoginPage) {
    if (user && showLogin) {
      await signOut(auth);
      return;
    }
    if (user) {
      location.replace(user.email?.toLowerCase() === adminEmail ? "admin.html" : "index.html");
      return;
    }
    return; // Stay on login page if unauthenticated
  }

  // 2. On User Protected Pages (index.html, income.html, expenses.html, transactions.html)
  if (isUserProtectedPage) {
    if (!user) {
      location.replace("login.html");
      return;
    }
    if (user.email?.toLowerCase() === adminEmail) {
      location.replace("admin.html");
      return;
    }
  }

  // 3. On Admin Pages (admin.html, admin-users.html)
  if (isAdminPage) {
    if (!user || user.email?.toLowerCase() !== adminEmail) {
      if (user) await signOut(auth);
      const adminLogin = document.getElementById("adminLogin");
      const adminDashboard = document.getElementById("adminDashboard");
      if (adminLogin) adminLogin.style.display = "block";
      if (adminDashboard) adminDashboard.classList.add("hidden");
      document.body.className = "auth-page";
      return;
    }
    const adminLogin = document.getElementById("adminLogin");
    const adminDashboard = document.getElementById("adminDashboard");
    if (adminLogin) adminLogin.style.display = "none";
    if (adminDashboard) adminDashboard.classList.remove("hidden");
    document.body.className = "";
  }

  if (!user) return;

  // Always resolve the name before loading the dashboard.
  let savedName = user.displayName || "";
  try {
    savedName = await saveProfile(user, savedName);
  } catch (err) {
    console.error("Profile loading error:", err);
    savedName = user.displayName || user.email?.split("@")[0] || "User";
  }

  if (isUserProtectedPage) {
    const profile = await getDoc(doc(db, "users", user.uid));
    if (profile.exists() && profile.data().status === "suspended") {
      await signOut(auth);
      alert("Your account has been suspended. Please contact the administrator.");
      location.replace("login.html");
      return;
    }
  }

  document.querySelectorAll(".user-email").forEach(x => x.textContent = user.email || "");
  document.querySelectorAll(".user-name").forEach(x => x.textContent = savedName);
  document.querySelectorAll(".avatar").forEach(x => x.textContent = savedName.charAt(0).toUpperCase());

  document.querySelectorAll(".logout-btn").forEach(btn => {
    btn.onclick = async e => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = "Logging out...";
      try {
        await signOut(auth);
        location.replace("login.html");
      } catch (err) {
        console.error("Logout error:", err);
        btn.disabled = false;
        btn.innerHTML = '<span class="side-icon">⇥</span> Logout';
        alert("Unable to logout. Please try again.");
      }
    };
  });

  const adminLogout = document.getElementById("adminLogout");
  if (adminLogout) {
    adminLogout.onclick = async () => {
      await signOut(auth);
      location.replace("login.html");
    };
    const userEmailEl = document.getElementById("adminUserEmail");
    if (userEmailEl) userEmailEl.textContent = user.email || "Admin";
  }

  if (isAdminPage) {
    await loadAdminDashboard();
  } else {
    await loadDashboard(user);
    await loadTransactions(user);
  }
});

async function loadAdminDashboard() {
  const userList = document.getElementById("adminUserList");
  const transactionList = document.getElementById("adminTransactionList");
  if (!userList) return;
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const users = usersSnap.docs.map(item => ({ id: item.id, ...item.data() }));
    adminUsersCache = users;
    const allTransactions = [];
    for (const profile of users) {
      const transactions = await getDocs(txRef(profile.id));
      transactions.forEach(item => allTransactions.push({
        id: item.id, userId: profile.id, userName: profile.name || profile.email || "User", ...item.data()
      }));
    }
    adminTransactionsCache = allTransactions;
    const income = allTransactions.filter(item => item.type === "income")
      .reduce((total, item) => total + Number(item.amount || 0), 0);
    const expense = allTransactions.filter(item => item.type === "expense")
      .reduce((total, item) => total + Number(item.amount || 0), 0);
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    setText("adminUserCount", users.length);
    setText("adminActiveCount", users.filter(item => item.status !== "suspended").length);
    setText("adminTransactionCount", allTransactions.length);
    setText("adminIncome", money(income));
    setText("adminExpense", money(expense));
    const userSearch = document.getElementById("adminUserSearch");
    const statusFilter = document.getElementById("adminStatusFilter");
    const searchText = userSearch?.value.trim().toLowerCase() || "";
    const selectedStatus = statusFilter?.value || "all";
    const visibleUsers = users.filter(profile => {
      const status = profile.status === "suspended" ? "suspended" : "active";
      const matchesText = !searchText || `${profile.name || ""} ${profile.email || ""}`.toLowerCase().includes(searchText);
      return matchesText && (selectedStatus === "all" || status === selectedStatus);
    });
    userList.innerHTML = visibleUsers.length ? visibleUsers.map(profile => {
      const status = profile.status === "suspended" ? "suspended" : "active";
      const nextStatus = status === "active" ? "suspended" : "active";
      return `<tr><td>${escapeHtml(profile.name || "User")}</td><td>${escapeHtml(profile.email || "-")}</td>
        <td>${profile.bankName ? "Bank added" : "No bank"}</td><td><span class="badge ${status}">${status}</span></td>
        <td>${formatAdminDate(profile.updatedAt)}</td><td><button class="edit-admin-user" data-user-id="${escapeHtml(profile.id)}">Edit</button> <button class="manage-user" data-user-id="${escapeHtml(profile.id)}" data-status="${nextStatus}">${nextStatus === "active" ? "Activate" : "Suspend"}</button></td></tr>`;
    }).join("") : `<tr><td colspan="6" class="empty">No matching users</td></tr>`;
    document.querySelectorAll(".manage-user").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        try {
          await updateDoc(doc(db, "users", button.dataset.userId), { status: button.dataset.status, updatedAt: serverTimestamp() });
          await loadAdminDashboard();
        } catch (error) {
          console.error("User management error:", error);
          alert("Could not update this user.");
          button.disabled = false;
        }
      };
    });
    document.querySelectorAll(".edit-admin-user").forEach(button => {
      button.onclick = async () => {
        const profile = users.find(item => item.id === button.dataset.userId);
        if (!profile) return;
        const name = prompt("User name:", profile.name || "");
        if (name === null) return;
        const bankName = prompt("Bank name:", profile.bankName || "");
        if (bankName === null) return;
        const bankNumber = prompt("Demo account number:", profile.bankNumber || "");
        if (bankNumber === null) return;
        const balanceText = prompt("Opening balance:", String(profile.bankBalance ?? 0));
        if (balanceText === null) return;
        const bankBalance = Number(balanceText);
        if (!Number.isFinite(bankBalance) || bankBalance < 0) {
          alert("Opening balance must be a valid positive number.");
          return;
        }
        try {
          await updateDoc(doc(db, "users", profile.id), {
            name: name.trim() || "User",
            bankName: bankName.trim(),
            bankNumber: bankNumber.trim(),
            bankBalance,
            updatedAt: serverTimestamp()
          });
          await loadAdminDashboard();
        } catch (error) {
          console.error("User details update error:", error);
          alert("Could not update user details.");
        }
      };
    });
    if (userSearch) userSearch.oninput = () => loadAdminDashboard();
    if (statusFilter) statusFilter.onchange = () => loadAdminDashboard();
    const refreshButton = document.getElementById("adminRefresh");
    if (refreshButton) refreshButton.onclick = () => loadAdminDashboard();
    const exportButton = document.getElementById("adminExport");
    if (exportButton) exportButton.onclick = exportAdminUsers;
    const exportTxnsButton = document.getElementById("adminExportTxns");
    if (exportTxnsButton) exportTxnsButton.onclick = exportAdminTransactions;
    allTransactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (transactionList) {
      transactionList.innerHTML = allTransactions.length ? allTransactions.slice(0, 25).map(item => `
        <tr><td>${item.date || "-"}</td><td>${escapeHtml(item.userName)}</td><td>${item.type}</td>
        <td>${escapeHtml(item.category || "Other")}</td><td class="${item.type}-text">${item.type === "income" ? "+" : "-"}${money(item.amount)}</td></tr>`).join("")
        : `<tr><td colspan="5" class="empty">No transactions yet</td></tr>`;
    }
    renderAdminAnalytics({ db, users, txs: allTransactions, money, escapeHtml })
      .catch(err => console.error("Analytics error:", err));
  } catch (error) {
    console.error("Admin dashboard error:", error);
    const message = document.getElementById("adminMessage");
    if (message) message.textContent = "Could not load admin data. Check your admin access.";
  }
}

function exportAdminUsers() {
  if (!adminUsersCache.length) return;
  const rows = ["Name,Email,Bank Status,Status,Last Updated"];
  adminUsersCache.forEach(profile => {
    const values = [
      profile.name || "User",
      profile.email || "",
      profile.bankName ? "Bank added" : "No bank",
      profile.status === "suspended" ? "suspended" : "active",
      formatAdminDate(profile.updatedAt)
    ].map(value => `"${String(value).replace(/"/g, '""')}"`);
    rows.push(values.join(","));
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "fincloud-users.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportAdminTransactions() {
  if (!adminTransactionsCache.length) return;
  const rows = ["Date,User,Type,Category,Amount,Description"];
  adminTransactionsCache.forEach(t => {
    const values = [
      t.date || "",
      t.userName || "User",
      t.type || "",
      t.category || "Other",
      t.amount || 0,
      t.description || ""
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
    rows.push(values.join(","));
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "fincloud-transactions.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
}

function formatAdminDate(value) {
  if (!value || typeof value.toDate !== "function") return "-";
  return value.toDate().toLocaleDateString("en-IN");
}

async function getTransactions(user) {
  const snap = await getDocs(txRef(user.uid));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function renderUserBroadcast() {
  const container = document.getElementById("userBroadcastContainer");
  if (!container) return;
  try {
    const snap = await getDoc(doc(db, "announcements", "current"));
    if (snap.exists() && snap.data().active) {
      const data = snap.data();
      const typeBg = data.type === "warning" ? "#fff4e5" : data.type === "success" ? "#e6f9f0" : "#eeeafd";
      const typeBorder = data.type === "warning" ? "#ffca99" : data.type === "success" ? "#8ce6c3" : "#cbbaff";
      const typeColor = data.type === "warning" ? "#c95200" : data.type === "success" ? "#067a55" : "#4c26a6";
      const icon = data.type === "warning" ? "⚠️" : data.type === "success" ? "🎉" : "💡";
      container.innerHTML = `<div style="background:${typeBg};border:1px solid ${typeBorder};color:${typeColor};padding:12px 18px;border-radius:14px;margin-bottom:20px;display:flex;align-items:center;gap:12px;font-size:13px;font-weight:600;">
        <span style="font-size:18px;">${icon}</span>
        <div style="flex:1;">${escapeHtml(data.message)}</div>
      </div>`;
    } else {
      container.innerHTML = "";
    }
  } catch (err) {
    console.warn("Could not load user announcement:", err);
  }
}

async function loadDashboard(user) {
  await renderUserBroadcast();
  const incomeEl = document.getElementById("totalIncome");
  if (!incomeEl) return;

  try {
    const data = await getTransactions(user);
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};
    const bankBalance = Number(profile.bankBalance || 0);
    const income = data.filter(x => x.type === "income").reduce((s,x) => s + Number(x.amount || 0), 0);
    const expense = data.filter(x => x.type === "expense").reduce((s,x) => s + Number(x.amount || 0), 0);
    const balance = bankBalance + income - expense;

    const bankNameEl = document.getElementById("bankName");
    const bankNumberEl = document.getElementById("bankNumber");
    const bankBalanceEl = document.getElementById("bankBalance");
    if (bankNameEl) bankNameEl.textContent = profile.bankName || "No bank account added";
    if (bankNumberEl) bankNumberEl.textContent = profile.bankNumber ? "•••• " + String(profile.bankNumber).slice(-4) : "Add a demo bank account";
    if (bankBalanceEl) bankBalanceEl.textContent = profile.bankName ? money(bankBalance) : "₹0";

    document.getElementById("balance").textContent = money(balance);
    incomeEl.textContent = money(income);
    document.getElementById("totalExpense").textContent = money(expense);
    const incomeBar = document.getElementById("incomeBar");
    const expenseBar = document.getElementById("expenseBar");
    const transactionCount = document.getElementById("transactionCount");
    if (incomeBar) incomeBar.style.width = income ? "100%" : "0%";
    if (expenseBar) expenseBar.style.width = income ? Math.min(100, (expense / income) * 100) + "%" : "0%";
    if (transactionCount) transactionCount.textContent = data.length;
    document.getElementById("balanceStatus").textContent =
      balance >= 0 ? "You're on track" : "Expenses are higher than income";

    const recent = document.getElementById("recentList");
    if (recent) {
      const sorted = [...data].sort((a,b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
      recent.innerHTML = sorted.length ? sorted.map(x => `
        <div class="recent-row">
          <div class="recent-icon ${x.type}">${x.type === "income" ? "↗" : "↘"}</div>
          <div class="recent-info"><b>${x.category || "Other"}</b><span>${x.date || ""}</span></div>
          <strong class="${x.type}-text">${x.type === "income" ? "+" : "-"}${money(x.amount)}</strong>
        </div>`).join("") : `<div class="empty">No transactions yet. Add your first income or expense.</div>`;
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadTransactions(user) {
  const list = document.getElementById("transactionList");
  if (!list) return;
  try {
    const data = await getTransactions(user);
    data.sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    if (!data.length) {
      list.innerHTML = `<tr><td colspan="6" class="empty">No transactions yet</td></tr>`;
      return;
    }
    list.innerHTML = data.map(x => `
      <tr>
        <td>${x.date || "-"}</td>
        <td><span class="type-badge ${x.type}">${x.type}</span></td>
        <td>${x.category || "-"}</td>
        <td>${x.description || "-"}</td>
        <td class="${x.type}-text">${x.type === "income" ? "+" : "-"}${money(x.amount)}</td>
        <td><button class="delete-btn" data-id="${x.id}">Delete</button></td>
      </tr>`).join("");

    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Delete this transaction?")) return;
        await deleteDoc(doc(db, "users", user.uid, "transactions", btn.dataset.id));
        await loadTransactions(user);
        await loadDashboard(user);
      };
    });
  } catch (e) { console.error(e); }
}

async function addTransaction(user, type, amount, category, date, description) {
  await addDoc(txRef(user.uid), {
    amount, type, category, date, description, createdAt: serverTimestamp()
  });
}

const incomeForm = document.getElementById("incomeForm");
if (incomeForm) {
  incomeForm.onsubmit = async e => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return location.href = "login.html";
    try {
      await addTransaction(
        user, "income",
        Number(document.getElementById("incomeAmount").value),
        document.getElementById("incomeCategory").value,
        document.getElementById("incomeDate").value,
        document.getElementById("incomeDescription").value.trim()
      );
      alert("Income added successfully!");
      incomeForm.reset();
    } catch (e) { alert("Could not add income: " + e.message); }
  };
}

const expenseForm = document.getElementById("expenseForm");
if (expenseForm) {
  expenseForm.onsubmit = async e => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return location.href = "login.html";
    try {
      await addTransaction(
        user, "expense",
        Number(document.getElementById("expenseAmount").value),
        document.getElementById("expenseCategory").value,
        document.getElementById("expenseDate").value,
        document.getElementById("expenseDescription").value.trim()
      );
      alert("Expense added successfully!");
      expenseForm.reset();
    } catch (e) { alert("Could not add expense: " + e.message); }
  };
}


// ================================
// DEMO BANK ACCOUNT
// ================================
const openBankBtn = document.getElementById("openBankBtn");
const closeBankBtn = document.getElementById("closeBankBtn");
const bankModal = document.getElementById("bankModal");
const bankForm = document.getElementById("bankForm");

if (openBankBtn && bankModal) {
  openBankBtn.onclick = () => {
    bankModal.style.display = "flex";
    const user = auth.currentUser;
    if (user) {
      getDoc(doc(db, "users", user.uid)).then(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const name = document.getElementById("bankNameInput");
        const number = document.getElementById("bankNumberInput");
        const balance = document.getElementById("bankOpeningBalance");
        if (name) name.value = data.bankName || "";
        if (number) number.value = data.bankNumber || "";
        if (balance) balance.value = data.bankBalance ?? "";
      }).catch(err => console.warn("Could not load bank account:", err));
    }
  };
}

if (closeBankBtn && bankModal) {
  closeBankBtn.onclick = () => bankModal.style.display = "none";
  bankModal.addEventListener("click", e => {
    if (e.target === bankModal) bankModal.style.display = "none";
  });
}

if (bankForm) {
  bankForm.onsubmit = async e => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      alert("Please login first.");
      location.href = "login.html";
      return;
    }

    const bankName = document.getElementById("bankNameInput").value.trim();
    const bankNumber = document.getElementById("bankNumberInput").value.trim();
    const bankBalance = Number(document.getElementById("bankOpeningBalance").value);
    const saveBtn = bankForm.querySelector("button[type=submit]");

    if (!bankName || !bankNumber || !Number.isFinite(bankBalance) || bankBalance < 0) {
      alert("Please enter bank name, account number and a valid opening balance.");
      return;
    }

    try {
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving..."; }
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email || "",
        bankName,
        bankNumber,
        bankBalance,
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (bankModal) bankModal.style.display = "none";
      alert("Bank account added successfully!");
      await loadDashboard(user);
    } catch (err) {
      console.error("Bank account save error:", err);
      alert("Could not save bank account: " + (err.message || "Please check Firebase."));
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Bank Account"; }
    }
  };
}
