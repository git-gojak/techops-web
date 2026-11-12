/* GoJak TechOps — Dashboard. Read-only, uses data already loaded by app.js. */
(function () {
  "use strict";

  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\'": "&#39;"
  }[c]));

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value)) return value;
    const s = String(value).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function yearOf(value) {
    if (value == null || value === "") return null;
    const direct = String(value).trim().match(/^(19|20)\d{2}$/);
    if (direct) return Number(direct[0]);
    const d = parseDate(value);
    return d ? d.getFullYear() : null;
  }

  function fmtDate(value) {
    const d = parseDate(value);
    return d ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(d) : "Tanggal tidak tersedia";
  }

  function panel(title, subtitle, icon, body, extraClass = "") {
    return `<article class="panel dash-panel ${extraClass}">
      <div class="panel-header"><div><h2>${title}</h2><div class="panel-subtitle">${subtitle}</div></div><span class="dash-panel-icon"><i data-lucide="${icon}"></i></span></div>
      ${body}</article>`;
  }

  function empty(text) { return `<div class="dash-empty">${esc(text)}</div>`; }

  function render(host, state) {
    const computers = Array.isArray(state.computers) ? state.computers : [];
    const printers = Array.isArray(state.printers) ? state.printers : [];
    const maintenance = Array.isArray(state.maintenance) ? state.maintenance : [];
    const now = new Date();
    const year = now.getFullYear();
    const activeComputers = computers.filter(x => String(x.status || "").toLowerCase() !== "arsip");
    const activePrinters = printers.filter(x => String(x.status || "").toLowerCase() !== "arsip");

    // Rekap unit komputer dari prefix pengguna (KODE-NAMA); printer dari kolom unit.
    const units = new Map();
    function addUnit(raw, type) {
      const rawLabel = String(raw || "").trim();
      if (!rawLabel) return;
      // Pengguna komputer menggunakan pola KODE-NAMA; kelompokkan berdasarkan kode unit.
      // Komputer: ambil hanya kode unit sebelum tanda "-" pada kolom pengguna.
      // Contoh: "baa-labib", "bau-aris", "bikma-dayat" menjadi BAA, BAU, BIKMA.
      const label = type === "computers" && rawLabel.includes("-")
        ? rawLabel.split("-")[0].trim().toLocaleUpperCase("id-ID")
        : rawLabel.trim().toLocaleUpperCase("id-ID");
      const key = label;
      if (!units.has(key)) units.set(key, { label, computers: 0, printers: 0 });
      units.get(key)[type]++;
    }
    activeComputers.forEach(row => addUnit(row.pengguna, "computers"));
    activePrinters.forEach(row => addUnit(row.unit, "printers"));
    const unitRows = [...units.values()].sort((a,b) => a.label.localeCompare(b.label, "id"));

    const acquiredComputers = activeComputers.filter(x => yearOf(x.tahun) === year).length;
    const acquiredPrinters = activePrinters.filter(x => yearOf(x.ftp) === year).length;

    const datedMaintenance = maintenance.map(row => ({ ...row, _date: parseDate(row.Tanggal) }))
      .sort((a,b) => (b._date?.getTime() || 0) - (a._date?.getTime() || 0));
    const latestByDevice = new Map();
    datedMaintenance.forEach(row => {
      const key = `${String(row.jenis_aset || "").toLowerCase()}|${String(row.serial || row.nama_aset || "").toUpperCase()}`;
      if (!latestByDevice.has(key)) latestByDevice.set(key, row);
    });
    const conditionCounts = { "Baik": 0, "Perlu Perhatian": 0, "Rusak": 0 };
    latestByDevice.forEach(row => {
      const condition = String(row.kondisi || "").trim().toLowerCase();
      if (condition === "baik") conditionCounts.Baik++;
      else if (condition === "perlu perhatian") conditionCounts["Perlu Perhatian"]++;
      else if (condition === "rusak") conditionCounts.Rusak++;
    });

    const schedules = maintenance.filter(row => String(row.jadwal || "").trim())
      .map(row => ({ ...row, _schedule: parseDate(row.jadwal) }))
      .filter(row => row._schedule)
      .sort((a,b) => a._schedule - b._schedule);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const overdue = schedules.filter(row => row._schedule < today).length;
    const upcoming = schedules.filter(row => row._schedule >= today && row._schedule <= new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30)).length;

    const unitHtml = unitRows.length ? `<div class="dash-unit-list">${unitRows.map(unit => `
      <div class="dash-unit-row"><div class="dash-unit-name">${esc(unit.label)}</div><div class="dash-unit-counts"><span class="dash-count computer"><i data-lucide="monitor"></i>${unit.computers}</span><span class="dash-count printer"><i data-lucide="printer"></i>${unit.printers}</span></div></div>`).join("")}</div>` : empty("Belum ada data unit.");

    const recentHtml = datedMaintenance.length ? `<div class="dash-activity-list">${datedMaintenance.slice(0,6).map(row => `
      <div class="dash-activity-row"><span class="dash-activity-mark"><i data-lucide="wrench"></i></span><div class="dash-activity-copy"><strong>${esc(row.nama_aset || row.serial || "Perangkat")}</strong><small>${esc(row.kegiatan || "Maintenance")} · ${esc(row.kondisi || "Kondisi belum diisi")}</small></div><time>${esc(fmtDate(row.Tanggal))}</time></div>`).join("")}</div>` : empty("Belum ada aktivitas maintenance.");

    const conditionHtml = `<div class="dash-condition-list">
      <div><span class="condition-dot good"></span><span>Baik</span><strong>${conditionCounts.Baik}</strong></div>
      <div><span class="condition-dot attention"></span><span>Perlu Perhatian</span><strong>${conditionCounts["Perlu Perhatian"]}</strong></div>
      <div><span class="condition-dot bad"></span><span>Rusak</span><strong>${conditionCounts.Rusak}</strong></div>
      <small>Merujuk kondisi terakhir tiap perangkat yang memiliki riwayat maintenance.</small>
    </div>`;

    const scheduleHtml = `<div class="dash-schedule-summary"><div class="schedule-number overdue"><strong>${overdue}</strong><span>Terlambat</span></div><div class="schedule-number upcoming"><strong>${upcoming}</strong><span>30 hari ke depan</span></div></div>
      ${schedules.length ? `<div class="dash-schedule-next"><small>Jadwal terdekat</small><strong>${esc(schedules[0].nama_aset || schedules[0].serial || "Perangkat")}</strong><span>${esc(fmtDate(schedules[0].jadwal))}</span></div>` : empty("Belum ada jadwal maintenance.")}`;

    const quickHtml = `<div class="quick-links">
      <a class="quick-link" href="#computers"><span class="stat-icon blue"><i data-lucide="monitor"></i></span><span><strong>Inventaris Komputer</strong><small>Lihat data komputer</small></span></a>
      <a class="quick-link" href="#printers"><span class="stat-icon teal"><i data-lucide="printer"></i></span><span><strong>Inventaris Printer</strong><small>Lihat data printer</small></span></a>
      <a class="quick-link" href="#maintenance"><span class="stat-icon amber"><i data-lucide="wrench"></i></span><span><strong>Maintenance</strong><small>Riwayat dan jadwal</small></span></a>
      <a class="quick-link" href="#qr-info"><span class="stat-icon green"><i data-lucide="qr-code"></i></span><span><strong>QR Info</strong><small>Cari perangkat via QR</small></span></a>
    </div>`;

    host.innerHTML = `
      <section class="page-heading"><div><p class="eyebrow">OVERVIEW</p><h1>Dashboard</h1><p class="muted">Ringkasan inventaris dan operasional perangkat IT.</p></div><button class="button button-secondary" id="refreshButton"><i data-lucide="refresh-cw"></i> Perbarui data</button></section>
      <section class="stats-grid">
        <article class="stat-card"><div><div class="stat-label">Total Komputer</div><div class="stat-value">${activeComputers.length}</div><div class="stat-note">Perangkat terdaftar aktif</div></div><span class="stat-icon blue"><i data-lucide="monitor"></i></span></article>
        <article class="stat-card"><div><div class="stat-label">Total Printer</div><div class="stat-value">${activePrinters.length}</div><div class="stat-note">Perangkat terdaftar aktif</div></div><span class="stat-icon teal"><i data-lucide="printer"></i></span></article>
        <article class="stat-card"><div><div class="stat-label">Riwayat Maintenance</div><div class="stat-value">${maintenance.length}</div><div class="stat-note">Catatan perawatan/perbaikan</div></div><span class="stat-icon amber"><i data-lucide="wrench"></i></span></article>
        <article class="stat-card"><div><div class="stat-label">Koneksi Backend</div><div class="stat-value dash-online">Online</div><div class="stat-note">Apps Script dapat diakses</div></div><span class="stat-icon green"><i data-lucide="activity"></i></span></article>
      </section>
      <section class="dash-content-grid">
        ${panel("Monitoring Perangkat per Unit", "Jumlah komputer dan printer pada setiap unit", "building-2", unitHtml, "unit-panel")}
        ${panel(`Perolehan Perangkat ${year}`, "Berdasarkan tahun perolehan komputer dan tanggal FTP printer", "calendar-days", `<div class="dash-acquisition"><div><span class="stat-icon blue"><i data-lucide="monitor"></i></span><strong>${acquiredComputers}</strong><small>Komputer</small></div><div><span class="stat-icon teal"><i data-lucide="printer"></i></span><strong>${acquiredPrinters}</strong><small>Printer</small></div></div>`, "acquisition-panel")}
        ${panel("Monitoring Jadwal Maintenance", "Jadwal dari catatan maintenance", "calendar-clock", scheduleHtml, "schedule-panel")}
        ${panel("Ringkasan Kondisi Perangkat", "Kondisi terbaru berdasarkan riwayat tiap perangkat", "heart-pulse", conditionHtml, "condition-panel")}
        ${panel("Aktivitas Maintenance Terbaru", "Enam catatan maintenance terakhir", "history", recentHtml, "activity-panel")}
        ${panel("Akses Cepat", "Pintasan menuju modul GoJak TechOps", "grid-2x2", quickHtml, "quick-panel")}
      </section>
      <div class="dash-footer-note">Data diperbarui saat Dashboard dimuat atau tombol <strong>Perbarui data</strong> digunakan. Terakhir dimuat: ${esc(new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(now))}.</div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  window.DashboardPage = { render };
})();
