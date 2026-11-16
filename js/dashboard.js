
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

    
    // Normalisasi jenis aset agar kunci perangkat konsisten.
    function normalizeAssetType(value) {
      const type = String(value || "").trim().toLowerCase();

      if (["komputer", "computer", "pc"].includes(type)) {
        return "komputer";
      }

      if (type === "printer") {
        return "printer";
      }

      return "";
    }

    // Kunci perangkat: jenis aset + serial.
    // Nama aset menjadi cadangan jika serial kosong.
    function deviceKey(type, serial, name) {
      const normalizedType = normalizeAssetType(type);
      const identity = String(serial || name || "")
        .trim()
        .toUpperCase();

      if (!normalizedType || !identity) return "";

      return `${normalizedType}|${identity}`;
    }

    // Ambil catatan maintenance terbaru setiap perangkat.
    const latestByDevice = new Map();

    datedMaintenance
      .filter(row => row._date)
      .forEach(row => {
        const key = deviceKey(
          row.jenis_aset,
          row.serial,
          row.nama_aset
        );

        if (!key || latestByDevice.has(key)) return;

        latestByDevice.set(key, row);
      });

    // Inventaris aktif menjadi dasar penghitungan kondisi.
    const inventoryDevices = [
      ...activeComputers.map(row => ({
        type: "komputer",
        serial: row.serial,
        name: row.komputer
      })),

      ...activePrinters.map(row => ({
        type: "printer",
        serial: row.serial,
        name: row.serial
      }))
    ];

    // Hindari perangkat yang sama dihitung dua kali.
    const uniqueInventory = new Map();

    inventoryDevices.forEach(device => {
      const key = deviceKey(
        device.type,
        device.serial,
        device.name
      );

      if (key && !uniqueInventory.has(key)) {
        uniqueInventory.set(key, device);
      }
    });

    const conditionCounts = {
      "Baik": 0,
      "Perlu Perhatian": 0,
      "Rusak": 0,
      "Belum Ada Data Kondisi": 0
    };

    // Hitung kondisi terbaru hanya untuk perangkat inventaris aktif.
    uniqueInventory.forEach((device, key) => {
      const latest = latestByDevice.get(key);

      if (!latest) {
        conditionCounts["Belum Ada Data Kondisi"]++;
        return;
      }

      const condition = String(latest.kondisi || "")
        .trim()
        .toLowerCase();

      if (condition === "baik") {
        conditionCounts.Baik++;
      } else if (condition === "perlu perhatian") {
        conditionCounts["Perlu Perhatian"]++;
      } else if (condition === "rusak") {
        conditionCounts.Rusak++;
      } else {
        conditionCounts["Belum Ada Data Kondisi"]++;
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

        <div>
          <span class="condition-dot"></span>
          <span>Belum Ada Data Kondisi</span>
          <strong>${conditionCounts["Belum Ada Data Kondisi"]}</strong>
        </div>

        <small>
          Berdasarkan kondisi maintenance terakhir dari
          ${uniqueInventory.size} perangkat inventaris aktif.
        </small>
      </div>
    `;


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

    // Hanya catatan Perawatan yang menjadi sumber jadwal.
    const maintenanceCare = maintenance
      .filter(row => {
        const activity = String(
          row.jenis_kegiatan || row.kegiatan || ""
        ).trim().toLowerCase();

        return activity === "perawatan";
      })
      .map(row => ({
        ...row,
        _date: parseDate(row.Tanggal),
        _schedule: parseDate(row.jadwal)
      }))
      .filter(row => row._date)
      .sort((a, b) =>
        b._date.getTime() - a._date.getTime()
      );

    // Ambil satu catatan Perawatan terbaru
    // untuk setiap perangkat.
    const latestCareByDevice = new Map();

    maintenanceCare.forEach(row => {
      const type = String(row.jenis_aset || "")
        .trim().toLowerCase();

      const serial = String(
        row.serial || row.nama_aset || ""
      ).trim().toUpperCase();

      if (!serial) return;

      const key = `${type}|${serial}`;

      if (!latestCareByDevice.has(key)) {
        latestCareByDevice.set(key, row);
      }
    });

    // Jadwal aktif hanya berasal dari Perawatan
    // terbaru masing-masing perangkat.
    const schedules = [...latestCareByDevice.values()]
      .filter(row => row._schedule)
      .sort((a, b) =>
        a._schedule.getTime() - b._schedule.getTime()
      );

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

    const overdueSchedules = schedules.filter(
      row => row._schedule < today
    );

    const upcomingSchedules = schedules.filter(
      row =>
        row._schedule >= today &&
        row._schedule <= next30Days
    );

    const futureSchedules = schedules.filter(
      row => row._schedule > next30Days
    );

    // Jadwal mendatang yang paling dekat.
    const nearestSchedule = schedules.find(
      row => row._schedule >= today
    );

    const scheduleHtml = `
      <div class="dash-schedule-summary">
        <div class="schedule-number overdue">
          <strong>${overdueSchedules.length}</strong>
          <span>Terlambat</span>
        </div>

        <div class="schedule-number upcoming">
          <strong>${upcomingSchedules.length}</strong>
          <span>Segera (30 hari)</span>
        </div>

        <div class="schedule-number">
          <strong>${futureSchedules.length}</strong>
          <span>Terjadwal</span>
        </div>
      </div>

      ${
        nearestSchedule
          ? `
            <div class="dash-schedule-next">
              <small>Jadwal Perawatan Berikutnya</small>

              <strong>
                ${esc(
                  nearestSchedule.nama_aset ||
                  nearestSchedule.serial ||
                  "Perangkat"
                )}
              </strong>

              <span>
                ${esc(fmtDate(nearestSchedule.jadwal))}
              </span>
            </div>
          `
          : empty(
              schedules.length
                ? "Belum ada jadwal Perawatan mendatang."
                : "Belum ada jadwal Perawatan aktif."
            )
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
