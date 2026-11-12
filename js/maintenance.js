
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
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function formatDate(value) {
    if (!value) return "-";

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);

    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function getValue(object, keys) {
    if (!object) return "";

    for (const key of keys) {
      if (object[key] !== undefined && object[key] !== null && object[key] !== "") {
        return object[key];
      }
    }

    return "";
  }

  function getComputerName(row) {
    return getValue(row, [
      "Computer Name", "computer_name", "computerName",
      "nama_aset", "nama", "hostname", "hostname"
    ]);
  }

  function getComputerSerial(row) {
    return getValue(row, [
      "Asset/Serial ID", "asset_serial_id", "serial",
      "serial_number", "serialNumber", "asset_id", "asset"
    ]);
  }

  function getPrinterName(row) {
    const manufacturer = getValue(row, ["manufacturer", "Manufacturer", "merek"]);
    const model = getValue(row, ["model", "Model"]);

    return getValue(row, [
      "nama_aset", "nama", "printer_name", "printerName"
    ]) || [manufacturer, model].filter(Boolean).join(" ");
  }

  function getPrinterSerial(row) {
    return getValue(row, [
      "sn_asset", "serial", "serial_number",
      "originalSnAsset", "asset_id"
    ]);
  }

  function getDevices() {
    const computers = (state().computers || [])
      .filter(row => !row.archived && !row.arsip)
      .map(row => ({
        type: "Komputer",
        name: getComputerName(row) || "Komputer tanpa nama",
        serial: getComputerSerial(row),
        raw: row
      }));

    const printers = (state().printers || [])
      .filter(row => !row.archived && !row.arsip)
      .map(row => ({
        type: "Printer",
        name: getPrinterName(row) || "Printer tanpa nama",
        serial: getPrinterSerial(row),
        raw: row
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
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="badge">${rows.length} riwayat</span>
            ${isAdmin()
              ? `<button class="button-primary" id="addMaintenance">
                   <i data-lucide="plus"></i> Catat Maintenance
                 </button>`
              : ""}
          </div>
        </div>
        <div id="maintenanceTable"></div>
      </section>`;

    $("#maintenanceSearch").addEventListener("input", event => {
      currentQuery = event.target.value;
      drawTable(currentQuery);
    });

    if (isAdmin()) {
      $("#addMaintenance").addEventListener("click", openForm);
    }

    drawTable(currentQuery);
    ui().bindRefresh();
    ui().iconRefresh();
  }

  function drawTable(query) {
    const all = state().maintenance || [];
    const q = String(query || "").trim().toLowerCase();

    const rows = all.filter(row => [
      "Tanggal", "jenis_aset", "nama_aset", "serial",
      "kegiatan", "kondisi", "keterangan", "teknisi", "jadwal"
    ].some(key => String(row[key] ?? "").toLowerCase().includes(q)));

    const host = $("#maintenanceTable");
    if (!host) return;

    if (!rows.length) {
      host.innerHTML = `
        <div class="empty-state">
          ${q
            ? "Tidak ada riwayat maintenance yang cocok."
            : "Belum ada riwayat maintenance."}
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

  function openForm() {
    if (!isAdmin()) return;

    selectedDevice = null;

    const devices = getDevices();

    const deviceOptions = devices.map((device, index) => `
      <option value="${index}">
        ${esc(device.type)} — ${esc(device.name)}
        ${device.serial ? " (" + esc(device.serial) + ")" : ""}
      </option>
    `).join("");

    modalElement = document.createElement("div");
    modalElement.className = "modal-backdrop";
    modalElement.innerHTML = `
      <div class="modal computer-modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <div class="modal-title-eyebrow">IT SERVICE</div>
            <h2>Catat Maintenance</h2>
          </div>
          <button type="button" class="button-icon" id="closeMaintenanceModal" aria-label="Tutup">
            <i data-lucide="x"></i>
          </button>
        </div>

        <form id="maintenanceForm">
          <div class="computer-form">
            <section class="computer-form-section">
              <div class="computer-section-heading">
                <i data-lucide="scan-search"></i>
                <div>
                  <strong>Identifikasi Perangkat</strong>
                  <p>Pindai kode atau pilih perangkat dari inventaris.</p>
                </div>
              </div>

              <div class="computer-form-field">
                <label class="computer-field-label" for="maintenanceQr">
                  QR / Barcode / Serial
                </label>
                <div style="display:flex;gap:8px">
                  <input
                    id="maintenanceQr"
                    class="form-control"
                    type="text"
                    placeholder="Masukkan hasil scan QR, barcode, atau serial"
                    autocomplete="off"
                  >
                  <button type="button" class="button-secondary" id="findMaintenanceQr">
                    Cari
                  </button>
                </div>
                <small class="form-help">
                  Untuk tahap tampilan ini, masukkan isi QR/barcode secara manual.
                </small>
              </div>

              <div class="computer-form-field">
                <label class="computer-field-label" for="maintenanceDevice">
                  Pilih dari Inventaris
                </label>
                <select id="maintenanceDevice" class="form-control">
                  <option value="">-- Pilih komputer atau printer --</option>
                  ${deviceOptions}
                </select>
                ${devices.length
                  ? `<small class="form-help">${devices.length} perangkat tersedia dari inventaris.</small>`
                  : `<small class="form-help">Data perangkat belum tersedia pada state aplikasi.</small>`}
              </div>

              <div id="maintenanceDeviceInfo" class="detail-grid">
                <div class="empty-state">Pilih perangkat untuk menampilkan identitasnya.</div>
              </div>
            </section>

            <section class="computer-form-section">
              <div class="computer-section-heading">
                <i data-lucide="clipboard-list"></i>
                <div>
                  <strong>Detail Pekerjaan</strong>
                  <p>Lengkapi informasi perawatan atau perbaikan.</p>
                </div>
              </div>

              <div class="computer-form-grid">
                <div class="computer-form-field">
                  <label class="computer-field-label" for="maintenanceDate">Tanggal</label>
                  <input
                    id="maintenanceDate"
                    class="form-control"
                    type="date"
                    value="${today()}"
                    required
                  >
                </div>

                <div class="computer-form-field">
                  <label class="computer-field-label" for="maintenanceCategory">Kategori Kegiatan</label>
                  <select id="maintenanceCategory" class="form-control" required>
                    <option value="Perawatan">Perawatan</option>
                    <option value="Perbaikan">Perbaikan</option>
                  </select>
                </div>

                <div class="computer-form-field" style="grid-column:1/-1">
                  <label class="computer-field-label" for="maintenanceAction">Uraian Kegiatan</label>
                  <textarea
                    id="maintenanceAction"
                    class="form-control"
                    rows="3"
                    placeholder="Contoh: Pembersihan perangkat, penggantian komponen, instalasi ulang..."
                    required
                  ></textarea>
                </div>

                <div class="computer-form-field">
                  <label class="computer-field-label" for="maintenanceCondition">Kondisi Perangkat</label>
                  <select id="maintenanceCondition" class="form-control" required>
                    <option value="">-- Pilih kondisi --</option>
                    <option value="Baik">Baik</option>
                    <option value="Perlu Perhatian">Perlu Perhatian</option>
                    <option value="Rusak">Rusak</option>
                  </select>
                </div>

                <div class="computer-form-field">
                  <label class="computer-field-label" for="maintenanceRefill">Refill</label>
                  <select id="maintenanceRefill" class="form-control">
                    <option value="T">T — Tidak</option>
                    <option value="Y">Y — Ya</option>
                  </select>
                </div>

                <div class="computer-form-field">
                  <label class="computer-field-label" for="maintenanceTechnician">Penanganan oleh</label>
                  <select id="maintenanceTechnician" class="form-control" required>
                    <option value="">-- Pilih --</option>
                    <option value="Teknisi">Teknisi</option>
                    <option value="Vendor">Vendor</option>
                  </select>
                </div>

                <div class="computer-form-field" style="grid-column:1/-1">
                  <label class="computer-field-label" for="maintenanceNotes">Keterangan</label>
                  <textarea
                    id="maintenanceNotes"
                    class="form-control"
                    rows="3"
                    placeholder="Keterangan tambahan (opsional)"
                  ></textarea>
                </div>
              </div>
            </section>

            <section class="computer-form-section">
              <div class="computer-section-heading">
                <i data-lucide="calendar-clock"></i>
                <div>
                  <strong>Jadwal Maintenance Berikutnya</strong>
                  <p>Jadwal dihitung otomatis berdasarkan tanggal dan kategori.</p>
                </div>
              </div>
              <div id="maintenanceSchedulePreview" class="notice">
                Pilih perangkat dan kategori kegiatan untuk melihat jadwal.
              </div>
            </section>

            <div class="computer-form-message notice warning">
              Tampilan formulir ini belum terhubung ke penyimpanan backend.
              Data belum akan disimpan.
            </div>

            <div class="computer-form-footer">
              <button type="button" class="button-secondary" id="cancelMaintenance">
                Tutup
              </button>
              <button type="button" class="button-primary" disabled>
                <i data-lucide="save"></i> Simpan (belum aktif)
              </button>
            </div>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalElement);

    $("#closeMaintenanceModal", modalElement).addEventListener("click", closeModal);
    $("#cancelMaintenance", modalElement).addEventListener("click", closeModal);

    modalElement.addEventListener("click", event => {
      if (event.target === modalElement) closeModal();
    });

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
    const input = $("#maintenanceQr", modalElement);
    const value = String(input.value || "").trim().toLowerCase();

    if (!value) {
      ui().toast("Masukkan kode QR, barcode, atau serial terlebih dahulu.", "warning");
      return;
    }

    const found = devices.find(device => {
      const row = device.raw || {};

      const identifiers = [
        device.serial,
        getValue(row, ["Asset/Serial ID", "asset_serial_id", "asset_id", "sn_asset"]),
        getValue(row, ["Computer Name", "computer_name", "computerName"]),
        getValue(row, ["nama_aset", "nama", "printer_name"])
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

    const select = $("#maintenanceDevice", modalElement);
    const index = devices.indexOf(found);
    select.value = String(index);

    renderDeviceInfo();
    updateSchedule();

    ui().toast("Perangkat berhasil ditemukan.", "success");
  }

  function renderDeviceInfo() {
    const host = $("#maintenanceDeviceInfo", modalElement);
    if (!host) return;

    if (!selectedDevice) {
      host.innerHTML = `
        <div class="empty-state">
          Pilih perangkat untuk menampilkan identitasnya.
        </div>`;
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

  function addMonths(dateValue, months) {
    const parts = String(dateValue || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;

    const year = parts[0];
    const month = parts[1] - 1;
    const day = parts[2];

    const targetMonth = month + months;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;

    const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
    const targetDay = Math.min(day, lastDay);

    return [
      targetYear,
      String(normalizedMonth + 1).padStart(2, "0"),
      String(targetDay).padStart(2, "0")
    ].join("-");
  }

  function updateSchedule() {
    const host = $("#maintenanceSchedulePreview", modalElement);
    if (!host) return;

    const category = $("#maintenanceCategory", modalElement).value;
    const date = $("#maintenanceDate", modalElement).value;

    if (!selectedDevice || !category || !date) {
      host.innerHTML = "Pilih perangkat, tanggal, dan kategori kegiatan.";
      return;
    }

    if (category === "Perbaikan") {
      host.innerHTML = `
        <strong>Tidak ada jadwal rutin otomatis.</strong>
        <div>Jadwal berikutnya dapat ditentukan setelah kondisi perangkat dievaluasi.</div>`;
      return;
    }

    const months = selectedDevice.type === "Printer" ? 3 : 6;
    const nextDate = addMonths(date, months);

    host.innerHTML = `
      <strong>Jadwal berikutnya: ${esc(formatDate(nextDate))}</strong>
      <div>
        ${esc(selectedDevice.type)} — Perawatan setiap ${months} bulan.
      </div>`;
  }

  function closeModal() {
    if (modalElement) {
      modalElement.remove();
      modalElement = null;
    }

    selectedDevice = null;
  }

  window.MaintenancePage = {
    render: render
  };
})();
