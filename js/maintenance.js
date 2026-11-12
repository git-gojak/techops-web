
(function () {
  "use strict";

  const ui = () => window.TechOpsUI;
  const state = () => window.TechOpsState;

  let currentDevices = [];
  let selectedDevice = null;

  function isAdmin() {
    return !!state().authenticated;
  }

  function getValue(obj, keys) {
    if (!obj) return "";

    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return String(obj[key]);
      }
    }

    const normalized = {};
    Object.keys(obj).forEach(key => {
      normalized[key.toLowerCase().replace(/[\s_-]/g, "")] = obj[key];
    });

    for (const key of keys) {
      const value = normalized[key.toLowerCase().replace(/[\s_-]/g, "")];
      if (value !== undefined && value !== null && value !== "") {
        return String(value);
      }
    }

    return "";
  }

  function getDevices() {
    const computers = Array.isArray(state().computers)
      ? state().computers
      : [];

    const printers = Array.isArray(state().printers)
      ? state().printers
      : [];

    const result = [];

    computers.forEach((item, index) => {
      result.push({
        key: `computer-${index}`,
        type: "Komputer",
        name: getValue(item, [
          "Computer Name", "computer_name", "computerName", "nama_aset"
        ]),
        serial: getValue(item, [
          "Asset/Serial ID", "Asset Serial ID", "serial",
          "asset_id", "serial_number"
        ]),
        manufacturer: getValue(item, ["Manufacturer", "manufacturer"]),
        model: getValue(item, ["Model", "model"]),
        unit: getValue(item, ["Pengguna", "Unit", "unit"]),
        source: item
      });
    });

    printers.forEach((item, index) => {
      result.push({
        key: `printer-${index}`,
        type: "Printer",
        name: getValue(item, [
          "nama_aset", "Nama Printer", "printer_name",
          "model", "Model"
        ]),
        serial: getValue(item, [
          "sn_asset", "SN/Asset", "serial", "Serial Number"
        ]),
        manufacturer: getValue(item, ["manufacturer", "Manufacturer"]),
        model: getValue(item, ["model", "Model"]),
        unit: getValue(item, ["Unit", "unit"]),
        source: item
      });
    });

    return result.filter(item => item.name || item.serial);
  }

  function render() {
    const host = ui().$("#appContent");
    const rows = Array.isArray(state().maintenance)
      ? state().maintenance
      : [];

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
            >
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="badge">${rows.length} riwayat</span>
            ${
              isAdmin()
                ? `<button class="button button-primary" id="addMaintenance">
                    <i data-lucide="plus"></i>
                    Catat Maintenance
                  </button>`
                : ""
            }
          </div>
        </div>
        <div id="maintenanceTable"></div>
      </section>`;

    ui().$("#maintenanceSearch").addEventListener("input", event => {
      drawTable(event.target.value);
    });

    if (isAdmin()) {
      ui().$("#addMaintenance").addEventListener("click", openForm);
    }

    drawTable("");
    ui().bindRefresh();
    ui().iconRefresh();
  }

  function drawTable(query) {
    const all = Array.isArray(state().maintenance)
      ? state().maintenance
      : [];

    const q = String(query || "").toLowerCase();

    const rows = all.filter(row =>
      [
        "Tanggal",
        "jenis_aset",
        "nama_aset",
        "serial",
        "kegiatan",
        "kondisi",
        "keterangan",
        "teknisi",
        "jadwal"
      ].some(key =>
        String(row[key] ?? "").toLowerCase().includes(q)
      )
    );

    const host = ui().$("#maintenanceTable");

    if (!rows.length) {
      host.innerHTML =
        `<div class="empty-state">
          Tidak ada riwayat maintenance yang cocok.
        </div>`;
      return;
    }

    host.innerHTML =
      `<div class="table-wrap">
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
                <td>${ui().escapeHTML(formatDate(row.Tanggal))}</td>
                <td>
                  <span class="badge ${
                    String(row.jenis_aset).toLowerCase() === "printer"
                      ? "green"
                      : ""
                  }">
                    ${ui().escapeHTML(row.jenis_aset || "-")}
                  </span>
                </td>
                <td class="primary-cell">
                  ${ui().escapeHTML(row.nama_aset || "-")}
                </td>
                <td>${ui().escapeHTML(row.serial || "-")}</td>
                <td>${ui().escapeHTML(row.kegiatan || "-")}</td>
                <td>${ui().escapeHTML(row.kondisi || "-")}</td>
                <td>${ui().escapeHTML(row.teknisi || "-")}</td>
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

    currentDevices = getDevices();
    selectedDevice = null;

    const today = new Date();
    const dateValue = toInputDate(today);

    const deviceOptions = currentDevices.map(device => `
      <option value="${ui().escapeHTML(device.key)}">
        ${ui().escapeHTML(device.type)} —
        ${ui().escapeHTML(device.name)}
        ${device.serial ? `(${ui().escapeHTML(device.serial)})` : ""}
      </option>
    `).join("");

    const content = `
      <form id="maintenanceForm" class="computer-form">

        <div class="computer-form-intro">
          Identifikasi perangkat terlebih dahulu. Informasi perangkat
          akan diambil otomatis dari inventaris komputer atau printer.
        </div>

        <section class="computer-form-section">
          <div class="computer-section-heading">
            <span class="computer-section-icon">
              <i data-lucide="scan-search"></i>
            </span>
            <div>
              <span class="computer-section-number">01</span>
              <h3>Identifikasi Perangkat</h3>
            </div>
          </div>

          <div class="computer-form-grid">

            <div class="computer-form-field computer-field-wide">
              <label class="computer-field-label" for="maintenanceQr">
                QR / Barcode / Serial / Asset ID
              </label>
              <input
                id="maintenanceQr"
                type="text"
                placeholder="Masukkan kode QR, serial, atau Asset ID"
                autocomplete="off"
              >
              <small class="computer-field-hint">
                Masukkan kode dari label perangkat untuk mencari
                data inventaris.
              </small>
            </div>

            <div class="computer-form-field computer-field-wide">
              <label class="computer-field-label" for="maintenanceDevice">
                Pilih Perangkat <span class="computer-form-required">*</span>
              </label>
              <select id="maintenanceDevice" required>
                <option value="">Pilih komputer atau printer</option>
                ${deviceOptions}
              </select>
            </div>

            <div class="computer-form-field">
              <label class="computer-field-label">Jenis Aset</label>
              <input id="maintenanceAssetType" type="text" readonly
                placeholder="Otomatis dari inventaris">
            </div>

            <div class="computer-form-field">
              <label class="computer-field-label">Nama Perangkat</label>
              <input id="maintenanceAssetName" type="text" readonly
                placeholder="Otomatis dari inventaris">
            </div>

            <div class="computer-form-field">
              <label class="computer-field-label">Serial / Asset ID</label>
              <input id="maintenanceSerial" type="text" readonly
                placeholder="Otomatis dari inventaris">
            </div>

            <div class="computer-form-field">
              <label class="computer-field-label">Unit / Pengguna</label>
              <input id="maintenanceUnit" type="text" readonly
                placeholder="Otomatis dari inventaris">
            </div>

          </div>
        </section>

        <section class="computer-form-section">
          <div class="computer-section-heading">
            <span class="computer-section-icon">
              <i data-lucide="clipboard-list"></i>
            </span>
            <div>
              <span class="computer-section-number">02</span>
              <h3>Detail Maintenance</h3>
            </div>
          </div>

          <div class="computer-form-grid">

            <div class="computer-form-field">
              <label class="computer-field-label" for="maintenanceDate">
                Tanggal <span class="computer-form-required">*</span>
              </label>
              <input id="maintenanceDate" type="date"
                value="${dateValue}" required>
            </div>

            <div class="computer-form-field">
              <label class="computer-field-label" for="maintenanceActivity">
                Jenis Kegiatan <span class="computer-form-required">*</span>
              </label>
              <select id="maintenanceActivity" required>
                <option value="">Pilih kegiatan</option>
                <option value="Perawatan">Perawatan</option>
                <option value="Perbaikan">Perbaikan</option>
              </select>
            </div>

            <div class="computer-form-field computer-field-wide">
              <label class="computer-field-label" for="maintenanceDescription">
                Uraian Kegiatan <span class="computer-form-required">*</span>
              </label>
              <textarea
                id="maintenanceDescription"
                rows="3"
                placeholder="Tuliskan tindakan perawatan atau perbaikan yang dilakukan"
                required
              ></textarea>
            </div>

            <div class="computer-form-field">
              <label class="computer-field-label" for="maintenanceCondition">
                Kondisi Perangkat
              </label>
              <select id="maintenanceCondition">
                <option value="">Pilih kondisi</option>
                <option value="Baik">Baik</option>
                <option value="Perlu Perhatian">Perlu Perhatian</option>
                <option value="Rusak">Rusak</option>
              </select>
            </div>

            <div class="computer-form-field">
              <label class="computer-field-label" for="maintenanceRefill">
                Refill
              </label>
              <select id="maintenanceRefill">
                <option value="T">Tidak</option>
                <option value="Y">Ya</option>
              </select>
            </div>

            <div class="computer-form-field computer-field-wide">
              <label class="computer-field-label" for="maintenanceNotes">
                Keterangan Tambahan
              </label>
              <textarea
                id="maintenanceNotes"
                rows="3"
                placeholder="Keterangan tambahan (opsional)"
              ></textarea>
            </div>

          </div>
        </section>

        <section class="computer-form-section">
          <div class="computer-section-heading">
            <span class="computer-section-icon">
              <i data-lucide="user-cog"></i>
            </span>
            <div>
              <span class="computer-section-number">03</span>
              <h3>Teknisi dan Jadwal</h3>
            </div>
          </div>

          <div class="computer-form-grid">

            <div class="computer-form-field">
              <label class="computer-field-label" for="maintenanceHandlerType">
                Penanganan Oleh
              </label>
              <select id="maintenanceHandlerType">
                <option value="Teknisi">Teknisi</option>
                <option value="Vendor">Vendor</option>
              </select>
            </div>

            <div class="computer-form-field">
              <label class="computer-field-label" for="maintenanceTechnician">
                Nama Teknisi / Vendor
                <span class="computer-form-required">*</span>
              </label>
              <input
                id="maintenanceTechnician"
                type="text"
                placeholder="Masukkan nama teknisi atau vendor"
                required
              >
            </div>

            <div class="computer-form-field computer-field-wide">
              <label class="computer-field-label" for="maintenanceSchedule">
                Jadwal Maintenance Berikutnya
              </label>
              <input
                id="maintenanceSchedule"
                type="date"
                readonly
                placeholder="Dihitung otomatis"
              >
              <small class="computer-field-hint">
                Perawatan komputer: 6 bulan. Perawatan printer: 3 bulan.
                Perbaikan tidak membuat jadwal otomatis.
              </small>
            </div>

          </div>
        </section>

        <div id="maintenanceFormMessage" class="computer-form-message"></div>

        <div class="computer-form-footer">
          <button type="button" class="button button-secondary"
            id="maintenanceCancel">
            Batal
          </button>
          <button type="submit" class="button button-primary">
            <i data-lucide="save"></i>
            Simpan Maintenance
          </button>
        </div>

      </form>
    `;

    showModal("Catat Maintenance", content, "computer-modal");
    bindFormEvents();
  }

  function showModal(title, content, variant) {
    closeModal();

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "maintenanceModal";

    backdrop.innerHTML = `
      <section class="modal ${variant || ""}">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-title-eyebrow">
              GOJAK TECHOPS · ASSET MANAGEMENT
            </span>
            <h2>${ui().escapeHTML(title)}</h2>
          </div>
          <button type="button" class="icon-button"
            id="maintenanceModalClose" aria-label="Tutup">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </section>
    `;

    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) closeModal();
    });

    backdrop.querySelector("#maintenanceModalClose")
      .addEventListener("click", closeModal);

    ui().iconRefresh();
  }

  function closeModal() {
    const modal = document.getElementById("maintenanceModal");
    if (modal) modal.remove();
  }

  function bindFormEvents() {
    const form = document.getElementById("maintenanceForm");
    const deviceSelect = document.getElementById("maintenanceDevice");
    const qrInput = document.getElementById("maintenanceQr");
    const activity = document.getElementById("maintenanceActivity");
    const date = document.getElementById("maintenanceDate");

    deviceSelect.addEventListener("change", () => {
      selectedDevice =
        currentDevices.find(item => item.key === deviceSelect.value) || null;
      fillDeviceFields();
      updateSchedule();
    });

    qrInput.addEventListener("input", () => {
      const query = qrInput.value.trim().toLowerCase();
      if (!query) return;

      const found = currentDevices.find(device => {
        return [device.name, device.serial]
          .some(value => String(value || "").toLowerCase() === query);
      });

      if (found) {
        deviceSelect.value = found.key;
        selectedDevice = found;
        fillDeviceFields();
        updateSchedule();
      }
    });

    activity.addEventListener("change", updateSchedule);
    date.addEventListener("change", updateSchedule);

    document.getElementById("maintenanceCancel")
      .addEventListener("click", closeModal);

    form.addEventListener("submit", event => {
      event.preventDefault();

      const message =
        document.getElementById("maintenanceFormMessage");

      if (!selectedDevice) {
        message.textContent = "Pilih perangkat dari inventaris terlebih dahulu.";
        return;
      }

      if (!form.reportValidity()) return;

      message.textContent =
        "Formulir tampilan sudah siap. Penyimpanan backend belum diaktifkan pada tahap ini.";
    });
  }

  function fillDeviceFields() {
    document.getElementById("maintenanceAssetType").value =
      selectedDevice?.type || "";

    document.getElementById("maintenanceAssetName").value =
      selectedDevice?.name || "";

    document.getElementById("maintenanceSerial").value =
      selectedDevice?.serial || "";

    document.getElementById("maintenanceUnit").value =
      selectedDevice?.unit || "";
  }

  function updateSchedule() {
    const activity =
      document.getElementById("maintenanceActivity").value;

    const dateValue =
      document.getElementById("maintenanceDate").value;

    const output =
      document.getElementById("maintenanceSchedule");

    output.value = "";

    if (!selectedDevice || activity !== "Perawatan" || !dateValue) {
      return;
    }

    const months = selectedDevice.type === "Komputer" ? 6 : 3;
    output.value = addMonthsClamped(dateValue, months);
  }

  function addMonthsClamped(value, months) {
    const parts = value.split("-").map(Number);
    const year = parts[0];
    const month = parts[1] - 1;
    const day = parts[2];

    const targetMonth = month + months;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;

    const lastDay = new Date(
      targetYear,
      normalizedMonth + 1,
      0
    ).getDate();

    const result = new Date(
      targetYear,
      normalizedMonth,
      Math.min(day, lastDay)
    );

    return toInputDate(result);
  }

  function toInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        });
  }

  window.MaintenancePage = { render };
})();
