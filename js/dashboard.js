
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

    if (value instanceof Date && !isNaN(value)) {
      return value;
    }

    const s = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) {
      const parsed = new Date(s.replace(" ", "T"));
      return isNaN(parsed) ? null : parsed;
    }

    let m = s.match(
      /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/
    );

    if (m) {
      return new Date(
        +m[3],
        +m[2] - 1,
        +m[1],
        +(m[4] || 0),
        +(m[5] || 0),
        +(m[6] || 0)
      );
    }

    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (m) {
      return new Date(+m[1], +m[2] - 1, +m[3]);
    }

    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (m) {
      return new Date(+m[3], +m[2] - 1, +m[1]);
    }

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
    // 4. MONITORING KONDISI KOMPUTER & PRINTER
    // ==========================================

    const datedMaintenance = maintenance
      .map(row => ({
        ...row,
        _date: parseDate(
          row["Waktu Dibuat"] || row.Tanggal
        )
      }))
      .sort((a, b) =>
        (b._date?.getTime() || 0) -
        (a._date?.getTime() || 0)
      );

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

    function deviceKey(type, serial, name) {
      const normalizedType = normalizeAssetType(type);
      const identity = String(serial || name || "")
        .trim()
        .toUpperCase();

      if (!normalizedType || !identity) return "";

      return `${normalizedType}|${identity}`;
    }

    // Catatan terbaru untuk setiap perangkat.
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

    // Inventaris aktif dipisahkan berdasarkan jenis perangkat.
    const inventoryByType = {
      komputer: activeComputers.map(row => ({
        type: "komputer",
        name: row.komputer || "Komputer tanpa nama",
        serial: row.serial || ""
      })),

      printer: activePrinters.map(row => ({
        type: "printer",
        name: row.unit || "Printer tanpa nama",
        serial: row.serial || ""
      }))
    };

    // Menghindari perangkat ganda berdasarkan jenis + serial.
    Object.keys(inventoryByType).forEach(type => {
      const unique = new Map();

      inventoryByType[type].forEach(device => {
        const key = deviceKey(
          device.type,
          device.serial,
          device.name
        );

        if (key && !unique.has(key)) {
          unique.set(key, device);
        }
      });

      inventoryByType[type] = [...unique.values()];
    });

    // ==========================================
    // PERHITUNGAN KONDISI PERANGKAT
    // ==========================================

    function buildConditionPanel(devices, typeLabel, archivedCount) {
      const archived = Math.max(0, Number(archivedCount) || 0);

      const groups = {
        Baik: [],
        "Perlu Perhatian": [],
        Rusak: [],
        "Belum Ada Data Kondisi": []
      };

      devices.forEach(device => {
        const key = deviceKey(
          device.type,
          device.serial,
          device.name
        );

        const latest = latestByDevice.get(key);
        const condition = String(latest?.kondisi || "")
          .trim()
          .toLowerCase();

        const item = {
          ...device,
          latestDate: latest
            ? (latest["Waktu Dibuat"] || latest.Tanggal)
            : null
        };

        if (!latest) {
          groups["Belum Ada Data Kondisi"].push(item);
        } else if (condition === "baik") {
          groups.Baik.push(item);
        } else if (condition === "perlu perhatian") {
          groups["Perlu Perhatian"].push(item);
        } else if (condition === "rusak") {
          groups.Rusak.push(item);
        } else {
          groups["Belum Ada Data Kondisi"].push(item);
        }
      });

      const counts = {
        Baik: groups.Baik.length,
        "Perlu Perhatian": groups["Perlu Perhatian"].length,
        Rusak: groups.Rusak.length + archived,
        "Belum Ada Data Kondisi":
          groups["Belum Ada Data Kondisi"].length
      };

      function categoryRow(label, items, totalCount, dotClass) {
        const hasArchived = label === "Rusak" && archived > 0;
        const canExpand = items.length > 0 || hasArchived;

        const summary = `
          <span class="dash-condition-label">
            <span class="condition-dot ${dotClass}"></span>
            <span>${esc(label)}</span>
          </span>
          <strong>${totalCount}</strong>
        `;

        if (!canExpand) {
          return `
            <div class="dash-missing-details dash-condition-item is-empty">
              <div class="dash-condition-summary">
                ${summary}
              </div>
            </div>
          `;
        }

        return `
          <details class="dash-missing-details dash-condition-item">
            <summary>
              ${summary}
            </summary>

            <div class="dash-missing-list">
              ${items.map(device => {
                const maskedSerial = window.TechOpsUI
                  ? window.TechOpsUI.maskSerial(device.serial || "")
                  : (device.serial || "-");

                return `
                  <div class="dash-missing-row">
                    <div>
                      <strong>${esc(device.name)}</strong>
                      <small>
                        Serial: ${esc(maskedSerial || "-")}
                        ${device.latestDate
                          ? " · Maintenance: " + esc(fmtDateTime(device.latestDate))
                          : " · Belum ada catatan"}
                      </small>
                    </div>
                    <span>${esc(label)}</span>
                  </div>
                `;
              }).join("")}

              ${hasArchived ? `
                <div class="dash-missing-row">
                  <div>
                    <strong>${archived} perangkat arsip</strong>
                    <small>Detail perangkat arsip belum tersedia dari API.</small>
                  </div>
                  <span>Arsip</span>
                </div>
              ` : ""}
            </div>
          </details>
        `;
      }

      const totalDevices = devices.length + archived;

      return `
        <div class="dash-condition-combined">
          ${categoryRow("Baik", groups.Baik, counts.Baik, "good")}
          ${categoryRow(
            "Perlu Perhatian",
            groups["Perlu Perhatian"],
            counts["Perlu Perhatian"],
            "attention"
          )}
          ${categoryRow("Rusak", groups.Rusak, counts.Rusak, "bad")}
          ${categoryRow(
            "Belum Ada Data Kondisi",
            groups["Belum Ada Data Kondisi"],
            counts["Belum Ada Data Kondisi"],
            ""
          )}

          <small class="dash-condition-note">
            ${esc(typeLabel)}: ${totalDevices} perangkat.
            ${devices.length} aktif dan ${archived} arsip.
            Kondisi perangkat aktif berdasarkan catatan Maintenance terbaru.
            Seluruh perangkat arsip dihitung sebagai Rusak.
          </small>
        </div>
      `;
    }

    const computerConditionHtml = buildConditionPanel(
      inventoryByType.komputer,
      "Komputer",
      archivedComputerCount
    );

    const printerConditionHtml = buildConditionPanel(
      inventoryByType.printer,
      "Printer",
      archivedPrinterCount
    );

    // ==========================================
    // 5. MONITORING JADWAL MAINTENANCE
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
        _created: parseDate(row["Waktu Dibuat"]),
        _schedule: parseDate(row.jadwal)
      }))
      .filter(row => row._date)
      .sort((a, b) => {
        const dateDiff = b._date.getTime() - a._date.getTime();

        if (dateDiff !== 0) return dateDiff;

        return (b._created?.getTime() || 0) -
               (a._created?.getTime() || 0);
      });

    // Ambil catatan Perawatan terbaru untuk setiap perangkat.
    const latestCareByDevice = new Map();

    maintenanceCare.forEach(row => {
      const type = normalizeAssetType(row.jenis_aset);

      const serial = String(
        row.serial || row.nama_aset || ""
      ).trim().toUpperCase();

      if (!type || !serial) return;

      const key = `${type}|${serial}`;

      if (!latestCareByDevice.has(key)) {
        latestCareByDevice.set(key, row);
      }
    });

    // Jadwal dari catatan Perawatan terbaru.
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

    // Baris tabel jadwal.
    function scheduleRowHtml(row) {
      const type = normalizeAssetType(row.jenis_aset);

      const typeLabel = type === "komputer"
        ? "Komputer"
        : type === "printer"
          ? "Printer"
          : String(row.jenis_aset || "Perangkat");

      const assetName = String(
        row.nama_aset || "Nama perangkat tidak tersedia"
      ).trim();

      const serial = String(row.serial || "").trim();

      const maskedSerial = window.TechOpsUI
        ? window.TechOpsUI.maskSerial(serial)
        : serial || "-";

      return `
        <tr>
          <td>${esc(typeLabel)}</td>
          <td class="primary-cell">${esc(assetName)}</td>
          <td>${esc(maskedSerial || "-")}</td>
          <td>${esc(fmtDate(row.jadwal))}</td>
        </tr>
      `;
    }

    // Tabel jadwal yang dapat dibuka dan ditutup.
    const scheduleListHtml = schedules.length
      ? `
        <details class="dash-missing-details">
          <summary>
            <span>
              Seluruh Jadwal Perawatan · ${schedules.length} perangkat
            </span>
          </summary>

          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>JENIS ASET</th>
                  <th>NAMA PERANGKAT</th>
                  <th>SERIAL</th>
                  <th>JADWAL BERIKUTNYA</th>
                </tr>
              </thead>
              <tbody>
                ${schedules.map(scheduleRowHtml).join("")}
              </tbody>
            </table>
          </div>
        </details>
      `
      : empty("Belum ada jadwal Perawatan.");

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

      <div class="dash-schedule-next">
        ${scheduleListHtml}
      </div>
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
                  ${esc(row.nama_aset || "Perangkat")}
                </strong>

                <small>
                  ${esc(row.kegiatan || "Maintenance")}
                  ·
                  ${esc(row.kondisi || "Kondisi belum diisi")}
                </small>
              </div>

              <time>${esc(
                fmtDateTime(row["Waktu Dibuat"] || row.Tanggal)
              )}</time>
            </div>
          `).join("")}
        </div>
      `
      : empty("Belum ada aktivitas maintenance.");

    // ==========================================
    // 7. KARTU INVENTARIS
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
    // 8. KARTU TOTAL MAINTENANCE
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
          <div class="stat-label">Koneksi</div>
          <div class="stat-value dash-online">Online</div>
          <div class="stat-note">
            Google Apps Script
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
          "Aktivitas Maintenance Terbaru",
          "Catatan perawatan dan perbaikan perangkat terbaru",
          "history",
          recentHtml,
          "activity-panel"
        )}

        ${panel(
          "Kondisi Komputer",
          "Monitoring kondisi dan riwayat Maintenance komputer",
          "monitor",
          computerConditionHtml,
          "condition-panel computer-condition-panel"
        )}

        ${panel(
          "Kondisi Printer",
          "Monitoring kondisi dan riwayat Maintenance printer",
          "printer",
          printerConditionHtml,
          "condition-panel printer-condition-panel"
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
