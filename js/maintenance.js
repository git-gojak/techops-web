
(function () {
  "use strict";

  const ui = () => window.TechOpsUI;
  const state = () => window.TechOpsState;
  const api = () => window.TechOpsAPI;

  let selectedDevice = null;
  let qrScanner = null;
  let scannerStarting = false;

  // =====================================================
  // UTILITAS
  // =====================================================

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

  // =====================================================
  // HALAMAN UTAMA
  // =====================================================

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
                ? `<button class="button button-primary" id="scanMaintenanceQR">
                    <i data-lucide="scan-qr-code"></i>
                    Scan QR
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
      ui().$("#scanMaintenanceQR").addEventListener("click", openScanner);
    }

    drawTable("");

    ui().bindRefresh();
    ui().iconRefresh();
  }

  // =====================================================
  // TABEL RIWAYAT
  // =====================================================

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
              <th>KETERANGAN</th>
              <th>KONDISI</th>
              <th>PENANGANAN</th>
            </tr>
          </thead>

          <tbody>
            ${rows.map(row => `
              <tr>
                <td>
                  ${ui().escapeHTML(formatDate(row.Tanggal))}
                </td>

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

                <td>
                  ${ui().escapeHTML(row.serial || "-")}
                </td>

                <td>
                  ${ui().escapeHTML(row.kegiatan || "-")}
                </td>

                <td>
                  ${ui().escapeHTML(row.keterangan || "-")}
                </td>

                <td>
                  ${ui().escapeHTML(row.kondisi || "-")}
                </td>

                <td>
                  ${ui().escapeHTML(row.teknisi || "-")}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="table-footer">
        <span>
          Menampilkan ${rows.length} dari ${all.length} riwayat
        </span>
      </div>`;
  }

  // =====================================================
  // SCAN QR
  // =====================================================

  function openScanner() {
    if (!isAdmin()) return;

    selectedDevice = null;

    const content = `
      <div style="padding:4px 0 12px">

        <p style="margin:0 0 14px;color:var(--text-secondary)">
          Arahkan kamera ke QR Code komputer atau printer.
        </p>

        <div
          id="maintenanceQrReader"
          style="
            width:100%;
            max-width:440px;
            margin:0 auto;
            overflow:hidden;
            border-radius:12px;
            background:#111;
          "
        ></div>

        <div
          id="maintenanceScanMessage"
          style="
            margin-top:14px;
            text-align:center;
            font-size:13px;
            color:var(--text-secondary);
          "
        >
          Menyiapkan kamera...
        </div>

      </div>
    `;

    showModal("Scan QR Perangkat", content, "computer-modal");

    startScanner();
  }

  async function startScanner() {
    const message = document.getElementById("maintenanceScanMessage");

    if (!message) return;

    if (!window.Html5Qrcode) {
      message.textContent = "Library QR Scanner tidak ditemukan.";
      return;
    }

    if (scannerStarting) return;

    scannerStarting = true;

    try {
      qrScanner = new Html5Qrcode("maintenanceQrReader");

      await qrScanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1
        },
        async decodedText => {
          if (!qrScanner) return;

          await stopScanner();

          const currentMessage = document.getElementById(
            "maintenanceScanMessage"
          );

          if (currentMessage) {
            currentMessage.textContent =
              "QR terbaca. Memeriksa inventaris...";
          }

          await lookupDevice(decodedText);
        },
        () => {}
      );

      if (document.getElementById("maintenanceScanMessage")) {
        message.textContent =
          "Kamera aktif. Silakan scan QR perangkat.";
      }

    } catch (error) {
      message.textContent =
        "Kamera tidak dapat dibuka. Periksa izin kamera browser.";

      console.error("Maintenance QR scanner:", error);

    } finally {
      scannerStarting = false;
    }
  }

  async function stopScanner() {
    if (!qrScanner) return;

    const scanner = qrScanner;
    qrScanner = null;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }

      await scanner.clear();

    } catch (error) {
      console.warn("QR scanner stop:", error);
    }
  }

  // =====================================================
  // PENCARIAN PERANGKAT MELALUI QR INFO
  // =====================================================

  async function lookupDevice(qrText) {
    const message = document.getElementById(
      "maintenanceScanMessage"
    );

    try {
      const result = await api().get("qr.info", {
        qr: String(qrText || "").trim()
      });

      if (!result || result.success === false || !result.perangkat) {
        throw new Error(
          result?.message ||
          "Perangkat tidak ditemukan dalam inventaris."
        );
      }

      const assetType = String(
        result.jenis_aset || ""
      ).toLowerCase();

      if (
        assetType !== "komputer" &&
        assetType !== "printer"
      ) {
        throw new Error("Jenis perangkat tidak dikenali.");
      }

      const device = result.perangkat;

      selectedDevice = {
        type: assetType === "komputer"
          ? "Komputer"
          : "Printer",

        serial: getValue(device, [
          "serial",
          "Asset/Serial ID",
          "Asset Serial ID",
          "asset_id",
          "sn_asset",
          "Serial Number"
        ]),

        name: assetType === "komputer"
          ? getValue(device, [
              "komputer",
              "Computer Name",
              "computer_name",
              "computerName",
              "nama_aset"
            ])
          : [
              getValue(device, [
                "merek",
                "manufacturer",
                "Manufacturer"
              ]),
              getValue(device, ["model", "Model"])
            ].filter(Boolean).join(" "),

        manufacturer: getValue(device, [
          "merek",
          "manufacturer",
          "Manufacturer"
        ]),

        model: getValue(device, [
          "model",
          "Model"
        ]),

        pengguna: getValue(device, [
          "pengguna",
          "Pengguna"
        ]),

        unit: getValue(device, [
          "unit",
          "Unit"
        ])
      };

      if (!selectedDevice.serial) {
        throw new Error("Serial perangkat tidak ditemukan.");
      }

      showDeviceConfirmation();

    } catch (error) {
      console.error("QR lookup:", error);

      if (message) {
        message.innerHTML = `
          <span style="color:var(--danger,#dc2626)">
            ${ui().escapeHTML(
              error.message || "Gagal memeriksa QR."
            )}
          </span>

          <div style="margin-top:12px">
            <button
              type="button"
              class="button button-secondary"
              id="maintenanceScanAgain"
            >
              Scan Ulang
            </button>
          </div>
        `;

        document.getElementById("maintenanceScanAgain")
          .addEventListener("click", openScanner);
      }
    }
  }

  // =====================================================
  // KONFIRMASI IDENTITAS PERANGKAT
  // =====================================================

  function showDeviceConfirmation() {
    const device = selectedDevice;

    if (!device) return;

    let details = "";

    if (device.type === "Komputer") {
      details = `
        <div class="computer-form-field">
          <label class="computer-field-label">Serial</label>
          <input
            type="text"
            readonly
            value="${ui().escapeHTML(device.serial)}"
          >
        </div>

        <div class="computer-form-field">
          <label class="computer-field-label">Merek</label>
          <input
            type="text"
            readonly
            value="${ui().escapeHTML(device.manufacturer || "-")}"
          >
        </div>

        <div class="computer-form-field computer-field-wide">
          <label class="computer-field-label">Pengguna</label>
          <input
            type="text"
            readonly
            value="${ui().escapeHTML(device.pengguna || "-")}"
          >
        </div>
      `;

    } else {
      details = `
        <div class="computer-form-field">
          <label class="computer-field-label">Unit</label>
          <input
            type="text"
            readonly
            value="${ui().escapeHTML(device.unit || "-")}"
          >
        </div>

        <div class="computer-form-field">
          <label class="computer-field-label">Merek</label>
          <input
            type="text"
            readonly
            value="${ui().escapeHTML(device.manufacturer || "-")}"
          >
        </div>

        <div class="computer-form-field">
          <label class="computer-field-label">Model</label>
          <input
            type="text"
            readonly
            value="${ui().escapeHTML(device.model || "-")}"
          >
        </div>
      `;
    }

    const content = `
      <div class="computer-form-intro">
        QR berhasil dibaca. Pastikan identitas perangkat berikut sudah benar.
      </div>

      <section class="computer-form-section">

        <div class="computer-section-heading">
          <span class="computer-section-icon">
            <i data-lucide="monitor-check"></i>
          </span>

          <div>
            <span class="computer-section-number">
              PERANGKAT DITEMUKAN
            </span>
            <h3>${ui().escapeHTML(device.type)}</h3>
          </div>
        </div>

        <div class="computer-form-grid">
          ${details}
        </div>

      </section>

      <div class="computer-form-footer">

        <button
          type="button"
          class="button button-secondary"
          id="maintenanceRescan"
        >
          Scan Ulang
        </button>

        <button
          type="button"
          class="button button-primary"
          id="maintenanceContinue"
        >
          Lanjutkan ke Maintenance
        </button>

      </div>
    `;

    showModal(
      "Konfirmasi Perangkat",
      content,
      "computer-modal"
    );

    document.getElementById("maintenanceRescan")
      .addEventListener("click", openScanner);

    document.getElementById("maintenanceContinue")
      .addEventListener("click", () => openForm(device));
  }

  // =====================================================
  // FORM MAINTENANCE
  // =====================================================

  function openForm(device) {
    if (!isAdmin() || !device) return;

    selectedDevice = device;

    const dateValue = toInputDate(new Date());

    const content = `
      <form id="maintenanceForm" class="computer-form">

        <div class="computer-form-intro">
          Perangkat sudah teridentifikasi dari inventaris.
          Silakan isi detail kegiatan maintenance.
        </div>

        <!-- IDENTITAS PERANGKAT -->

        <section class="computer-form-section">

          <div class="computer-section-heading">
            <span class="computer-section-icon">
              <i data-lucide="monitor-check"></i>
            </span>

            <div>
              <span class="computer-section-number">01</span>
              <h3>Identitas Perangkat</h3>
            </div>
          </div>

          <div class="computer-form-grid">

            <div class="computer-form-field">
              <label class="computer-field-label">
                Jenis Aset
              </label>

              <input
                type="text"
                readonly
                value="${ui().escapeHTML(device.type)}"
              >
            </div>

            <div class="computer-form-field">
              <label class="computer-field-label">
                Serial
              </label>

              <input
                type="text"
                readonly
                value="${ui().escapeHTML(device.serial)}"
              >
            </div>

            <div class="computer-form-field computer-field-wide">
              <label class="computer-field-label">
                Nama Perangkat
              </label>

              <input
                type="text"
                readonly
                value="${ui().escapeHTML(
                  device.name || device.model || "-"
                )}"
              >
            </div>

          </div>
        </section>

        <!-- DETAIL MAINTENANCE -->

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
              <label
                class="computer-field-label"
                for="maintenanceDate"
              >
                Tanggal
                <span class="computer-form-required">*</span>
              </label>

              <input
                id="maintenanceDate"
                type="date"
                value="${dateValue}"
                required
              >
            </div>

            <!-- JENIS KEGIATAN -->

            <div class="computer-form-field computer-field-wide">

              <label class="computer-field-label">
                Jenis Kegiatan
                <span class="computer-form-required">*</span>
              </label>

              <div style="display:flex;gap:22px;flex-wrap:wrap">

                <label>
                  <input
                    type="radio"
                    name="maintenanceActivity"
                    value="Perawatan"
                    checked
                  >
                  Perawatan
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceActivity"
                    value="Perbaikan"
                  >
                  Perbaikan
                </label>

              </div>
            </div>

            <!-- JENIS KERUSAKAN -->

            <div
              class="computer-form-field computer-field-wide"
              id="maintenanceRepairTypeWrap"
              style="display:none"
            >

              <label
                class="computer-field-label"
                for="maintenanceRepairType"
              >
                Jenis Kerusakan
                <span class="computer-form-required">*</span>
              </label>

              <select id="maintenanceRepairType">
                <option value="">Pilih jenis kerusakan</option>
                <option value="Hardware">Hardware</option>
                <option value="Software">Software</option>
              </select>

            </div>

            <!-- KETERANGAN -->

            <div class="computer-form-field computer-field-wide">

              <label
                class="computer-field-label"
                for="maintenanceNotes"
              >
                Keterangan
                <span class="computer-form-required">*</span>
              </label>

              <textarea
                id="maintenanceNotes"
                rows="3"
                placeholder="Tuliskan pekerjaan perawatan yang dilakukan"
                required
              ></textarea>

            </div>

            <!-- KONDISI -->

            <div class="computer-form-field computer-field-wide">

              <label class="computer-field-label">
                Kondisi Perangkat
                <span class="computer-form-required">*</span>
              </label>

              <div style="display:flex;gap:22px;flex-wrap:wrap">

                <label>
                  <input
                    type="radio"
                    name="maintenanceCondition"
                    value="Baik"
                    required
                  >
                  Baik
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceCondition"
                    value="Perlu Perhatian"
                    required
                  >
                  Perlu Perhatian
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceCondition"
                    value="Rusak"
                    required
                  >
                  Rusak
                </label>

              </div>
            </div>

            <!-- REFILL -->

            <div class="computer-form-field computer-field-wide">

              <label class="computer-field-label">
                Refill
              </label>

              <div style="display:flex;gap:22px;flex-wrap:wrap">

                <label>
                  <input
                    type="radio"
                    name="maintenanceRefill"
                    value="T"
                    checked
                  >
                  Tidak
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceRefill"
                    value="Y"
                  >
                  Ya
                </label>

              </div>
            </div>

          </div>
        </section>

        <!-- PENANGANAN DAN JADWAL -->

        <section class="computer-form-section">

          <div class="computer-section-heading">
            <span class="computer-section-icon">
              <i data-lucide="calendar-clock"></i>
            </span>

            <div>
              <span class="computer-section-number">03</span>
              <h3>Penanganan dan Jadwal</h3>
            </div>
          </div>

          <div class="computer-form-grid">

            <div class="computer-form-field computer-field-wide">

              <label class="computer-field-label">
                Penanganan
              </label>

              <div style="display:flex;gap:22px;flex-wrap:wrap">

                <label>
                  <input
                    type="radio"
                    name="maintenanceHandler"
                    value="Teknisi"
                    checked
                  >
                  Teknisi
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceHandler"
                    value="Vendor"
                  >
                  Vendor
                </label>

              </div>
            </div>

            <div class="computer-form-field computer-field-wide">

              <label
                class="computer-field-label"
                for="maintenanceSchedule"
              >
                Jadwal Maintenance Berikutnya
              </label>

              <input
                id="maintenanceSchedule"
                type="date"
                readonly
                placeholder="Dihitung otomatis"
              >

              <small class="computer-field-hint">
                Komputer: 6 bulan. Printer: 3 bulan.
                Perbaikan tidak memiliki jadwal berikutnya.
              </small>

            </div>

          </div>
        </section>

        <div
          id="maintenanceFormMessage"
          class="computer-form-message"
        ></div>

        <div class="computer-form-footer">

          <button
            type="submit"
            class="button button-primary"
            id="maintenanceSubmit"
          >
            <i data-lucide="save"></i>
            Simpan Maintenance
          </button>

        </div>

      </form>
    `;

    showModal(
      "Catat Maintenance",
      content,
      "computer-modal"
    );

    bindFormEvents();
    updateActivityFields();
    updateSchedule();
  }

  // =====================================================
  // MODAL
  // =====================================================

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

          <button
            type="button"
            class="icon-button"
            id="maintenanceModalClose"
            aria-label="Tutup"
          >
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
      if (event.target === backdrop) {
        closeModal();
      }
    });

    backdrop.querySelector("#maintenanceModalClose")
      .addEventListener("click", closeModal);

    ui().iconRefresh();
  }

  function closeModal() {
    stopScanner();

    const modal = document.getElementById("maintenanceModal");

    if (modal) {
      modal.remove();
    }
  }

  // =====================================================
  // EVENT FORM
  // =====================================================

  function bindFormEvents() {
    const form = document.getElementById("maintenanceForm");

    form.querySelectorAll(
      'input[name="maintenanceActivity"], #maintenanceDate'
    ).forEach(input => {
      input.addEventListener("change", () => {
        updateActivityFields();
        updateSchedule();
      });
    });

    form.addEventListener("submit", submitMaintenance);
  }

  // =====================================================
  // TAMPILKAN / SEMBUNYIKAN JENIS KERUSAKAN
  // =====================================================

  function updateActivityFields() {
    const activity = document.querySelector(
      'input[name="maintenanceActivity"]:checked'
    )?.value;

    const wrapper = document.getElementById(
      "maintenanceRepairTypeWrap"
    );

    const repairType = document.getElementById(
      "maintenanceRepairType"
    );

    const notes = document.getElementById(
      "maintenanceNotes"
    );

    if (!wrapper || !repairType || !notes) return;

    if (activity === "Perbaikan") {
      wrapper.style.display = "";
      repairType.required = true;

      notes.placeholder =
        "Jelaskan detail kerusakan dan tindakan perbaikan";

    } else {
      wrapper.style.display = "none";
      repairType.required = false;
      repairType.value = "";

      notes.placeholder =
        "Tuliskan pekerjaan perawatan yang dilakukan";
    }
  }

  // =====================================================
  // SIMPAN MAINTENANCE
  // =====================================================

  async function submitMaintenance(event) {
    event.preventDefault();

    if (!isAdmin()) {
      showFormMessage(
        "Sesi Admin tidak aktif. Silakan login kembali.",
        true
      );
      return;
    }

    if (!selectedDevice || !selectedDevice.serial) {
      showFormMessage(
        "Perangkat belum teridentifikasi.",
        true
      );
      return;
    }

    const form = document.getElementById("maintenanceForm");

    if (!form.reportValidity()) return;

    const activity = form.querySelector(
      'input[name="maintenanceActivity"]:checked'
    )?.value;

    const condition = form.querySelector(
      'input[name="maintenanceCondition"]:checked'
    )?.value;

    const refill = form.querySelector(
      'input[name="maintenanceRefill"]:checked'
    )?.value || "T";

    const handler = form.querySelector(
      'input[name="maintenanceHandler"]:checked'
    )?.value || "Teknisi";

    const notes = document
      .getElementById("maintenanceNotes")
      .value.trim();

    const repairType = document
      .getElementById("maintenanceRepairType")
      .value;

    if (!activity || !condition || !notes) {
      showFormMessage(
        "Lengkapi seluruh kolom wajib.",
        true
      );
      return;
    }

    if (activity === "Perbaikan" && !repairType) {
      showFormMessage(
        "Pilih jenis kerusakan Hardware atau Software.",
        true
      );
      return;
    }

    // Keterangan otomatis:
    // Perawatan = uraian langsung
    // Perbaikan = Hardware/Software + uraian

    const finalNotes = activity === "Perbaikan"
      ? `${repairType} — ${notes}`
      : notes;

    const submitButton = document.getElementById(
      "maintenanceSubmit"
    );

    submitButton.disabled = true;
    submitButton.textContent = "Menyimpan...";

const payload = {
  jenis_aset: selectedDevice.type,
  serial: selectedDevice.serial,
  Tanggal: document.getElementById("maintenanceDate").value,
  jenis_kegiatan: activity,
  kegiatan: activity,
  kondisi: condition,
  keterangan: finalNotes,
  refill: refill,
  teknisi: handler,

  // Jadwal dikirim untuk Perawatan.
  // Untuk Perbaikan nilainya kosong.
  jadwal: activity === "Perawatan"
    ? document.getElementById("maintenanceSchedule").value
    : ""
};

    try {
      await api().request("maintenance.create", {
        data: payload
      });

    } catch (error) {
      showFormMessage(
        error?.message || "Gagal menyimpan maintenance.",
        true
      );

      submitButton.disabled = false;

      submitButton.innerHTML =
        '<i data-lucide="save"></i> Simpan Maintenance';

      ui().iconRefresh();

      return;
    }

    // Penyimpanan berhasil.
    closeModal();

    // Muat ulang riwayat.
    try {
      const latest = await api().get("maintenance.list");

      if (Array.isArray(latest)) {
        state().maintenance = latest;
      }

    } catch (error) {
      console.warn(
        "Refresh riwayat maintenance gagal:",
        error
      );
    }

    // Tampilkan riwayat terbaru.
    render();

    // Siapkan scanner untuk perangkat berikutnya.
    openScanner();
  }

  function showFormMessage(message, isError) {
    const target = document.getElementById(
      "maintenanceFormMessage"
    );

    if (!target) return;

    target.textContent = message;
    target.classList.toggle("error", !!isError);
  }

  // =====================================================
  // JADWAL MAINTENANCE
  // =====================================================

  function updateSchedule() {
    const activity = document.querySelector(
      'input[name="maintenanceActivity"]:checked'
    )?.value;

    const dateValue = document.getElementById(
      "maintenanceDate"
    )?.value;

    const output = document.getElementById(
      "maintenanceSchedule"
    );

    if (!output) return;

    output.value = "";

    if (
      !selectedDevice ||
      activity !== "Perawatan" ||
      !dateValue
    ) {
      return;
    }

    const months = selectedDevice.type === "Komputer"
      ? 6
      : 3;

    output.value = addMonthsClamped(dateValue, months);
  }

  function addMonthsClamped(value, months) {
    const parts = value.split("-").map(Number);

    const year = parts[0];
    const month = parts[1] - 1;
    const day = parts[2];

    const targetMonth = month + months;

    const targetYear =
      year + Math.floor(targetMonth / 12);

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

  // =====================================================
  // FORMAT TANGGAL
  // =====================================================

  function toInputDate(date) {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

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

  // =====================================================
  // EXPORT HALAMAN
  // =====================================================

  window.MaintenancePage = {
    render
  };

})();
