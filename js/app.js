
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

  function pinInputStyle() {
    return `
      width:100%;
      padding:13px;
      border:1px solid #d1d5db;
      border-radius:9px;
      box-sizing:border-box;
      font-size:20px;
      letter-spacing:8px;
      text-align:center;
    `;
  }

  function showModalMessage(selector, message) {
    const box = $(selector);
    if (!box) return;

    box.textContent = message || "";
    box.style.display = message ? "block" : "none";
  }

  /* =====================================================
     1. INFORMASI ADMIN DAN TOMBOL LOGIN
  ===================================================== */

  function updateUserDisplay() {
    const actions = $(".topbar-actions");
    if (!actions) return;

    let userInfo = $("#techOpsUserInfo");
    let loginButton = $("#techOpsLoginButton");
    let logoutButton = $("#techOpsLogout");
    let changePinButton = $("#techOpsChangePin");

    if (!state.authenticated || !state.user) {
      userInfo?.remove();
      logoutButton?.remove();
      changePinButton?.remove();

      if (!loginButton) {
        loginButton = document.createElement("button");
        loginButton.id = "techOpsLoginButton";
        loginButton.type = "button";
        loginButton.className = "button button-primary";
        loginButton.textContent = "Login Admin";
        loginButton.style.cssText =
          "margin-left:8px;padding:8px 12px;font-size:12px;";

        actions.appendChild(loginButton);
        loginButton.addEventListener("click", () => renderLogin());
      }

      return;
    }

    loginButton?.remove();

    if (!userInfo) {
      userInfo = document.createElement("div");
      userInfo.id = "techOpsUserInfo";
      userInfo.style.cssText =
        "display:flex;flex-direction:column;align-items:flex-end;margin:0 10px;";

      actions.insertBefore(userInfo, $(".avatar"));
    }

    userInfo.innerHTML = `
      <strong style="font-size:12px">
        ${escapeHTML(state.user.nama || "Admin")}
      </strong>
      <small style="font-size:10px;color:#64748b">
        Admin
      </small>
    `;

    if (!changePinButton) {
      changePinButton = document.createElement("button");
      changePinButton.id = "techOpsChangePin";
      changePinButton.type = "button";
      changePinButton.className = "button button-secondary";
      changePinButton.textContent = "Ganti PIN";
      changePinButton.style.cssText =
        "margin-left:8px;padding:8px 12px;font-size:12px;";

      actions.appendChild(changePinButton);
      changePinButton.addEventListener("click", renderChangePin);
    }

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
     2. POPUP LOGIN ADMIN - PIN 6 DIGIT
  ===================================================== */

  function renderLogin(message = "") {
    let modal = $("#techOpsLoginModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "techOpsLoginModal";

      modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:9999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(15,23,42,.55);
      `;

      modal.innerHTML = `
        <div class="panel" style="
          width:100%;
          max-width:420px;
          padding:30px;
          border-radius:16px;
          position:relative;
        ">
          <button type="button" id="closeTechOpsLogin"
            style="
              position:absolute;right:16px;top:12px;
              border:0;background:transparent;
              font-size:24px;cursor:pointer;color:#64748b;
            " aria-label="Tutup">&times;</button>

          <div style="text-align:center;margin-bottom:25px">
            <div style="
              width:58px;height:58px;
              margin:0 auto 15px;
              display:flex;align-items:center;justify-content:center;
              background:#eff6ff;border-radius:16px;color:#2563eb;
            ">
              <i data-lucide="shield-check"
                style="width:30px;height:30px"></i>
            </div>

            <h2 style="font-size:23px;margin-bottom:7px">
              Login Admin
            </h2>

            <p class="muted">
              Masukkan PIN Admin untuk mengelola data.
            </p>
          </div>

          <form id="techOpsLoginForm">
            <div style="margin-bottom:20px">
              <label for="loginPin" style="
                display:block;font-size:13px;
                font-weight:600;margin-bottom:9px;
                text-align:center;
              ">PIN Admin</label>

              <input id="loginPin" name="pin"
                type="password"
                inputmode="numeric"
                pattern="[0-9]{6}"
                maxlength="6"
                minlength="6"
                autocomplete="off"
                required
                placeholder="••••••"
                style="${pinInputStyle()}">
            </div>

            <p id="loginError" style="
              display:none;color:#dc2626;
              font-size:13px;margin-bottom:15px;
            "></p>

            <button type="submit" id="loginSubmit"
              class="button button-primary"
              style="width:100%;justify-content:center;padding:12px">
              Masuk
            </button>
          </form>

          <p style="
            text-align:center;font-size:11px;
            color:#94a3b8;margin-top:22px;
          ">
            GoJak TechOps — IT Operations
          </p>
        </div>
      `;

      document.body.appendChild(modal);

      $("#techOpsLoginForm").addEventListener("submit", handleLogin);

      $("#closeTechOpsLogin").addEventListener("click", () => {
        modal.remove();
      });

      modal.addEventListener("click", event => {
        if (event.target === modal) modal.remove();
      });
    }

    showModalMessage("#loginError", message);
    iconRefresh();

    $("#loginPin")?.focus();
  }

  /* =====================================================
     3. PROSES LOGIN ADMIN
  ===================================================== */

  async function handleLogin(event) {
    event.preventDefault();

    const pin = $("#loginPin").value;
    const button = $("#loginSubmit");
    const errorBox = $("#loginError");

    button.disabled = true;
    button.textContent = "Memeriksa PIN...";
    errorBox.style.display = "none";

    try {
      const result = await TechOpsAPI.login(pin);

      if (!result || !result.success || !result.sessionId) {
        throw new Error("Login gagal. Periksa PIN Admin.");
      }

      state.user = result.user || TechOpsAPI.getUser() || {
        nama: "Admin",
        role: "Admin"
      };

      state.authenticated = true;

      updateUserDisplay();
      $("#techOpsLoginModal")?.remove();

      await loadAll();
      renderCurrentPage();

      toast("Login Admin berhasil.");

    } catch (error) {
      errorBox.textContent = error.message || "Login gagal.";
      errorBox.style.display = "block";

      button.disabled = false;
      button.textContent = "Masuk";

      $("#loginPin").value = "";
      $("#loginPin").focus();
    }
  }

  /* =====================================================
     4. POPUP GANTI PIN ADMIN
  ===================================================== */

  function renderChangePin(message = "") {
    if (!state.authenticated) {
      toast("Silakan login sebagai Admin terlebih dahulu.");
      return;
    }

    let modal = $("#techOpsChangePinModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "techOpsChangePinModal";

      modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:10000;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(15,23,42,.55);
      `;

      modal.innerHTML = `
        <div class="panel" style="
          width:100%;
          max-width:440px;
          padding:28px;
          border-radius:16px;
          position:relative;
        ">
          <button type="button" id="closeTechOpsChangePin"
            style="
              position:absolute;right:16px;top:12px;
              border:0;background:transparent;
              font-size:24px;cursor:pointer;color:#64748b;
            " aria-label="Tutup">&times;</button>

          <div style="text-align:center;margin-bottom:22px">
            <div style="
              width:54px;height:54px;
              margin:0 auto 14px;
              display:flex;align-items:center;justify-content:center;
              background:#eff6ff;border-radius:16px;color:#2563eb;
            ">
              <i data-lucide="key-round"
                style="width:27px;height:27px"></i>
            </div>

            <h2 style="font-size:22px;margin-bottom:7px">
              Ganti PIN Admin
            </h2>

            <p class="muted">
              Masukkan PIN lama dan tentukan PIN baru.
            </p>
          </div>

          <form id="techOpsChangePinForm">

            <div style="margin-bottom:15px">
              <label for="oldAdminPin" style="
                display:block;font-size:13px;
                font-weight:600;margin-bottom:7px;
              ">PIN Lama</label>

              <input id="oldAdminPin" type="password"
                inputmode="numeric" pattern="[0-9]{6}"
                maxlength="6" minlength="6"
                autocomplete="off" required
                placeholder="6 digit PIN lama"
                style="${pinInputStyle()}">
            </div>

            <div style="margin-bottom:15px">
              <label for="newAdminPin" style="
                display:block;font-size:13px;
                font-weight:600;margin-bottom:7px;
              ">PIN Baru</label>

              <input id="newAdminPin" type="password"
                inputmode="numeric" pattern="[0-9]{6}"
                maxlength="6" minlength="6"
                autocomplete="off" required
                placeholder="6 digit PIN baru"
                style="${pinInputStyle()}">
            </div>

            <div style="margin-bottom:19px">
              <label for="confirmAdminPin" style="
                display:block;font-size:13px;
                font-weight:600;margin-bottom:7px;
              ">Konfirmasi PIN Baru</label>

              <input id="confirmAdminPin" type="password"
                inputmode="numeric" pattern="[0-9]{6}"
                maxlength="6" minlength="6"
                autocomplete="off" required
                placeholder="Ulangi PIN baru"
                style="${pinInputStyle()}">
            </div>

            <p id="changePinError" style="
              display:none;color:#dc2626;
              font-size:13px;margin-bottom:15px;
            "></p>

            <button type="submit" id="changePinSubmit"
              class="button button-primary"
              style="width:100%;justify-content:center;padding:12px">
              Simpan PIN Baru
            </button>
          </form>

          <p style="
            text-align:center;font-size:11px;
            color:#94a3b8;margin-top:18px;
          ">
            Setelah PIN diganti, Anda harus login kembali.
          </p>
        </div>
      `;

      document.body.appendChild(modal);

      $("#techOpsChangePinForm").addEventListener(
        "submit",
        handleChangePin
      );

      $("#closeTechOpsChangePin").addEventListener("click", () => {
        modal.remove();
      });

      modal.addEventListener("click", event => {
        if (event.target === modal) modal.remove();
      });
    }

    showModalMessage("#changePinError", message);
    iconRefresh();

    $("#oldAdminPin")?.focus();
  }

  /* =====================================================
     5. PROSES GANTI PIN ADMIN
  ===================================================== */

  async function handleChangePin(event) {
    event.preventDefault();

    const oldPin = $("#oldAdminPin").value;
    const newPin = $("#newAdminPin").value;
    const confirmPin = $("#confirmAdminPin").value;

    const button = $("#changePinSubmit");
    const errorBox = $("#changePinError");

    errorBox.style.display = "none";

    if (!/^[0-9]{6}$/.test(oldPin)) {
      showModalMessage("#changePinError", "PIN lama harus 6 digit angka.");
      return;
    }

    if (!/^[0-9]{6}$/.test(newPin)) {
      showModalMessage("#changePinError", "PIN baru harus 6 digit angka.");
      return;
    }

    if (newPin !== confirmPin) {
      showModalMessage(
        "#changePinError",
        "Konfirmasi PIN baru tidak cocok."
      );
      $("#confirmAdminPin").value = "";
      $("#confirmAdminPin").focus();
      return;
    }

    if (oldPin === newPin) {
      showModalMessage(
        "#changePinError",
        "PIN baru harus berbeda dari PIN lama."
      );
      return;
    }

    button.disabled = true;
    button.textContent = "Menyimpan PIN...";

    try {
      const result = await TechOpsAPI.changePin(oldPin, newPin);

      if (result && result.success === false) {
        throw new Error(result.message || "Gagal mengganti PIN.");
      }

      state.user = null;
      state.authenticated = false;

      $("#techOpsChangePinModal")?.remove();

      updateUserDisplay();

      renderCurrentPage();

      toast("PIN berhasil diganti. Silakan login kembali.");

    } catch (error) {
      showModalMessage(
        "#changePinError",
        error.message || "Gagal mengganti PIN."
      );

      button.disabled = false;
      button.textContent = "Simpan PIN Baru";

      $("#oldAdminPin").value = "";
      $("#oldAdminPin").focus();
    }
  }

  /* =====================================================
     6. LOGOUT ADMIN
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

      state.user = null;
      state.authenticated = false;

      updateUserDisplay();

      await loadAll();
      renderCurrentPage();

      toast("Logout berhasil. Mode pengunjung aktif.");

    } catch (error) {
      toast("Logout gagal: " + error.message);

      if (button) {
        button.disabled = false;
        button.textContent = "Keluar";
      }
    }
  }

  /* =====================================================
     7. MEMUAT DATA PUBLIK
  ===================================================== */

  async function loadAll() {
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
     8. KOMPONEN TAMPILAN
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
     9. DASHBOARD
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
        ${statCard("Total Komputer", state.computers.length,
          "monitor", "blue", "Data inventaris komputer")}

        ${statCard("Total Printer", state.printers.length,
          "printer", "teal", "Data inventaris printer")}

        ${statCard("Riwayat Maintenance", state.maintenance.length,
          "wrench", "amber", "Catatan perawatan/perbaikan")}

        ${statCard("Koneksi Backend", "Online",
          "activity", "green", "Apps Script dapat diakses")}
      </section>

      <section class="dashboard-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2>Akses Cepat</h2>
              <div class="panel-subtitle">
                Pilih modul yang ingin dibuka
              </div>
            </div>
          </div>

          <div class="quick-links">
            <a class="quick-link" href="#computers">
              <span class="stat-icon blue">
                <i data-lucide="monitor"></i>
              </span>
              <span>
                <strong>Inventaris Komputer</strong>
                <small>Lihat daftar dan spesifikasi</small>
              </span>
            </a>

            <a class="quick-link" href="#printers">
              <span class="stat-icon teal">
                <i data-lucide="printer"></i>
              </span>
              <span>
                <strong>Inventaris Printer</strong>
                <small>Lihat data perangkat printer</small>
              </span>
            </a>

            <a class="quick-link" href="#maintenance">
              <span class="stat-icon amber">
                <i data-lucide="wrench"></i>
              </span>
              <span>
                <strong>Maintenance</strong>
                <small>Lihat riwayat perawatan</small>
              </span>
            </a>

            <a class="quick-link" href="#qr-info">
              <span class="stat-icon green">
                <i data-lucide="qr-code"></i>
              </span>
              <span>
                <strong>QR Info</strong>
                <small>Cari perangkat dari serial/QR</small>
              </span>
            </a>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2>Status Sistem</h2>
              <div class="panel-subtitle">
                Ringkasan koneksi saat ini
              </div>
            </div>

            <span class="badge green">Terhubung</span>
          </div>

          <div class="detail-item">
            <small>Backend</small>
            <strong>Google Apps Script</strong>
          </div>

          <div class="detail-item">
            <small>Database</small>
            <strong>Google Sheets — techops-db</strong>
          </div>

          <div class="detail-item">
            <small>Frontend</small>
            <strong>GitHub Pages — techops-web</strong>
          </div>

          <div class="detail-item">
            <small>Pengguna</small>
            <strong>${escapeHTML(state.user?.nama || "Pengunjung")}</strong>
          </div>

          <div class="detail-item">
            <small>Akses</small>
            <strong>${state.authenticated ? "Admin" : "Publik (Lihat saja)"}</strong>
          </div>
        </article>
      </section>
    `;

    bindRefresh();
    iconRefresh();
  }

  /* =====================================================
     10. ERROR
  ===================================================== */

  function renderError(error) {
    $("#appContent").innerHTML = `
      <section class="panel error-state">
        <i data-lucide="alert-triangle"></i>
        <h2>Data belum dapat dimuat</h2>
        <p>${escapeHTML(error.message || error)}</p>
        <button class="button button-primary" id="retryButton">
          Coba lagi
        </button>
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
     SIDEBAR MOBILE
  ===================================================== */

  function openSidebar() {
    const sidebar = $("#sidebar");
    const overlay = $("#sidebarOverlay");

    sidebar?.classList.add("active");
    overlay?.classList.add("active");

    document.body.classList.add("sidebar-open");
  }

  function closeSidebar() {
    const sidebar = $("#sidebar");
    const overlay = $("#sidebarOverlay");

    sidebar?.classList.remove("active");
    overlay?.classList.remove("active");

    document.body.classList.remove("sidebar-open");
  }
  /* =====================================================
     11. NAVIGASI
  ===================================================== */

  function renderCurrentPage() {
  const page = location.hash.replace("#", "") || "dashboard";

  // Simpan kode halaman, bukan nama tampilannya.
  state.page = pageNames[page] ? page : "dashboard";

  $$(".nav-link").forEach(link => {
    link.classList.toggle(
      "active",
      link.dataset.page === state.page
    );
  });

  const breadcrumb = $("#pageCrumb");
  if (breadcrumb) {
    breadcrumb.textContent =
      pageNames[state.page] || "Dashboard";
  }

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

  /* =====================================================
     12. INISIALISASI
  ===================================================== */

  async function init() {
    const year = $("#currentYear");
    if (year) year.textContent = new Date().getFullYear();

    $("#menuToggle")?.addEventListener("click", openSidebar);
    $("#sidebarOverlay")?.addEventListener("click", closeSidebar);

    window.addEventListener("hashchange", renderCurrentPage);

    updateUserDisplay();

    try {
      setConnection(false, "Memeriksa sesi...");

      const sessionValid = await TechOpsAPI.validateSession();

      if (sessionValid === true) {
        state.user = TechOpsAPI.getUser() || {
          nama: "Admin",
          role: "Admin"
        };

        state.authenticated = true;

      } else {
        state.user = null;
        state.authenticated = false;
      }

    } catch (error) {
      console.warn("Pemeriksaan sesi Admin:", error);
      state.user = null;
      state.authenticated = false;
    }

    updateUserDisplay();

    try {
      await loadAll();
      renderCurrentPage();
    } catch (error) {
      renderError(error);
    }

    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("./service-worker.js")
        .catch(err => console.warn("PWA service worker:", err));
    }
  }

  /* =====================================================
     13. PUBLIC STATE DAN UI
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
