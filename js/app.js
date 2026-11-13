
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
    authChecking: true,
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
     1. AKSES LOGIN DAN PROFIL ADMIN MELALUI AVATAR GT
  ===================================================== */

  function getAdminInitials(user) {
    const name = String(
      user?.nama || user?.name || user?.username || "Admin"
    ).trim();

    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    return name.slice(0, 2).toUpperCase() || "AD";
  }

  function closeProfileMenu() {
    $("#techOpsProfileMenu")?.remove();
  }

  function renderAdminProfile() {
    closeProfileMenu();

    const user = state.user || {};

    const details = [
      ["Nama", user.nama || user.name],
      ["Username", user.username || user.userName],
      ["Email", user.email],
      ["Role", user.role || "Admin"]
    ].filter(([, value]) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    );

    const modal = document.createElement("div");
    modal.id = "techOpsProfileModal";

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:10001;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      background:rgba(15,23,42,.55);
    `;

    modal.innerHTML = `
      <section class="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="techOpsProfileTitle"
        style="width:100%;max-width:420px;padding:26px;border-radius:16px;position:relative">

        <button type="button"
          id="closeTechOpsProfile"
          aria-label="Tutup"
          style="position:absolute;right:14px;top:10px;border:0;background:transparent;font-size:24px;cursor:pointer;color:#64748b">
          &times;
        </button>

        <div style="width:54px;height:54px;margin:0 auto 14px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#eff6ff;color:#2563eb;font-weight:700;font-size:18px">
          ${escapeHTML(getAdminInitials(user))}
        </div>

        <h2 id="techOpsProfileTitle"
          style="text-align:center;font-size:21px;margin-bottom:5px">
          Profil Admin
        </h2>

        <p class="muted"
          style="text-align:center;margin-bottom:20px">
          Informasi akun yang sedang digunakan
        </p>

        <div style="display:grid;gap:12px">
          ${details.map(([label, value]) => `
            <div style="padding:11px 12px;border:1px solid #e2e8f0;border-radius:9px">
              <div style="font-size:11px;color:#64748b;margin-bottom:4px">
                ${escapeHTML(label)}
              </div>
              <div style="font-size:14px;font-weight:600;overflow-wrap:anywhere">
                ${escapeHTML(value)}
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `;

    document.body.appendChild(modal);

    $("#closeTechOpsProfile")?.addEventListener("click", () => {
      modal.remove();
    });

    modal.addEventListener("click", event => {
      if (event.target === modal) modal.remove();
    });
  }

  function toggleProfileMenu() {
    if ($("#techOpsProfileMenu")) {
      closeProfileMenu();
      return;
    }

    const avatar = $(".avatar");
    if (!avatar) return;

    const rect = avatar.getBoundingClientRect();

    const menu = document.createElement("div");
    menu.id = "techOpsProfileMenu";
    menu.setAttribute("role", "menu");

    menu.style.cssText = `
      position:fixed;
      z-index:10002;
      top:${Math.min(rect.bottom + 9, window.innerHeight - 170)}px;
      right:${Math.max(12, window.innerWidth - rect.right)}px;
      width:205px;
      padding:6px;
      background:var(--panel,#fff);
      border:1px solid #e2e8f0;
      border-radius:12px;
      box-shadow:0 12px 32px rgba(15,23,42,.16);
    `;

    const buttonStyle = `
      display:flex;
      width:100%;
      align-items:center;
      gap:10px;
      padding:11px 12px;
      border:0;
      border-radius:8px;
      background:transparent;
      text-align:left;
      font:inherit;
      font-size:13px;
      color:inherit;
      cursor:pointer;
    `;

    menu.innerHTML = `
      <button type="button"
        role="menuitem"
        data-profile-action="profile"
        style="${buttonStyle}">
        <i data-lucide="user-round" style="width:16px;height:16px"></i>
        Profil Admin
      </button>

      <button type="button"
        role="menuitem"
        data-profile-action="pin"
        style="${buttonStyle}">
        <i data-lucide="key-round" style="width:16px;height:16px"></i>
        Ganti PIN
      </button>

      <div style="height:1px;background:#e2e8f0;margin:5px 3px"></div>

      <button type="button"
        role="menuitem"
        data-profile-action="logout"
        style="${buttonStyle}color:#dc2626">
        <i data-lucide="log-out" style="width:16px;height:16px"></i>
        Keluar
      </button>
    `;

    document.body.appendChild(menu);
    iconRefresh();

    menu.addEventListener("click", event => {
      const button = event.target.closest("[data-profile-action]");
      if (!button) return;

      const action = button.dataset.profileAction;

      closeProfileMenu();

      if (action === "profile") renderAdminProfile();
      if (action === "pin") renderChangePin();
      if (action === "logout") handleLogout();
    });
  }

  function updateUserDisplay() {
    const avatar = $(".avatar");

    // Hapus tombol akun terpisah dari versi sebelumnya.
    $("#techOpsLoginButton")?.remove();
    $("#techOpsUserInfo")?.remove();
    $("#techOpsLogout")?.remove();
    $("#techOpsChangePin")?.remove();

    if (!avatar) return;

    closeProfileMenu();

    const isAdmin = !!(state.authenticated && state.user);

    avatar.textContent = isAdmin
      ? getAdminInitials(state.user)
      : "GT";

    avatar.setAttribute("role", "button");
    avatar.setAttribute("tabindex", "0");
    avatar.setAttribute("aria-haspopup", isAdmin ? "menu" : "dialog");
    avatar.setAttribute(
      "aria-label",
      isAdmin ? "Menu profil Admin" : "Login Admin"
    );

    avatar.title = isAdmin ? "Profil Admin" : "Login Admin";
    avatar.style.cursor = "pointer";

    if (avatar.dataset.techopsBound !== "true") {

    avatar.addEventListener("click", () => {
      if (state.authChecking) {
        toast("Sedang memeriksa sesi Admin. Silakan tunggu sebentar.");
        return;
      }

      if (state.authenticated && state.user) {
        toggleProfileMenu();
      } else {
        renderLogin();
      }
    });

      avatar.dataset.techopsBound = "true";
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

    closeProfileMenu();

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
    }
  }


  /* =====================================================
     7. MEMUAT DATA PUBLIK
  ===================================================== */

  async function loadAll() {
    setConnection(false, "Mengambil data...");

    if (!window.TechOpsAPI ||
        typeof TechOpsAPI.get !== "function") {
      throw new Error(
        "Penghubung TechOpsAPI belum tersedia. Periksa pemuatan file API."
      );
    }

    const timeout = (promise, label, ms = 20000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(label + " tidak merespons dalam 20 detik.")),
            ms
          );
        })
      ]);
    };

    const [computers, printers, maintenance] = await Promise.all([
      timeout(TechOpsAPI.get("computers.list"), "Inventaris komputer"),
      timeout(TechOpsAPI.get("printers.list"), "Inventaris printer"),
      timeout(TechOpsAPI.get("maintenance.list"), "Data maintenance")
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
    if (window.DashboardPage && typeof window.DashboardPage.render === "function") {
      window.DashboardPage.render(host, state);
    } else {
      host.innerHTML = pageHeading("Dashboard", "Ringkasan inventaris dan operasional perangkat IT.", "OVERVIEW") +
        '<div class="panel error-state">Modul Dashboard belum termuat. Silakan muat ulang halaman.</div>';
    }
    bindRefresh();
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

    sidebar?.classList.add("open");
    overlay?.classList.add("show");

    document.body.classList.add("sidebar-open");
  }

  function closeSidebar() {
    const sidebar = $("#sidebar");
    const overlay = $("#sidebarOverlay");

    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");

    document.body.classList.remove("sidebar-open");
  }

  function toggleSidebar() {
    const sidebar = $("#sidebar");

    if (sidebar?.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
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

    
  $("#menuToggle")?.addEventListener("click", toggleSidebar);
  $("#sidebarOverlay")?.addEventListener("click", closeSidebar);

  // Tutup dropdown ketika klik di luar avatar dan menu.
  document.addEventListener("click", event => {
    const menu = $("#techOpsProfileMenu");
    const avatar = $(".avatar");

    if (
      menu &&
      !menu.contains(event.target) &&
      !avatar?.contains(event.target)
    ) {
      closeProfileMenu();
    }
  });

  // Tombol Escape menutup menu, popup, dan sidebar.
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    closeProfileMenu();

    $("#techOpsProfileModal")?.remove();
    $("#techOpsLoginModal")?.remove();
    $("#techOpsChangePinModal")?.remove();

    closeSidebar();
  });

  window.addEventListener("hashchange", renderCurrentPage);


    // Tampilkan Dashboard langsung.
    updateUserDisplay();
    renderCurrentPage();

    // Validasi Admin berjalan di belakang layar.
    // Tidak menghambat tampilan Dashboard dan pemuatan data.
    (async function restoreAdminSession() {
      try {
        if (!window.TechOpsAPI ||
            typeof TechOpsAPI.validateSession !== "function") {
          throw new Error("TechOpsAPI belum tersedia.");
        }

        const sessionValid = await TechOpsAPI.validateSession();

        if (sessionValid === true) {
          state.user = TechOpsAPI.getUser() || {
            nama: "Admin",
            role: "Admin"
          };

          state.authenticated = true;

          console.log("Sesi Admin berhasil dipulihkan.");

        } else {
          state.user = null;
          state.authenticated = false;

          if (sessionValid === false) {
            console.log("Sesi Admin tidak valid atau telah berakhir.");
          } else {
            console.warn(
              "Validasi sesi belum berhasil. Session ID tetap dipertahankan."
            );
          }
        }

      } catch (error) {
        console.warn("Pemeriksaan sesi Admin:", error);

        state.user = null;
        state.authenticated = false;
      }

        state.authChecking = false;

        // Perbarui tampilan setelah validasi sesi selesai.
        updateUserDisplay();
        renderCurrentPage();
    })();

    // Data publik dimuat tanpa menunggu validasi Admin.
    try {
      await loadAll();
      renderCurrentPage();

    } catch (error) {
      console.error("Gagal memuat data GoJak TechOps:", error);
      renderError(error);
    }

    if ("serviceWorker" in navigator &&
        location.protocol === "https:") {
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
