
/* GoJak TechOps — Dashboard
   Frontend only. Menggunakan data dari app.js.
   Data arsip dihitung melalui API inventory.archiveCounts.
*/
(function () {
  "use strict";

  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
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

    return d
      ? new Intl.DateTimeFormat("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }).format(d)
      : "Tanggal tidak tersedia";
  }

  function fmtDateTime(value) {
    const d = parseDate(value);

    return d
      ? new Intl.DateTimeFormat("id-ID", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(d)
      : "Belum tersedia";
  }

  function panel(title, subtitle, icon, body, extraClass = "") {
    return `
      <article class="panel dash-panel ${extraClass}">
        <div class="panel-header">
          <div>
            <h2>${title}</h2>
            <div class="panel-subtitle">${subtitle}</div>
          </div>
          <span class="dash-panel-icon">
            <i data-lucide="${icon}"></i>
          </span>
        </div>
        ${body}
      </article>
    `;
  }

  function empty(text) {
    return `<div class="dash-empty">${esc(text)}</div>`;
  }

  function render(host, state) {
    const computers = Array.isArray(state.computers)
      ? state.computers : [];

    const printers = Array.isArray(state.printers)
      ? state.printers : [];

    const maintenance = Array.isArray(state.maintenance)
      ? state.maintenance : [];

    const archiveCounts = state.archiveCounts || {};

    const archivedComputerCount =
      Number(archiveCounts.computers || 0);

    const archivedPrinterCount =
      Number(archiveCounts.printers || 0);

    const now = new Date();
    const year = now.getFullYear();

    // ==========================================
    // 1. STATUS INVENTARIS
    // ==========================================

    const isArchived = row =>
      String(row.status || "").trim().toLowerCase() === "arsip";

    const activeComputers = computers.filter(row => !isArchived(row));
    const activePrinters = printers.filter(row => !isArchived(row));

    const acquiredComputers = activeComputers.filter(
      row => yearOf(row.tahun) === year
    ).length;

    const acquiredPrinters = activePrinters.filter(
      row => yearOf(row.ftp) === year
    ).length;

    // ==========================================
    // 2. DATA TERAKHIR DIPERBARUI
    // ==========================================

    const lastUpdated = state.lastUpdated || null;

    // ==========================================
    // 3. MONITORING PERANGKAT PER UNIT
    // ==========================================

    const units = new Map();

    function addUnit(raw, type) {
      const rawLabel = String(raw || "").trim();
      if (!rawLabel) return;

      const label = type === "computers" && rawLabel.includes("-")
        ? rawLabel.split("-")[0].trim().toLocaleUpperCase("id-ID")
        : rawLabel.toLocaleUpperCase("id-ID");

      if (!units.has(label)) {
        units.set(label, {
          label,
          computers: 0,
          printers: 0
        });
      }

      units.get(label)[type]++;
    }

    activeComputers.forEach(row =>
      addUnit(row.pengguna, "computers")
    );

    activePrinters.forEach(row =>
      addUnit(row.unit, "printers")
    );

    const unitRows = [...units.values()].sort(
      (a, b) => a.label.localeCompare(b.label, "id")
    );

    const unitHtml = unitRows.length
      ? `
        <div class="dash-unit-grid">
          ${unitRows.map(unit => `
            <div class="dash-unit-card">
              <strong class="dash-unit-name">
                ${esc(unit.label)}
              </strong>

              <div class="dash-unit-counts">
                <span class="dash-count computer" title="Komputer">
                  <i data-lucide="monitor"></i>
                  <b>${unit.computers}</b>
                </span>

                <span class="dash-count printer" title="Printer">
                  <i data-lucide="printer"></i>
                  <b>${unit.printers}</b>
                </span>
              </div>
            </div>
          `).join("")}
        </div>
      `
      : empty("Belum ada data unit.");

    // ==========================================
    // 4. RIWAYAT MAINTENANCE
    // ==========================================

    const datedMaintenance = maintenance
      .map(row => ({
        ...row,
        _date: parseDate(row.Tanggal)
      }))
      .sort((a, b) =>
        (b._date?.getTime() || 0) -
        (a._date?.getTime() || 0)
      );

    const latestByDevice = new Map();

    datedMaintenance.forEach(row => {
      const key =
        `${String(row.jenis_aset || "").toLowerCase()}|` +
        `${String(row.serial || row.nama_aset || "").toUpperCase()}`;

      if (!latestByDevice.has(key)) {
        latestByDevice.set(key, row);
      }
    });

    const conditionCounts = {
      "Baik": 0,
      "Perlu Perhatian": 0,
      "Rusak": 0
    };

    latestByDevice.forEach(row => {
      const condition = String(row.kondisi || "")
        .trim()
        .toLowerCase();

      if (condition === "baik") {
        conditionCounts.Baik++;
      } else if (condition === "perlu perhatian") {
        conditionCounts["Perlu Perhatian"]++;
      } else if (condition === "rusak") {
        conditionCounts.Rusak++;
      }
    });

    const conditionHtml = `
      <div class="dash-condition-list">
        <div>
          <span class="condition-dot good"></span>
          <span>Baik</span>
          <strong>${conditionCounts.Baik}</strong>
        </div>

        <div>
          <span class="condition-dot attention"></span>
          <span>Perlu Perhatian</span>
          <strong>${conditionCounts["Perlu Perhatian"]}</strong>
        </div>

        <div>
          <span class="condition-dot bad"></span>
          <span>Rusak</span>
          <strong>${conditionCounts.Rusak}</strong>
        </div>

        <small>
          Merujuk kondisi terakhir tiap perangkat yang memiliki
          riwayat maintenance.
        </small>
      </div>
    `;

    // ==========================================
    // 5. JADWAL MAINTENANCE
    // ==========================================

    const schedules = maintenance
      .filter(row => String(row.jadwal || "").trim())
      .map(row => ({
        ...row,
        _schedule: parseDate(row.jadwal)
      }))
      .filter(row => row._schedule)
      .sort((a, b) => a._schedule - b._schedule);

    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const next30Days = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 30
    );

    const overdue = schedules.filter(
      row => row._schedule < today
    ).length;

    const upcoming = schedules.filter(
      row =>
        row._schedule >= today &&
        row._schedule <= next30Days
    ).length;

    const scheduleHtml = `
      <div class="dash-schedule-summary">
        <div class="schedule-number overdue">
          <strong>${overdue}</strong>
          <span>Terlambat</span>
        </div>

        <div class="schedule-number upcoming">
          <strong>${upcoming}</strong>
          <span>30 hari ke depan</span>
        </div>
      </div>

      ${
        schedules.length
          ? `
            <div class="dash-schedule-next">
              <small>Jadwal terdekat</small>
              <strong>
                ${esc(
                  schedules[0].nama_aset ||
                  schedules[0].serial ||
                  "Perangkat"
                )}
              </strong>
              <span>${esc(fmtDate(schedules[0].jadwal))}</span>
            </div>
          `
          : empty("Belum ada jadwal maintenance.")
      }
    `;

    // ==========================================
    // 6. AKTIVITAS MAINTENANCE TERBARU
    // ==========================================

    const recentHtml = datedMaintenance.length
      ? `
        <div class="dash-activity-list">
          ${datedMaintenance.slice(0, 6).map(row => `
            <div class="dash-activity-row">
              <span class="dash-activity-mark">
                <i data-lucide="wrench"></i>
              </span>

              <div class="dash-activity-copy">
                <strong>
                  ${esc(row.nama_aset || row.serial || "Perangkat")}
                </strong>

                <small>
                  ${esc(row.kegiatan || "Maintenance")}
                  ·
                  ${esc(row.kondisi || "Kondisi belum diisi")}
                </small>
              </div>

              <time>${esc(fmtDate(row.Tanggal))}</time>
            </div>
          `).join("")}
        </div>
      `
      : empty("Belum ada aktivitas maintenance.");

    // ==========================================
    // 7. AKSES CEPAT
    // ==========================================

    const quickHtml = `
      <div class="quick-links">
        <a class="quick-link" href="#computers">
          <span class="stat-icon blue">
            <i data-lucide="monitor"></i>
          </span>
          <span>
            <strong>Inventaris Komputer</strong>
            <small>Lihat data komputer</small>
          </span>
          <i class="quick-link-arrow" data-lucide="chevron-right"></i>
        </a>

        <a class="quick-link" href="#printers">
          <span class="stat-icon teal">
            <i data-lucide="printer"></i>
          </span>
          <span>
            <strong>Inventaris Printer</strong>
            <small>Lihat data printer</small>
          </span>
          <i class="quick-link-arrow" data-lucide="chevron-right"></i>
        </a>

        <a class="quick-link" href="#maintenance">
          <span class="stat-icon amber">
            <i data-lucide="wrench"></i>
          </span>
          <span>
            <strong>Maintenance</strong>
            <small>Riwayat dan jadwal</small>
          </span>
          <i class="quick-link-arrow" data-lucide="chevron-right"></i>
        </a>

        <a class="quick-link" href="#qr-info">
          <span class="stat-icon green">
            <i data-lucide="qr-code"></i>
          </span>
          <span>
            <strong>QR Info</strong>
            <small>Cari perangkat via QR</small>
          </span>
          <i class="quick-link-arrow" data-lucide="chevron-right"></i>
        </a>
      </div>
    `;

    // ==========================================
    // 8. KARTU DASHBOARD
    // ==========================================

    const computerCard = `
      <a class="stat-card dash-stat-link dash-inventory-card computer-inventory-card"
         href="#computers">

        <div class="dash-card-top">
          <span class="stat-icon blue dash-large-icon">
            <i data-lucide="monitor"></i>
          </span>

          <div class="dash-card-main">
            <div class="stat-label">Total Komputer</div>

            <div class="dash-total-line">
              <div class="stat-value">${activeComputers.length}</div>
              <span class="dash-active-label">Aktif</span>
            </div>
          </div>

          <i class="dash-card-arrow" data-lucide="chevron-right"></i>
        </div>

        <div class="dash-card-bottom">
          <span>
            <i data-lucide="calendar-days"></i>
            <b>${acquiredComputers}</b> Tahun Ini
          </span>

          <span>
            <i data-lucide="archive"></i>
            <b>${archivedComputerCount}</b> Arsip
          </span>
        </div>
      </a>
    `;

    const printerCard = `
      <a class="stat-card dash-stat-link dash-inventory-card printer-inventory-card"
         href="#printers">

        <div class="dash-card-top">
          <span class="stat-icon teal dash-large-icon">
            <i data-lucide="printer"></i>
          </span>

          <div class="dash-card-main">
            <div class="stat-label">Total Printer</div>

            <div class="dash-total-line">
              <div class="stat-value">${activePrinters.length}</div>
              <span class="dash-active-label">Aktif</span>
            </div>
          </div>

          <i class="dash-card-arrow" data-lucide="chevron-right"></i>
        </div>

        <div class="dash-card-bottom">
          <span>
            <i data-lucide="calendar-days"></i>
            <b>${acquiredPrinters}</b> Tahun Ini
          </span>

          <span>
            <i data-lucide="archive"></i>
            <b>${archivedPrinterCount}</b> Arsip
          </span>
        </div>
      </a>
    `;

    // ==========================================
    // KARTU TOTAL MAINTENANCE
    // ==========================================

    const totalPerawatan = maintenance.filter(row =>
      String(row.jenis_kegiatan || row.kegiatan || "")
        .trim().toLowerCase() === "perawatan"
    ).length;

    const totalPerbaikan = maintenance.filter(row =>
      String(row.jenis_kegiatan || row.kegiatan || "")
        .trim().toLowerCase() === "perbaikan"
    ).length;

    const maintenanceCard = `
      <a class="stat-card dash-stat-link dash-inventory-card maintenance-inventory-card"
         href="#maintenance">

        <div class="dash-card-top">
          <span class="stat-icon amber dash-large-icon">
            <i data-lucide="clipboard-list"></i>
          </span>

          <div class="dash-card-main">
            <div class="stat-label">Total Maintenance</div>

            <div class="dash-total-line">
              <div class="stat-value">${maintenance.length}</div>
            </div>
          </div>

          <i class="dash-card-arrow" data-lucide="chevron-right"></i>
        </div>

        <div class="dash-card-bottom">
          <span>
            <i data-lucide="shield-check"></i>
            <b>${totalPerawatan}</b> Perawatan
          </span>

          <span>
            <i data-lucide="wrench"></i>
            <b>${totalPerbaikan}</b> Perbaikan
          </span>
        </div>
      </a>
    `;

    const backendCard = `
      <article class="stat-card dash-operation-card backend-summary-card">

        <span class="stat-icon green dash-large-icon">
          <i data-lucide="activity"></i>
        </span>

        <div class="dash-operation-copy">
          <div class="stat-label">Koneksi Backend</div>
          <div class="stat-value dash-online">Terintegrasi</div>
          <div class="stat-note">
            Menggunakan Google Apps Script
          </div>
        </div>

      </article>
    `;

    // ==========================================
    // 9. TAMPILAN UTAMA DASHBOARD
    // ==========================================

    host.innerHTML = `
      <section class="dash-last-updated">
        <button
          type="button"
          id="refreshButton"
          class="dash-updated-icon"
          aria-label="Perbarui data"
          title="Perbarui data">
          <i data-lucide="refresh-cw"></i>
        </button>

        <div>
          <strong>Data Terakhir Diperbarui</strong>
          <small>${esc(fmtDateTime(lastUpdated))}</small>
        </div>
      </section>

      <section class="stats-grid dash-stats-grid">
        ${computerCard}
        ${printerCard}
        ${maintenanceCard}
        ${backendCard}
      </section>

      ${panel(
        "Akses Cepat",
        "Pintasan menuju modul GoJak TechOps",
        "grid-2x2",
        quickHtml,
        "quick-panel"
      )}

      <section class="dash-content-grid">
        ${panel(
          "Monitoring Perangkat per Unit",
          "Jumlah komputer dan printer pada setiap unit",
          "building-2",
          unitHtml,
          "unit-panel"
        )}

        ${panel(
          "Monitoring Jadwal Maintenance",
          "Jadwal dari catatan maintenance",
          "calendar-clock",
          scheduleHtml,
          "schedule-panel"
        )}

        ${panel(
          "Ringkasan Kondisi Perangkat",
          "Kondisi terbaru berdasarkan riwayat tiap perangkat",
          "heart-pulse",
          conditionHtml,
          "condition-panel"
        )}

        ${panel(
          "Aktivitas Maintenance Terbaru",
          "Enam catatan maintenance terakhir",
          "history",
          recentHtml,
          "activity-panel"
        )}
      </section>
    `;

    // Tidak membuat tombol refresh tambahan di header.
    // Tombol Data Terakhir Diperbarui diikat oleh app.js.

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  window.DashboardPage = { render };
})();
