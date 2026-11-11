
(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const state = {
    computers: [],
    printers: [],
    maintenance: [],
    loaded: false,
    page: "dashboard",
    user: null,
    authenticated: false,
    loading: false
  };

  const pageNames = {
    dashboard: "Dashboard",
    computers: "Inventaris Komputer",
    printers: "Inventaris Printer",
    maintenance: "Maintenance",
    "qr-info": "QR Info"
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.items)) return payload.items;

    if (payload && payload.success === false) {
      throw new Error(payload.message || "Permintaan API gagal.");
    }

    return [];
  }

  function toast(message) {
    const region = $("#toastRegion");
    if (!region) return;

    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;

    region.appendChild(node);
    setTimeout(() => node.remove(), 3500);
  }

  function iconRefresh() {
    if (window.lucide) window.lucide.createIcons();
  }

  function setConnection(ok, text) {
    const label = $("#sidebarConnection");
    const dot = $(".connection-indicator .status-dot");

    if (label) label.textContent = text;
    if (dot) dot.classList.toggle("online", !!ok);
  }

  /* =====================================================
     1. INFORMASI PENGGUNA DAN LOGOUT
  ===================================================== */

  function updateUserDisplay() {
    const actions = $(".topbar-actions");
    if (!actions) return;

    let userInfo = $("#techOpsUserInfo");
    let logoutButton = $("#techOpsLogout");

    if (!state.user) {
      userInfo?.remove();
      logoutButton?.remove();
      return;
    }

    if (!userInfo) {
      userInfo = document.createElement("div");
      userInfo.id = "techOpsUserInfo";
      userInfo.style.cssText =
        "display:flex;flex-direction:column;align-items:flex-end;margin:0 10px;";

      actions.insertBefore(userInfo, $(".avatar"));
    }

    userInfo.innerHTML = `
      <strong style="font-size:12px">
        ${escapeHTML(state.user.nama)}
      </strong>
      <small style="font-size:10px;color:#64748b">
        ${escapeHTML(state.user.role)}
      </small>
    `;

    if (!logoutButton) {
      logoutButton = document.createElement("button");
      logoutButton.id = "techOpsLogout";
      logoutButton.type = "button";
      logoutButton.className = "button button-secondary";
      logoutButton.textContent = "Keluar";
      logoutButton.style.cssText =
        "margin-left:8px;padding:8px 12px;font-size:12px;";

      actions.appendChild(logoutButton);

      logoutButton.addEventListener("click", handleLogout);
    }
  }

  /* =====================================================
     2. HALAMAN LOGIN
  ===================================================== */

  function renderLogin(message = "") {
    state.authenticated = false;
    state.loaded = false;
    state.user = null;

    updateUserDisplay();
    setConnection(false, "Belum login");

    const host = $("#appContent");

    host.innerHTML = `
      <section style="
        min-height:65vh;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:24px 12px;
      ">
        <div class="panel" style="
          width:100%;
          max-width:420px;
          padding:30px;
          border-radius:16px;
        ">
          <div style="text-align:center;margin-bottom:25px">
            <div style="
              width:58px;height:58px;
              margin:0 auto 15px;
              display:flex;align-items:center;justify-content:center;
              background:#eff6ff;border-radius:16px;color:#2563eb;
            ">
              <i data-lucide="monitor-cog" style="width:30px;height:30px"></i>
            </div>

            <h1 style="font-size:23px;margin-bottom:7px">
              GoJak TechOps
            </h1>

            <p class="muted">
              Silakan login untuk mengakses sistem.
            </p>
          </div>

          <form id="techOpsLoginForm">

            <div style="margin-bottom:17px">
              <label for="loginNama" style="
                display:block;font-size:13px;
                font-weight:600;margin-bottom:7px;
              ">Nama Pengguna</label>

              <input
                id="loginNama"
                name="nama"
                type="text"
                autocomplete="username"
                required
                placeholder="Masukkan nama pengguna"
                style="
                  width:100%;padding:12px;
                  border:1px solid #d1d5db;
                  border-radius:9px;
                  box-sizing:border-box;
                "
              >
            </div>

            <div style="margin-bottom:20px">
              <label for="loginPassword" style="
                display:block;font-size:13px;
                font-weight:600;margin-bottom:7px;
              ">Password</label>

              <input
                id="loginPassword"
                name="password"
                type="password"
                autocomplete="current-password"
                required
                placeholder="Masukkan password"
                style="
                  width:100%;padding:12px;
                  border:1px solid #d1d5db;
                  border-radius:9px;
                  box-sizing:border-box;
                "
              >
            </div>

            <p id="loginError" style="
              display:none;
              color:#dc2626;
              font-size:13px;
              margin-bottom:15px;
            "></p>

            <button
              type="submit"
              id="loginSubmit"
              class="button button-primary"
              style="width:100%;justify-content:center;padding:12px"
            >
              Masuk
            </button>

          </form>

          <p style="
            text-align:center;
            font-size:11px;
            color:#94a3b8;
            margin-top:22px;
          ">
            GoJak TechOps — IT Operations
          </p>
        </div>
      </section>
    `;

    $("#techOpsLoginForm").addEventListener("submit", handleLogin);

    iconRefresh();
  }

  async function handleLogin(event) {
    event.preventDefault();

    const nama = $("#loginNama").value.trim();
    const password = $("#loginPassword").value;
    const button = $("#loginSubmit");
    const errorBox = $("#loginError");

    button.disabled = true;
    button.textContent = "Memeriksa login...";

    errorBox.style.display = "none";

    try {
      const result = await TechOpsAPI.login(nama, password);

      if (!result || !result.success || !result.user) {
        throw new Error("Login gagal. Periksa nama dan password.");
      }

      state.user = result.user;
      state.authenticated = true;

      updateUserDisplay();

      await loadAll();
      renderCurrentPage();

      toast("Login berhasil. Selamat datang, " + state.user.nama + ".");

    } catch (error) {
      errorBox.textContent = error.message || "Login gagal.";
      errorBox.style.display = "block";

      button.disabled = false;
      button.textContent = "Masuk";

      $("#loginPassword").value = "";
      $("#loginPassword").focus();
    }
  }

  /* =====================================================
     3. LOGOUT
  ===================================================== */

  async function handleLogout() {
    if (!confirm("Apakah Anda yakin ingin keluar dari GoJak TechOps?")) {
      return;
    }

    const button = $("#techOpsLogout");

    if (button) {
      button.disabled = true;
      button.textContent = "Keluar...";
    }

    try {
      await TechOpsAPI.logout();

      state.computers = [];
      state.printers = [];
      state.maintenance = [];
      state.user = null;
      state.authenticated = false;
      state.loaded = false;

      renderLogin();
      toast("Anda berhasil logout.");

    } catch (error) {
      toast("Logout gagal: " + error.message);

      if (button) {
        button.disabled = false;
        button.textContent = "Keluar";
      }
    }
  }

  /* =====================================================
     4. MEMUAT DATA
  ===================================================== */

  async function loadAll() {
    if (!TechOpsAPI.isAuthenticated()) {
      throw new Error("Silakan login terlebih dahulu.");
    }

    setConnection(false, "Mengambil data...");

    const [computers, printers, maintenance] = await Promise.all([
      TechOpsAPI.get("computers.list"),
      TechOpsAPI.get("printers.list"),
      TechOpsAPI.get("maintenance.list")
    ]);

    state.computers = normalizeArray(computers);
    state.printers = normalizeArray(printers);
    state.maintenance = normalizeArray(maintenance);

    state.loaded = true;

    setConnection(true, "Backend terhubung");

    return state;
  }

  /* =====================================================
     5. KOMPONEN TAMPILAN
  ===================================================== */

  function pageHeading(title, subtitle, eyebrow = "GOJAK TECHOPS") {
    return `
      <section class="page-heading">
        <div>
          <p class="eyebrow">${escapeHTML(eyebrow)}</p>
          <h1>${escapeHTML(title)}</h1>
          <p class="muted">${escapeHTML(subtitle)}</p>
        </div>
        <button class="button button-secondary" id="refreshButton">
          <i data-lucide="refresh-cw"></i> Perbarui data
        </button>
      </section>
    `;
  }

  function statCard(label, value, icon, color, note) {
    return `
      <article class="stat-card">
        <div>
          <div class="stat-label">${escapeHTML(label)}</div>
          <div class="stat-value">${escapeHTML(value)}</div>
          <div class="stat-note">${escapeHTML(note)}</div>
        </div>
        <span class="stat-icon ${color}">
          <i data-lucide="${icon}"></i>
        </span>
      </article>
    `;
  }

  /* =====================================================
     6. DASHBOARD
  ===================================================== */

  function renderDashboard() {
    const host = $("#appContent");

    host.innerHTML =
      pageHeading(
        "Dashboard",
        "Ringkasan inventaris dan operasional perangkat IT.",
        "OVERVIEW"
      ) +
      `
      <section class="stats-grid">
        ${statCard("Total Komputer", state.computers.length, "monitor", "blue", "Data inventaris komputer")}
        ${statCard("Total Printer", state.printers.length, "printer", "teal", "Data inventaris printer")}
        ${statCard("Riwayat Maintenance", state.maintenance.length, "wrench", "amber", "Catatan perawatan/perbaikan")}
        ${statCard("Koneksi Backend", "Online", "activity", "green", "Apps Script dapat diakses")}
      </section>

      <section class="dashboard-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2>Akses Cepat</h2>
              <div class="panel-subtitle">Pilih modul yang ingin dibuka</div>
            </div>
          </div>

          <div class="quick-links">
            <a class="quick-link" href="#computers">
              <span class="stat-icon blue"><i data-lucide="monitor"></i></span>
              <span><strong>Inventaris Komputer</strong><small>Lihat daftar dan spesifikasi</small></span>
            </a>

            <a class="quick-link" href="#printers">
              <span class="stat-icon teal"><i data-lucide="printer"></i></span>
              <span><strong>Inventaris Printer</strong><small>Lihat data perangkat printer</small></span>
            </a>

            <a class="quick-link" href="#maintenance">
              <span class="stat-icon amber"><i data-lucide="wrench"></i></span>
              <span><strong>Maintenance</strong><small>Lihat riwayat perawatan</small></span>
            </a>

            <a class="quick-link" href="#qr-info">
              <span class="stat-icon green"><i data-lucide="qr-code"></i></span>
              <span><strong>QR Info</strong><small>Cari perangkat dari serial/QR</small></span>
            </a>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2>Status Sistem</h2>
              <div class="panel-subtitle">Ringkasan koneksi saat ini</div>
            </div>
            <span class="badge green">Terhubung</span>
          </div>

          <div class="detail-item"><small>Backend</small><strong>Google Apps Script</strong></div>
          <div class="detail-item"><small>Database</small><strong>Google Sheets — techops-db</strong></div>
          <div class="detail-item"><small>Frontend</small><strong>GitHub Pages — techops-web</strong></div>
          <div class="detail-item"><small>Pengguna</small><strong>${escapeHTML(state.user?.nama || "-")}</strong></div>
          <div class="detail-item"><small>Role</small><strong>${escapeHTML(state.user?.role || "-")}</strong></div>
        </article>
      </section>
    `;

    bindRefresh();
    iconRefresh();
  }

  /* =====================================================
     7. ERROR
  ===================================================== */

  function renderError(error) {
    $("#appContent").innerHTML = `
      <section class="panel error-state">
        <i data-lucide="alert-triangle"></i>
        <h2>Data belum dapat dimuat</h2>
        <p>${escapeHTML(error.message || error)}</p>
        <button class="button button-primary" id="retryButton">Coba lagi</button>
      </section>
    `;

    $("#retryButton")?.addEventListener("click", refreshAndRender);

    iconRefresh();
    setConnection(false, "Koneksi bermasalah");
  }

  function bindRefresh() {
    $("#refreshButton")?.addEventListener("click", refreshAndRender);
  }

  async function refreshAndRender() {
    if (!state.authenticated) return;

    const button = $("#refreshButton");
    if (button) button.disabled = true;

    try {
      await loadAll();
      renderCurrentPage();
      toast("Data berhasil diperbarui.");
    } catch (error) {
      renderError(error);
    }
  }

  /* =====================================================
     8. NAVIGASI
  ===================================================== */

  function renderCurrentPage() {
    if (!state.authenticated) return;

    const page = location.hash.replace("#", "") || "dashboard";

    state.page = pageNames[page] ? page : "dashboard";

    $$(".nav-link").forEach(link => {
      link.classList.toggle(
        "active",
        link.dataset.page === state.page
      );
    });

    $("#pageCrumb").textContent =
      pageNames[state.page] || "Dashboard";

    if (state.page === "computers") {
      window.ComputersPage.render();
    } else if (state.page === "printers") {
      window.PrintersPage.render();
    } else if (state.page === "maintenance") {
      window.MaintenancePage.render();
    } else if (state.page === "qr-info") {
      window.QRInfoPage.render();
    } else {
      renderDashboard();
    }

    closeSidebar();
  }

  function openSidebar() {
    $("#sidebar").classList.add("open");
    $("#sidebarOverlay").classList.add("show");
  }

  function closeSidebar() {
    $("#sidebar").classList.remove("open");
    $("#sidebarOverlay").classList.remove("show");
  }

  /* =====================================================
     9. INISIALISASI
  ===================================================== */

  async function init() {
    $("#currentYear").textContent = new Date().getFullYear();

    $("#menuToggle").addEventListener("click", openSidebar);
    $("#sidebarOverlay").addEventListener("click", closeSidebar);

    window.addEventListener("hashchange", renderCurrentPage);

    try {
      setConnection(false, "Memeriksa sesi...");

      const session = await TechOpsAPI.validateSession();

      if (!session.success || !session.authenticated) {
        renderLogin();
      } else {
        state.user = session.user;
        state.authenticated = true;

        updateUserDisplay();

        await loadAll();
        renderCurrentPage();
      }

    } catch (error) {
      renderLogin(error.message);
    }

    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("./service-worker.js")
        .catch(err => console.warn("PWA service worker:", err));
    }
  }

  /* =====================================================
     10. PUBLIC STATE DAN UI
  ===================================================== */

  window.TechOpsState = state;

  window.TechOpsUI = {
    $,
    $$,
    escapeHTML,
    normalizeArray,
    toast,
    pageHeading,
    bindRefresh,
    iconRefresh,
    refreshAndRender
  };

  document.addEventListener("DOMContentLoaded", init);

})();
