(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { computers: [], printers: [], maintenance: [], loaded: false, page: "dashboard" };

  const pageNames = {
    dashboard: "Dashboard", computers: "Inventaris Komputer",
    printers: "Inventaris Printer", maintenance: "Maintenance", "qr-info": "QR Info"
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && payload.success === false) throw new Error(payload.message || "Permintaan API gagal.");
    return [];
  }

  function toast(message) {
    const region = $("#toastRegion");
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

  function pageHeading(title, subtitle, eyebrow = "GOJAK TECHOPS") {
    return `<section class="page-heading"><div><p class="eyebrow">${escapeHTML(eyebrow)}</p><h1>${escapeHTML(title)}</h1><p class="muted">${escapeHTML(subtitle)}</p></div><button class="button button-secondary" id="refreshButton"><i data-lucide="refresh-cw"></i> Perbarui data</button></section>`;
  }

  function statCard(label, value, icon, color, note) {
    return `<article class="stat-card"><div><div class="stat-label">${escapeHTML(label)}</div><div class="stat-value">${escapeHTML(value)}</div><div class="stat-note">${escapeHTML(note)}</div></div><span class="stat-icon ${color}"><i data-lucide="${icon}"></i></span></article>`;
  }

  function renderDashboard() {
    const host = $("#appContent");
    host.innerHTML = pageHeading("Dashboard", "Ringkasan inventaris dan operasional perangkat IT.", "OVERVIEW") +
      `<section class="stats-grid">
        ${statCard("Total Komputer", state.computers.length, "monitor", "blue", "Data inventaris komputer")}
        ${statCard("Total Printer", state.printers.length, "printer", "teal", "Data inventaris printer")}
        ${statCard("Riwayat Maintenance", state.maintenance.length, "wrench", "amber", "Catatan perawatan/perbaikan")}
        ${statCard("Koneksi Backend", "Online", "activity", "green", "Apps Script dapat diakses")}
      </section>
      <section class="dashboard-grid">
        <article class="panel"><div class="panel-header"><div><h2>Akses Cepat</h2><div class="panel-subtitle">Pilih modul yang ingin dibuka</div></div></div>
          <div class="quick-links">
            <a class="quick-link" href="#computers"><span class="stat-icon blue"><i data-lucide="monitor"></i></span><span><strong>Inventaris Komputer</strong><small>Lihat daftar dan spesifikasi</small></span></a>
            <a class="quick-link" href="#printers"><span class="stat-icon teal"><i data-lucide="printer"></i></span><span><strong>Inventaris Printer</strong><small>Lihat data perangkat printer</small></span></a>
            <a class="quick-link" href="#maintenance"><span class="stat-icon amber"><i data-lucide="wrench"></i></span><span><strong>Maintenance</strong><small>Lihat riwayat perawatan</small></span></a>
            <a class="quick-link" href="#qr-info"><span class="stat-icon green"><i data-lucide="qr-code"></i></span><span><strong>QR Info</strong><small>Cari perangkat dari serial/QR</small></span></a>
          </div>
        </article>
        <article class="panel"><div class="panel-header"><div><h2>Status Sistem</h2><div class="panel-subtitle">Ringkasan koneksi saat ini</div></div><span class="badge green">Terhubung</span></div>
          <div class="detail-item"><small>Backend</small><strong>Google Apps Script</strong></div>
          <div class="detail-item"><small>Database</small><strong>Google Sheets — techops-db</strong></div>
          <div class="detail-item"><small>Frontend</small><strong>GitHub Pages — techops-web</strong></div>
          <div class="detail-item"><small>Mode akses</small><strong>Baca saja sementara login ditunda</strong></div>
        </article>
      </section>`;
    bindRefresh();
    iconRefresh();
  }

  function renderError(error) {
    $("#appContent").innerHTML = `<section class="panel error-state"><i data-lucide="alert-triangle"></i><h2>Data belum dapat dimuat</h2><p>${escapeHTML(error.message || error)}</p><button class="button button-primary" id="retryButton">Coba lagi</button></section>`;
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

  function renderCurrentPage() {
    const page = location.hash.replace("#", "") || "dashboard";
    state.page = pageNames[page] ? page : "dashboard";
    $$(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.page === state.page));
    $("#pageCrumb").textContent = pageNames[page] || "Dashboard";
    if (page === "computers") window.ComputersPage.render();
    else if (page === "printers") window.PrintersPage.render();
    else if (page === "maintenance") window.MaintenancePage.render();
    else if (page === "qr-info") window.QRInfoPage.render();
    else renderDashboard();
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

  async function init() {
    $("#currentYear").textContent = new Date().getFullYear();
    $("#menuToggle").addEventListener("click", openSidebar);
    $("#sidebarOverlay").addEventListener("click", closeSidebar);
    window.addEventListener("hashchange", renderCurrentPage);
    try {
      await loadAll();
      renderCurrentPage();
    } catch (error) {
      renderError(error);
    }
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("./service-worker.js").catch(err => console.warn("PWA service worker:", err));
    }
  }

  window.TechOpsState = state;
  window.TechOpsUI = { $, $$, escapeHTML, normalizeArray, toast, pageHeading, bindRefresh, iconRefresh, refreshAndRender };
  document.addEventListener("DOMContentLoaded", init);
})();
