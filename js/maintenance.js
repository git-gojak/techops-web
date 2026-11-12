
(function () {
  "use strict";

  const ui = () => window.TechOpsUI;
  const state = () => window.TechOpsState;

  let currentQuery = "";
  let selectedDevice = null;
  let modalElement = null;

  const $ = (selector, root = document) => root.querySelector(selector);

  function esc(value) {
    return ui().escapeHTML(String(value ?? ""));
  }

  function isAdmin() {
    return !!state().authenticated;
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString("id-ID", {
          day: "2-digit", month: "short", year: "numeric"
        });
  }

  function getValue(row, keys) {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") {
        return row[key];
      }
    }
    return "";
  }

  function getDevices() {
    const computers = (state().computers || [])
      .filter(r => !r.archived && !r.arsip)
      .map(raw => ({
        type: "Komputer",
        name: getValue(raw, ["Computer Name", "computer_name", "computerName", "nama_aset", "nama"]) || "Komputer tanpa nama",
        serial: getValue(raw, ["Asset/Serial ID", "asset_serial_id", "serial", "serial_number", "asset_id"]),
        raw
      }));

    const printers = (state().printers || [])
      .filter(r => !r.archived && !r.arsip)
      .map(raw => ({
        type: "Printer",
        name: getValue(raw, ["nama_aset", "nama", "printer_name", "printerName"]) ||
          [getValue(raw, ["manufacturer", "Manufacturer"]), getValue(raw, ["model", "Model"])].filter(Boolean).join(" ") ||
          "Printer tanpa nama",
        serial: getValue(raw, ["sn_asset", "serial", "serial_number", "originalSnAsset"]),
        raw
      }));

    return [...computers, ...printers];
  }

  function render() {
    const host = ui().$("#appContent");
    const rows = state().maintenance || [];

    host.innerHTML =
      ui().pageHeading(
        "Maintenance",
        "Riwayat perawatan dan perbaikan komputer maupun printer.",
        "IT SERVICE"
      ) +
      `<section class="panel">
        <div class="table-toolbar">
          <div class="search-box">
            <i data-lucide="search"></i>
            <input
              id="maintenanceSearch"
              type="search"
              placeholder="Cari perangkat, serial, kegiatan, teknisi..."
              value="${esc(currentQuery)}"
            >
          </div>
          <div class="computer-toolbar-actions">
            <span class="badge">${rows.length} riwayat</span>
            ${isAdmin() ? `
              <button type="button" class="button button-primary" id="addMaintenanceBtn">
                <i data-lucide="plus"></i>
                Catat Maintenance
              </button>` : ""}
          </div>
        </div>
        <div id="maintenanceTable"></div>
      </section>`;

    $("#maintenanceSearch").addEventListener("input", event => {
      currentQuery = event.target.value;
      drawTable(currentQuery);
    });

    $("#addMaintenanceBtn")?.addEventListener("click", openForm);

    drawTable(currentQuery);
    ui().bindRefresh();
    ui().iconRefresh();
  }

  function drawTable(query) {
    const all = state().maintenance || [];
    const q = String(query || "").trim().toLowerCase();

    const rows = all.filter(row =>
      ["Tanggal", "jenis_aset", "nama_aset", "serial", "kegiatan",
       "kondisi", "keterangan", "teknisi", "jadwal"]
        .some(key => String(row[key] ?? "").toLowerCase().includes(q))
    );

    const host = $("#maintenanceTable");
    if (!host) return;

    if (!rows.length) {
      host.innerHTML = `<div class="empty-state">
        ${q ? "Tidak ada riwayat maintenance yang cocok." : "Belum ada riwayat maintenance."}
      </div>`;
      return;
    }

    host.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>TANGGAL</th>
              <th>JENIS</th>
              <th>NAMA PERANGKAT</th>
              <th>SERIAL</th>
              <th>KEGIATAN</th>
              <th>KONDISI</th>
              <th>TEKNISI / VENDOR</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${esc(formatDate(row.Tanggal))}</td>
                <td>
                  <span class="badge ${String(row.jenis_aset).toLowerCase() === "printer" ? "green" : ""}">
                    ${esc(row.jenis_aset)}
                  </span>
                </td>
                <td class="primary-cell">${esc(row.nama_aset)}</td>
                <td>${esc(row.serial)}</td>
                <td>${esc(row.kegiatan)}</td>
                <td>${esc(row.kondisi)}</td>
                <td>${esc(row.teknisi)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span>Menampilkan ${rows.length} dari ${all.length} riwayat</span>
      </div>`;
  }

  function openModal(title, content, variant) {
    closeModal();

    modalElement = document.createElement("div");
    modalElement.className = "modal-backdrop";

    modalElement.innerHTML = `
      <section class="modal ${variant || ""}">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-title-eyebrow">GOJAK TECHOPS · IT SERVICE</span>
            <h2>${esc(title)}</h2>
          </div>
          <button type="button" class="icon-button" id="closeMaintenanceModal" aria-label="Tutup">
            <i data-lucide="x"></i>
          </button>
        </div>
        ${content}
      </section>`;

    document.body.appendChild(modalElement);

    $("#closeMaintenanceModal", modalElement).addEventListener("click", closeModal);

    modalElement.addEventListener("click", event => {
      if (event.target === modalElement) closeModal();
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function openForm() {
    if (!isAdmin()) return;

    selectedDevice = null;
    const devices = getDevices();

    const options = devices.map((device, index) => `
      <option value="${index}">
        ${esc(device.type)} — ${esc(device.name)}
        ${device.serial ? ` (${esc(device.serial)})` : ""}
      </option>
    `).join("");

    openModal("Catat Maintenance", `
      <form id="maintenanceForm" class="computer-form">

        <div class="computer-form-required">
          <span>*</span> Wajib diisi
        </div>

        <section class="computer-form-section">
          <div class="computer-section-heading">
            <div class="computer-section-icon"><i data-lucide="scan-search"></i></div>
            <div>
              <h3>Identifikasi Perangkat</h3>
              <p>Pilih perangkat yang akan dilakukan perawatan atau perbaikan.</p>
            </div>
            <span class="computer-section-number">01</span>
          </div>

          <div class="computer-form-grid">
            <label class="computer-form-field computer-field-wide">
              <span class="computer-field-label">QR / Barcode / Serial</span>
              <div class="computer-toolbar-actions">
                <input id="maintenanceQr" type="text"
                  placeholder="Masukkan kode QR, barcode, atau serial"
                  autocomplete="off">
                <button type="button" class="button button-secondary" id="findMaintenanceQr">
                  Cari
                </button>
              </div>
              <span class="computer-field-hint">
                Masukkan hasil pemindaian atau kode perangkat secara manual.
              </span>
            </label>

            <label class="computer-form-field computer-field-wide">
              <span class="computer-field-label">Pilih Perangkat <span>*</span></span>
              <select id="maintenanceDevice" required>
                <option value="">-- Pilih komputer atau printer --</option>
                ${options}
              </select>
              <span class="computer-field-hint">
                ${devices.length} perangkat tersedia dari inventaris.
              </span>
            </label>
          </div>

          <div id="maintenanceDeviceInfo" class="detail-grid">
            <div class="empty-state">Identitas perangkat akan tampil setelah perangkat dipilih.</div>
          </div>
        </section>

        <section class="computer-form-section">
          <div class="computer-section-heading">
            <div class="computer-section-icon"><i data-lucide="clipboard-list"></i></div>
            <div>
              <h3>Detail Pekerjaan</h3>
              <p>Informasi pelaksanaan perawatan atau perbaikan perangkat.</p>
            </div>
            <span class="computer-section-number">02</span>
          </div>

          <div class="computer-form-grid">
            <label class="computer-form-field">
              <span class="computer-field-label">Tanggal <span>*</span></span>
              <input id="maintenanceDate" type="date" value="${today()}" required>
            </label>

            <label class="computer-form-field">
              <span class="computer-field-label">Kategori Kegiatan <span>*</span></span>
              <select id="maintenanceCategory" required>
                <option value="Perawatan">Perawatan</option>
                <option value="Perbaikan">Perbaikan</option>
              </select>
            </label>

            <label class="computer-form-field computer-field-wide">
              <span class="computer-field-label">Uraian Kegiatan <span>*</span></span>
              <textarea id="maintenanceAction" rows="3" required
                placeholder="Jelaskan tindakan yang dilakukan..."></textarea>
            </label>

            <label class="computer-form-field">
              <span class="computer-field-label">Kondisi Perangkat <span>*</span></span>
              <select id="maintenanceCondition" required>
                <option value="">-- Pilih kondisi --</option>
                <option value="Baik">Baik</option>
                <option value="Perlu Perhatian">Perlu Perhatian</option>
                <option value="Rusak">Rusak</option>
              </select>
            </label>

            <label class="computer-form-field">
              <span class="computer-field-label">Refill</span>
              <select id="maintenanceRefill">
                <option value="T">T — Tidak</option>
                <option value="Y">Y — Ya</option>
              </select>
              <span class="computer-field-hint">Pilih Y jika dilakukan refill.</span>
            </label>

            <label class="computer-form-field">
              <span class="computer-field-label">Penanganan oleh <span>*</span></span>
              <select id="maintenanceTechnician" required>
                <option value="">-- Pilih --</option>
                <option value="Teknisi">Teknisi</option>
                <option value="Vendor">Vendor</option>
              </select>
            </label>

            <label class="computer-form-field computer-field-wide">
              <span class="computer-field-label">Keterangan</span>
              <textarea id="maintenanceNotes" rows="3"
                placeholder="Keterangan tambahan (opsional)"></textarea>
            </label>
          </div>
        </section>

        <section class="computer-form-section">
          <div class="computer-section-heading">
            <div class="computer-section-icon"><i data-lucide="calendar-clock"></i></div>
            <div>
              <h3>Jadwal Maintenance Berikutnya</h3>
              <p>Perkiraan jadwal dihitung otomatis berdasarkan jenis aset dan kegiatan.</p>
            </div>
            <span class="computer-section-number">03</span>
          </div>
          <div id="maintenanceSchedulePreview" class="computer-field-hint">
            Pilih perangkat dan kategori kegiatan untuk melihat jadwal.
          </div>
        </section>

        <div class="computer-form-message notice warning">
          Tampilan formulir belum terhubung ke backend. Data belum disimpan.
        </div>

        <div class="computer-form-footer">
          <button type="button" class="button button-secondary" id="cancelMaintenance">
            Tutup
          </button>
          <button type="button" class="button button-primary" disabled>
            <i data-lucide="save"></i> Simpan
          </button>
        </div>
      </form>
    `, "computer-modal");

    $("#cancelMaintenance", modalElement).addEventListener("click", closeModal);

    $("#maintenanceDevice", modalElement).addEventListener("change", event => {
      const index = event.target.value;
      selectedDevice = index === "" ? null : devices[Number(index)] || null;
      renderDeviceInfo();
      updateSchedule();
    });

    $("#findMaintenanceQr", modalElement).addEventListener("click", () => {
      findDeviceByCode(devices);
    });

    $("#maintenanceQr", modalElement).addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        findDeviceByCode(devices);
      }
    });

    ["maintenanceDate", "maintenanceCategory"].forEach(id => {
      $("#" + id, modalElement).addEventListener("change", updateSchedule);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function findDeviceByCode(devices) {
    const value = String($("#maintenanceQr", modalElement).value || "").trim().toLowerCase();

    if (!value) {
      ui().toast("Masukkan kode QR, barcode, atau serial terlebih dahulu.", "warning");
      return;
    }

    const found = devices.find(device => {
      const raw = device.raw || {};
      const identifiers = [
        device.serial,
        device.name,
        getValue(raw, ["Asset/Serial ID", "asset_serial_id", "asset_id", "sn_asset"]),
        getValue(raw, ["Computer Name", "computer_name", "computerName", "nama_aset", "nama"])
      ];

      return identifiers.some(item =>
        String(item || "").trim().toLowerCase() === value
      );
    });

    if (!found) {
      ui().toast("Perangkat tidak ditemukan pada inventaris.", "warning");
      return;
    }

    selectedDevice = found;
    $("#maintenanceDevice", modalElement).value = String(devices.indexOf(found));
    renderDeviceInfo();
    updateSchedule();

    ui().toast("Perangkat berhasil ditemukan.", "success");
  }

  function renderDeviceInfo() {
    const host = $("#maintenanceDeviceInfo", modalElement);
    if (!host) return;

    if (!selectedDevice) {
      host.innerHTML = `<div class="empty-state">Identitas perangkat akan tampil setelah perangkat dipilih.</div>`;
      return;
    }

    host.innerHTML = `
      <div class="detail-item">
        <span>Jenis Aset</span>
        <strong>${esc(selectedDevice.type)}</strong>
      </div>
      <div class="detail-item">
        <span>Nama Perangkat</span>
        <strong>${esc(selectedDevice.name)}</strong>
      </div>
      <div class="detail-item">
        <span>Serial / Asset ID</span>
        <strong>${esc(selectedDevice.serial || "-")}</strong>
      </div>`;
  }

  function addMonths(value, months) {
    const parts = String(value || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;

    const [year, month, day] = parts;
    const targetMonth = month - 1 + months;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();

    return `${targetYear}-${String(normalizedMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
  }

  function updateSchedule() {
    const host = $("#maintenanceSchedulePreview", modalElement);
    if (!host) return;

    const category = $("#maintenanceCategory", modalElement).value;
    const date = $("#maintenanceDate", modalElement).value;

    if (!selectedDevice || !category || !date) {
      host.textContent = "Pilih perangkat, tanggal, dan kategori kegiatan.";
      return;
    }

    if (category === "Perbaikan") {
      host.innerHTML = `
        <strong>Tidak ada jadwal rutin otomatis.</strong>
        <p>Jadwal berikutnya ditentukan setelah kondisi perangkat dievaluasi.</p>`;
      return;
    }

    const months = selectedDevice.type === "Printer" ? 3 : 6;
    const nextDate = addMonths(date, months);

    host.innerHTML = `
      <strong>Jadwal berikutnya: ${esc(formatDate(nextDate))}</strong>
      <p>${esc(selectedDevice.type)} — Perawatan setiap ${months} bulan.</p>`;
  }

  function closeModal() {
    if (modalElement) {
      modalElement.remove();
      modalElement = null;
    }
    selectedDevice = null;
  }

  window.MaintenancePage = { render };
})();
