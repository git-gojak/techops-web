
(function () {
  "use strict";

  const ui = () => window.TechOpsUI;
  let scanner = null;
  let scanHandled = false;

  function render() {
    stopScanner();

    const host = ui().$("#appContent");
    host.innerHTML =
      ui().pageHeading(
        "QR Info",
        "Cari informasi perangkat dengan scan QR atau input serial number.",
        "DEVICE LOOKUP"
      ) +
      `<section class="panel">
        <div class="panel-header">
          <div>
            <h2>Pencarian Perangkat</h2>
            <div class="panel-subtitle">Scan QR menggunakan kamera HP atau masukkan serial number secara manual.</div>
          </div>
          <span class="stat-icon green"><i data-lucide="qr-code"></i></span>
        </div>

        <form class="qr-search" id="qrForm">
          <input id="qrValue" autocomplete="off"
            placeholder="Contoh: FCGBZR3 atau RAEK029524" required>
          <button class="button button-primary" type="submit">
            <i data-lucide="search"></i> Cari perangkat
          </button>
          <button class="button button-secondary" type="button" id="scanQrButton">
            <i data-lucide="scan-qr-code"></i> Scan QR
          </button>
        </form>

        <div id="qrScannerPanel" style="display:none;margin-top:18px">
          <div class="panel" style="padding:14px">
            <div class="panel-header">
              <div>
                <h2>Arahkan kamera ke QR Code</h2>
                <div class="panel-subtitle" id="qrScannerStatus">Menyiapkan kamera...</div>
              </div>
              <button class="icon-button" type="button" id="stopQrButton" aria-label="Tutup kamera">
                <i data-lucide="x"></i>
              </button>
            </div>
            <div id="qrReader" style="width:100%;max-width:500px;margin:auto;overflow:hidden;border-radius:10px"></div>
          </div>
        </div>

        <div id="qrResult" style="margin-top:18px"></div>
      </section>`;

    ui().$("#qrForm").addEventListener("submit", lookup);
    ui().$("#scanQrButton").addEventListener("click", startScanner);
    ui().$("#stopQrButton").addEventListener("click", stopScanner);

    ui().bindRefresh();
    ui().iconRefresh();
  }

  async function startScanner() {
    const panel = ui().$("#qrScannerPanel");
    const status = ui().$("#qrScannerStatus");
    const button = ui().$("#scanQrButton");

    if (!window.Html5Qrcode) {
      ui().$("#qrResult").innerHTML =
        `<div class="notice warning">Pustaka pemindai QR belum berhasil dimuat. Periksa koneksi internet lalu muat ulang aplikasi.</div>`;
      return;
    }

    panel.style.display = "block";
    button.disabled = true;
    scanHandled = false;
    status.textContent = "Meminta izin kamera...";

    try {
      scanner = new Html5Qrcode("qrReader");

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1
        },
        async (decodedText) => {
          if (scanHandled) return;
          scanHandled = true;

          const input = ui().$("#qrValue");
          input.value = decodedText;

          await stopScanner();
          ui().$("#qrForm").requestSubmit();
        },
        () => {}
      );

      status.textContent = "Kamera aktif. Arahkan ke QR Code perangkat.";
    } catch (error) {
      await stopScanner();

      ui().$("#qrResult").innerHTML =
        `<div class="notice warning">Kamera tidak dapat dibuka. Pastikan izin kamera diberikan kepada browser dan aplikasi dibuka melalui HTTPS. Detail: ${ui().escapeHTML(error.message || error)}</div>`;
    } finally {
      button.disabled = false;
    }
  }

  async function stopScanner() {
    const current = scanner;
    scanner = null;

    if (current) {
      try {
        await current.stop();
      } catch (error) {}

      try {
        current.clear();
      } catch (error) {}
    }

    const panel = document.getElementById("qrScannerPanel");
    if (panel) panel.style.display = "none";

    const button = document.getElementById("scanQrButton");
    if (button) button.disabled = false;
  }

  async function lookup(event) {
    event.preventDefault();

    const form = ui().$("#qrForm");
    const input = ui().$("#qrValue");
    const button = event.submitter || form.querySelector('button[type="submit"]');
    const result = ui().$("#qrResult");
    const qr = input.value.trim();

    if (!qr) return;

    button.disabled = true;
    result.innerHTML =
      `<div class="loading-panel"><span class="spinner"></span> Mencari perangkat...</div>`;

    try {
      const response = await TechOpsAPI.get("qr.info", { qr });

      if (!response || response.success === false) {
        result.innerHTML =
          `<div class="notice warning">${ui().escapeHTML(response?.message || "Perangkat tidak ditemukan.")}<br>Serial: ${ui().escapeHTML(response?.serial || qr)}</div>`;
        return;
      }

      const device = response.perangkat || response.device || response.data || {};
      const history = Array.isArray(response.riwayat) ? response.riwayat : [];
      const isPrinter = String(response.jenis_aset || "").toLowerCase().includes("printer");

      const fields = isPrinter
        ? {
            serial: "Serial",
            unit: "Unit",
            merek: "Merek",
            model: "Model",
            tinta: "Tinta",
            ftp: "FTP",
            mp: "MP",
            status: "Status"
          }
        : {
            tahun: "Tahun Perolehan",
            komputer: "Computer Name",
            merek: "Merek",
            model: "Model",
            serial: "Serial",
            cpu: "CPU",
            core: "Core",
            thread: "Thread",
            ram: "RAM",
            storage: "Storage",
            gpu: "GPU",
            os: "OS",
            pengguna: "Pengguna",
            status: "Status"
          };

      const detail = Object.entries(fields)
        .filter(([key]) => device[key] !== undefined && device[key] !== "")
        .map(([key, label]) =>
          `<div class="detail-item"><small>${label}</small><strong>${ui().escapeHTML(device[key])}</strong></div>`
        ).join("");

      result.innerHTML =
        `<div class="panel" style="padding:16px;margin-top:12px">
          <div class="panel-header">
            <div>
              <h2>${isPrinter ? "Informasi Printer" : "Informasi Komputer"}</h2>
              <div class="panel-subtitle">Serial: ${ui().escapeHTML(device.serial || qr)}</div>
            </div>
            <span class="badge green">Ditemukan</span>
          </div>
          <div class="detail-grid">${detail || "<div>Detail perangkat tidak tersedia.</div>"}</div>
        </div>
        <div class="panel" style="padding:16px;margin-top:14px">
          <div class="panel-header">
            <div>
              <h2>Riwayat Maintenance</h2>
              <div class="panel-subtitle">${history.length} catatan ditemukan</div>
            </div>
          </div>
          ${renderHistory(history)}
        </div>`;
    } catch (error) {
      result.innerHTML =
        `<div class="notice warning">${ui().escapeHTML(error.message || error)}</div>`;
    } finally {
      button.disabled = false;
    }
  }

  function renderHistory(rows) {
    if (!rows.length) {
      return `<div class="empty-state">Belum ada riwayat maintenance untuk perangkat ini.</div>`;
    }

    return `<div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>TANGGAL</th>
            <th>KEGIATAN</th>
            <th>KONDISI</th>
            <th>KETERANGAN</th>
            <th>TEKNISI</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${ui().escapeHTML(r.Tanggal || "-")}</td>
              <td>${ui().escapeHTML(r.kegiatan || "-")}</td>
              <td>${ui().escapeHTML(r.kondisi || "-")}</td>
              <td>${ui().escapeHTML(r.keterangan || "-")}</td>
              <td>${ui().escapeHTML(r.teknisi || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
  }

  window.QRInfoPage = { render };
})();
