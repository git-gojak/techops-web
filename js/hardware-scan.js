
(function () {
  "use strict";

  const ENDPOINT = "http://127.0.0.1:47831";
  const STYLE_ID = "techops-hardware-scan-style";

  const state = () => window.TechOpsState;

  // Seluruh data pemindaian harus memiliki pasangan kolom Sheet.
  const SCAN_FIELDS = [
    ["komputer", "Computer Name", "computerName"],
    ["merek", "Manufacturer", "manufacturer"],
    ["model", "Model", "model"],
    ["serial", "Asset / Serial ID", "assetSerialID"],
    ["cpu", "CPU", "cpu"],
    ["core", "Core", "core"],
    ["thread", "Thread", "thread"],
    ["ram", "RAM", "ram"],
    ["storage", "Storage", "storage"],
    ["gpu", "GPU", "gpu"],
    ["os", "Operating System", "operatingSystem"]
  ];

  const SHEET_FIELDS = [
    "tahun",
    "komputer",
    "merek",
    "model",
    "serial",
    "cpu",
    "core",
    "thread",
    "ram",
    "storage",
    "gpu",
    "os",
    "pengguna",
    "scan_terakhir",
    "perubahan",
    "status"
  ];

  let currentData = null;
  let currentRecord = null;
  let busy = false;

  function isAdmin() {
    return !!state()?.authenticated;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function normalizeSerial(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      .hwscan-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10050;
        background: rgba(15,23,42,.62);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }

      .hwscan-dialog {
        width: min(760px, 100%);
        max-height: 92vh;
        overflow: auto;
        background: var(--surface,#fff);
        color: var(--text,#172033);
        border: 1px solid var(--border,#e5e7eb);
        border-radius: 18px;
        box-shadow: 0 24px 70px rgba(0,0,0,.25);
      }

      .hwscan-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 22px;
        border-bottom: 1px solid var(--border,#e5e7eb);
      }

      .hwscan-head h2 {
        font-size: 18px;
        margin: 0;
      }

      .hwscan-head p {
        font-size: 12px;
        opacity: .7;
        margin: 5px 0 0;
      }

      .hwscan-close {
        border: 0;
        background: transparent;
        font-size: 25px;
        cursor: pointer;
        color: inherit;
      }

      .hwscan-body {
        padding: 20px 22px;
      }

      .hwscan-status {
        padding: 12px 14px;
        border-radius: 10px;
        background: var(--surface-muted,#f3f4f6);
        font-size: 13px;
        margin-bottom: 16px;
      }

      .hwscan-status.error {
        background: #fef2f2;
        color: #991b1b;
      }

      .hwscan-status.success {
        background: #ecfdf5;
        color: #065f46;
      }

      .hwscan-groups {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .hwscan-group {
        border: 1px solid var(--border,#e5e7eb);
        border-radius: 12px;
        padding: 14px;
        min-width: 0;
      }

      .hwscan-group h3 {
        font-size: 13px;
        margin: 0 0 12px;
      }

      .hwscan-field {
        display: grid;
        grid-template-columns: 125px minmax(0,1fr);
        gap: 10px;
        padding: 8px 0;
        border-top: 1px solid var(--border,#edf0f3);
        font-size: 12px;
      }

      .hwscan-field span {
        opacity: .65;
      }

      .hwscan-field strong {
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      .hwscan-section {
        margin-top: 18px;
        padding: 15px;
        border: 1px solid var(--border,#e5e7eb);
        border-radius: 12px;
      }

      .hwscan-section h3 {
        margin: 0 0 12px;
        font-size: 14px;
      }

      .hwscan-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .hwscan-input {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 12px;
        min-width: 0;
      }

      .hwscan-input span {
        font-weight: 600;
      }

      .hwscan-input input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 11px;
        border: 1px solid var(--border,#d1d5db);
        border-radius: 8px;
        background: var(--surface,#fff);
        color: inherit;
        font: inherit;
      }

      .hwscan-existing {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        font-size: 12px;
      }

      .hwscan-existing div {
        padding: 9px;
        border-radius: 8px;
        background: var(--surface-muted,#f3f4f6);
      }

      .hwscan-existing small {
        display: block;
        opacity: .65;
        margin-bottom: 4px;
      }

      .hwscan-existing strong {
        overflow-wrap: anywhere;
      }

      .hwscan-actions {
        display: flex;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 18px;
      }

      .hwscan-actions button {
        border: 1px solid var(--border,#d1d5db);
        border-radius: 9px;
        padding: 10px 15px;
        background: var(--surface,#fff);
        color: inherit;
        cursor: pointer;
      }

      .hwscan-actions button:disabled {
        opacity: .6;
        cursor: wait;
      }

      .hwscan-actions .primary {
        background: var(--primary,#2563eb);
        border-color: var(--primary,#2563eb);
        color: white;
      }

      .hwscan-note {
        font-size: 11px;
        opacity: .65;
        margin-top: 12px;
      }

      @media(max-width:620px) {
        .hwscan-groups {
          grid-template-columns: 1fr;
        }

        .hwscan-meta,
        .hwscan-existing {
          grid-template-columns: 1fr;
        }

        .hwscan-field {
          grid-template-columns: 112px minmax(0,1fr);
        }

        .hwscan-backdrop {
          padding: 8px;
        }

        .hwscan-dialog {
          max-height: 96vh;
        }

        .hwscan-body {
          padding: 15px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function close() {
    document.querySelector(".hwscan-backdrop")?.remove();
    document.body.classList.remove("modal-open");

    currentData = null;
    currentRecord = null;
    busy = false;
  }

  function getMatchingRecord(serial) {
    const rows = state()?.computers || [];
    const key = normalizeSerial(serial);

    if (!key) return null;

    const matches = rows.filter(row =>
      normalizeSerial(row.serial) === key
    );

    if (matches.length > 1) {
      throw new Error(
        "Serial ID ditemukan lebih dari satu kali di inventaris. Periksa data Sheet terlebih dahulu."
      );
    }

    return matches[0] || null;
  }

  function renderScanFields(data) {
    const fields = SCAN_FIELDS.map(([key, label]) => `
      <div class="hwscan-field">
        <span>${esc(label)}</span>
        <strong>${esc(data[key] || "-")}</strong>
      </div>
    `).join("");

    return `
      <div class="hwscan-groups">
        <section class="hwscan-group">
          <h3>Identitas Perangkat</h3>
          ${fields.split("</div>").slice(0, 4).join("</div>")}
        </section>

        <section class="hwscan-group">
          <h3>Spesifikasi Hardware</h3>
          ${fields.split("</div>").slice(4).join("</div>")}
        </section>
      </div>
    `;
  }

  function renderExistingInfo(row) {
    return `
      <div class="hwscan-existing">
        <div>
          <small>Tahun Perolehan</small>
          <strong>${esc(row.tahun || "-")}</strong>
        </div>
        <div>
          <small>Pengguna</small>
          <strong>${esc(row.pengguna || "-")}</strong>
        </div>
        <div>
          <small>Status</small>
          <strong>${esc(row.status || "-")}</strong>
        </div>
        <div>
          <small>Perubahan</small>
          <strong>${esc(row.perubahan || "-")}</strong>
        </div>
      </div>
    `;
  }

  function renderResults(data, row) {
    currentData = data;
    currentRecord = row;

    const isExisting = !!row;

    const inventorySection = isExisting
      ? `
        <section class="hwscan-section">
          <h3>Data Inventaris Terdaftar</h3>
          ${renderExistingInfo(row)}
          <p class="hwscan-note">
            Tahun Perolehan, Pengguna, Perubahan, dan Status akan dipertahankan.
          </p>
        </section>
      `
      : `
        <section class="hwscan-section">
          <h3>Data Komputer Baru</h3>
          <div class="hwscan-meta">
            <label class="hwscan-input">
              <span>Tahun Perolehan *</span>
              <input
                type="number"
                id="hwscanTahun"
                min="1900"
                max="2100"
                step="1"
                placeholder="Contoh: 2026"
                required
              >
            </label>

            <label class="hwscan-input">
              <span>Pengguna *</span>
              <input
                type="text"
                id="hwscanPengguna"
                placeholder="Contoh: BAK-LABIB"
                required
              >
            </label>
          </div>
        </section>
      `;

    return `
      <div class="hwscan-status success">
        Scan berhasil. ${isExisting
          ? "Komputer sudah terdaftar di inventaris."
          : "Komputer belum ditemukan di inventaris."}
      </div>

      ${renderScanFields(data)}

      <p class="hwscan-note">
        Waktu Scan: ${esc(data.scan_terakhir || "-")}
      </p>

      ${inventorySection}

      <div class="hwscan-actions">
        <button type="button" data-hwscan-close>Tutup</button>
        <button type="button" data-hwscan-again>Scan Ulang</button>
        <button type="button" class="primary" id="hwscanSave">
          ${isExisting ? "Simpan Pembaruan" : "Simpan Komputer Baru"}
        </button>
      </div>
    `;
  }

  async function runScan(body) {
    if (!isAdmin()) {
      body.innerHTML = `
        <div class="hwscan-status error">
          Silakan login sebagai Admin untuk menjalankan pemindaian.
        </div>
      `;
      return;
    }

    body.innerHTML = `
      <div class="hwscan-status">
        Menghubungi Hardware Scanner dan membaca spesifikasi komputer...
      </div>
    `;

    try {
      const response = await fetch(`${ENDPOINT}/scan`, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        credentials: "omit"
      });

      if (!response.ok) {
        throw new Error(
          `Collector merespons HTTP ${response.status}.`
        );
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(
          result.message || "Hasil scan tidak valid."
        );
      }

      const source = result.data;

      const data = {};

      SCAN_FIELDS.forEach(([sheetKey, label, sourceKey]) => {
        data[sheetKey] = String(source[sourceKey] ?? "").trim();
      });

      data.scan_terakhir = String(
        source.scannedAt || new Date().toISOString()
      );

      if (!data.serial) {
        throw new Error(
          "Serial ID tidak terbaca. Data tidak dapat dicocokkan dengan inventaris."
        );
      }

      // Ambil data inventaris terbaru sebelum menentukan create/update.
      if (window.ComputersPage?.refresh) {
        await window.ComputersPage.refresh();
      }

      const row = getMatchingRecord(data.serial);

      body.innerHTML = renderResults(data, row);

      bindResultActions(body);

      if (window.lucide) {
        window.lucide.createIcons();
      }

    } catch (error) {
      body.innerHTML = `
        <div class="hwscan-status error">
          <strong>Gagal menjalankan pemindaian.</strong>
          <p>${esc(error.message)}</p>
          <p>
            Pastikan PowerShell Scanner aktif di komputer ini.
          </p>
          <code>irm "https://raw.githubusercontent.com/git-gojak/techops-web/main/log.ps1" | iex</code>
        </div>

        <div class="hwscan-actions">
          <button type="button" data-hwscan-close>Tutup</button>
          <button type="button" class="primary" data-hwscan-again>
            Coba Lagi
          </button>
        </div>
      `;

      bindResultActions(body);
    }
  }

  function bindResultActions(body) {
    body.querySelector("[data-hwscan-close]")
      ?.addEventListener("click", close);

    body.querySelector("[data-hwscan-again]")
      ?.addEventListener("click", () => runScan(body));

    body.querySelector("#hwscanSave")
      ?.addEventListener("click", saveResult);
  }

  function buildSaveData() {
    const data = {};

    // Seluruh kolom Sheet disiapkan dengan struktur yang konsisten.
    SHEET_FIELDS.forEach(key => {
      data[key] = "";
    });

    // Data spesifikasi hasil pemindaian.
    SCAN_FIELDS.forEach(([key]) => {
      data[key] = currentData[key] || "";
    });

    data.scan_terakhir = currentData.scan_terakhir;

    if (currentRecord) {
      // Pertahankan data inventaris yang bukan berasal dari scanner.
      data.tahun = currentRecord.tahun || "";
      data.pengguna = currentRecord.pengguna || "";
      data.perubahan = currentRecord.perubahan || "";
      data.status = currentRecord.status || "Aktif";
    } else {
      const tahun = document
        .getElementById("hwscanTahun")?.value.trim();

      const pengguna = document
        .getElementById("hwscanPengguna")?.value.trim();

      if (!tahun || !pengguna) {
        throw new Error(
          "Tahun Perolehan dan Pengguna wajib diisi."
        );
      }

      const year = Number(tahun);

      if (
        !Number.isInteger(year) ||
        year < 1900 ||
        year > 2100
      ) {
        throw new Error("Tahun Perolehan tidak valid.");
      }

      data.tahun = String(year);
      data.pengguna = pengguna;
      data.perubahan = "";
      data.status = "Aktif";
    }

    return data;
  }

  async function saveResult() {
    if (!isAdmin()) {
      alert("Silakan login sebagai Admin.");
      return;
    }

    if (busy || !currentData) return;

    const button = document.getElementById("hwscanSave");
    const isExisting = !!currentRecord;

    try {
      const data = buildSaveData();

      const confirmed = confirm(
        isExisting
          ? `Simpan pembaruan spesifikasi komputer ${data.komputer}?`
          : `Tambahkan komputer ${data.komputer} ke inventaris?`
      );

      if (!confirmed) return;

      busy = true;

      if (button) {
        button.disabled = true;
        button.textContent = "Menyimpan...";
      }

      const action = isExisting
        ? "computers.update"
        : "computers.create";

      const result = await window.TechOpsAPI.request(action, {
        data: data
      });

      if (!result || result.success !== true) {
        throw new Error(
          result?.message || "Gagal menyimpan data komputer."
        );
      }

      if (window.ComputersPage?.refresh) {
        await window.ComputersPage.refresh();
      }

      const body = document.querySelector(".hwscan-body");

      if (body) {
        body.innerHTML = `
          <div class="hwscan-status success">
            <strong>
              ${isExisting
                ? "Pembaruan komputer berhasil disimpan."
                : "Komputer baru berhasil ditambahkan."}
            </strong>
            <p>${esc(data.komputer)} — ${esc(data.serial)}</p>
          </div>

          <div class="hwscan-actions">
            <button type="button" class="primary" data-hwscan-close>
              Selesai
            </button>
          </div>
        `;

        body.querySelector("[data-hwscan-close]")
          ?.addEventListener("click", close);
      }

    } catch (error) {
      alert(error.message || "Gagal menyimpan data.");

      if (button) {
        button.disabled = false;
        button.textContent = isExisting
          ? "Simpan Pembaruan"
          : "Simpan Komputer Baru";
      }

    } finally {
      busy = false;
    }
  }

  function open() {
    if (!isAdmin()) {
      alert("Silakan login sebagai Admin.");
      return;
    }

    addStyles();
    close();

    const backdrop = document.createElement("div");
    backdrop.className = "hwscan-backdrop";

    backdrop.innerHTML = `
      <section
        class="hwscan-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hwscan-title"
      >
        <header class="hwscan-head">
          <div>
            <h2 id="hwscan-title">Scan Spesifikasi Komputer</h2>
            <p>GoJak TechOps Hardware Scanner</p>
          </div>

          <button
            class="hwscan-close"
            type="button"
            aria-label="Tutup"
          >&times;</button>
        </header>

        <div class="hwscan-body">
          <div class="hwscan-status">
            Menyiapkan pemindaian...
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(backdrop);
    document.body.classList.add("modal-open");

    backdrop.querySelector(".hwscan-close")
      .addEventListener("click", close);

    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) close();
    });

    runScan(backdrop.querySelector(".hwscan-body"));
  }

  window.TechOpsHardwareScan = {
    open,
    close
  };

})();
