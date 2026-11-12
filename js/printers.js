
(function () {
  "use strict";

  const ui = () => window.TechOpsUI;
  const state = () => window.TechOpsState;

  const FIELD_GROUPS = [
    {
      title: "Identitas Printer",
      subtitle: "Informasi utama dan identitas printer",
      icon: "printer",
      fields: [
        ["serial", "Serial Number", "text"],
        ["unit", "Unit", "text"],
        ["merek", "Merek", "text"],
        ["model", "Model", "text"]
      ]
    },
    {
      title: "Informasi Operasional",
      subtitle: "Informasi tinta dan pemeliharaan printer",
      icon: "settings",
      fields: [
        ["tinta", "Jenis Tinta", "text"],
        ["ftp", "Tanggal FTP", "date"],
        ["mp", "Masa Pakai (MP)", "text"]
      ]
    }
  ];

  const FIELDS = FIELD_GROUPS.flatMap(group => group.fields);

  let currentQuery = "";
  let modalElement = null;
  let busy = false;

  function isAdmin() {
    return !!state().authenticated;
  }

  function escape(value) {
    return ui().escapeHTML(value == null ? "" : String(value));
  }

  function normalizeFTPDate(value) {
    if (!value) return "";

    const text = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }

    const match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

    if (match) {
      return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }

    return "";
  }

  function calculateMP(ftp) {
    const value = normalizeFTPDate(ftp);
    if (!value) return "";

    const [year, month, day] = value.split("-").map(Number);

    const start = new Date(Date.UTC(year, month - 1, day));
    const now = new Date();

    const end = new Date(Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ));

    if (start > end) return "Belum dimulai";

    let years = end.getUTCFullYear() - start.getUTCFullYear();
    let months = end.getUTCMonth() - start.getUTCMonth();
    let days = end.getUTCDate() - start.getUTCDate();

    if (days < 0) {
      const previousMonthDays = new Date(Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        0
      )).getUTCDate();

      days += previousMonthDays;
      months--;
    }

    if (months < 0) {
      months += 12;
      years--;
    }

    return `${years}y ${months}m ${days}d`;
  }

  function request(action, payload) {
    return window.TechOpsAPI.request(action, payload || {})
      .then(result => {
        if (!result || result.success !== true) {
          throw new Error(
            result?.message || "Permintaan gagal diproses."
          );
        }
        return result.data;
      });
  }

  async function loadPrinterRows() {
    const result = await request("printers.list", {
      includeArchived: isAdmin()
    });

    state().printers = Array.isArray(result) ? result : [];
    drawTable(currentQuery);
  }

  function render() {
    const host = ui().$("#appContent");
    const rows = state().printers || [];

    host.innerHTML =
      ui().pageHeading(
        "Inventaris Printer",
        "Daftar printer yang tercatat dalam database.",
        "ASSET MANAGEMENT"
      ) +
      `<section class="panel">
        <div class="table-toolbar">
          <div class="search-box">
            <i data-lucide="search"></i>
            <input
              id="printerSearch"
              type="search"
              placeholder="Cari serial, unit, merek, model..."
            >
          </div>

          <div class="computer-toolbar-actions">
            <span class="badge" id="printerCount">${rows.length} perangkat</span>

            ${isAdmin()
              ? `<button class="button button-primary" id="addPrinterBtn" type="button">
                   <i data-lucide="plus"></i> Tambah Printer
                 </button>`
              : ""}
          </div>
        </div>

        <div id="printerTable"></div>
      </section>`;

    const input = ui().$("#printerSearch");

    input.addEventListener("input", () => {
      currentQuery = input.value;
      drawTable(currentQuery);
    });

    if (isAdmin()) {
      ui().$("#addPrinterBtn").addEventListener("click", () => {
        openForm();
      });
    }

    drawTable("");

    ui().bindRefresh();
    ui().iconRefresh();

    loadPrinterRows().catch(error => {
      console.error("Gagal memuat printer:", error);
    });
  }

  function drawTable(query) {
    const all = state().printers || [];
    const q = String(query || "").trim().toLowerCase();

    const filtered = all.filter(row => {
      if (!q) return true;

      return Object.keys(row).some(key =>
        String(row[key] ?? "").toLowerCase().includes(q)
      );
    });

    const host = ui().$("#printerTable");
    const count = ui().$("#printerCount");

    if (count) {
      count.textContent = `${filtered.length} perangkat`;
    }

    if (!host) return;

    if (!filtered.length) {
      host.innerHTML =
        `<div class="empty-state">Tidak ada data printer yang cocok.</div>`;
      return;
    }

    host.innerHTML =
      `<div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>NO</th>
              <th>SERIAL NUMBER</th>
              <th>UNIT</th>
              <th>MEREK</th>
              <th>MODEL</th>
              <th>TINTA</th>
              <th>FTP</th>
              <th>MP</th>
              <th>STATUS</th>
              <th>AKSI</th>
            </tr>
          </thead>

          <tbody>
            ${filtered.map((row, index) => {
              const serial = escape(row.serial);
              const archived =
                String(row.status || "").trim().toLowerCase() === "arsip";

              return `<tr>
                <td>${index + 1}</td>
                <td class="primary-cell">${escape(row.serial)}</td>
                <td>${escape(row.unit)}</td>
                <td>${escape(row.merek)}</td>
                <td>${escape(row.model)}</td>
                <td>${escape(row.tinta)}</td>
                <td>${escape(row.ftp)}</td>
                <td>${escape(calculateMP(row.ftp) || "-")}</td>
                <td>
                  <span class="badge ${archived ? "gray" : "green"}">
                    ${archived ? "Arsip" : escape(row.status || "Aktif")}
                  </span>
                </td>
                <td>
                  <div class="computer-table-actions">
                    <button class="table-action" type="button"
                      data-action="detail" data-serial="${serial}">
                      Detail
                    </button>

                    ${isAdmin() ? `
                      ${!archived ? `
                        <button class="table-action" type="button"
                          data-action="edit" data-serial="${serial}">
                          Edit
                        </button>
                        <button class="table-action danger" type="button"
                          data-action="archive" data-serial="${serial}">
                          Arsipkan
                        </button>
                      ` : `
                        <button class="table-action" type="button"
                          data-action="unarchive" data-serial="${serial}">
                          Aktifkan
                        </button>
                      `}
                    ` : ""}
                  </div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div class="table-footer">
        <span>Menampilkan ${filtered.length} dari ${all.length} printer</span>
      </div>`;

    host.querySelectorAll("[data-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        const serial = button.dataset.serial;

        if (action === "detail") showDetail(serial);
        if (action === "edit") openForm(serial);
        if (action === "archive") archivePrinter(serial);
        if (action === "unarchive") unarchivePrinter(serial);
      });
    });
  }

  function showDetail(serial) {
    const row = (state().printers || []).find(
      item => String(item.serial) === String(serial)
    );

    if (!row) return;

    const labels = {
      serial: "Serial Number",
      unit: "Unit",
      merek: "Merek",
      model: "Model",
      tinta: "Jenis Tinta",
      ftp: "Tanggal FTP",
      mp: "Masa Pakai",
      status: "Status"
    };

    const body = Object.entries(labels).map(([key, label]) =>
      `<div class="detail-item">
        <small>${label}</small>
        <strong>${escape(
          key === "mp" ? calculateMP(row.ftp) || "-" : row[key] || "-"
        )}</strong>
      </div>`
    ).join("");

    modal(
      "Detail Printer",
      `<div class="detail-grid">${body}</div>`
    );
  }

  function renderFormField(field, row, editing) {
    const [key, label, type] = field;
    const required = key === "serial";
    const readonly = (editing && key === "serial") || key === "mp";

    const value = key === "mp"
      ? calculateMP(row.ftp)
      : key === "ftp"
        ? normalizeFTPDate(row.ftp)
        : row[key] == null ? "" : row[key];

    return `
      <label class="computer-form-field">
        <span class="computer-field-label">
          ${label}
          ${required ? '<em>*</em>' : ""}
        </span>

        <input
          name="${key}"
          type="${type}"
          value="${escape(value)}"
          placeholder="${escape("Masukkan " + label.toLowerCase())}"
          ${readonly ? "readonly" : ""}
          ${required ? "required" : ""}
          autocomplete="off"
        >

        ${key === "mp"
          ? '<small class="computer-field-hint">Dihitung otomatis berdasarkan tanggal FTP.</small>'
          : readonly && key === "serial"
            ? '<small class="computer-field-hint">Serial Number tidak dapat diubah.</small>'
            : ""}
      </label>`;
  }

  function openForm(serial) {
    if (!isAdmin()) {
      alert("Silakan login sebagai Admin.");
      return;
    }

    const editing = !!serial;

    const row = editing
      ? (state().printers || []).find(
          item => String(item.serial) === String(serial)
        )
      : {};

    if (editing && !row) {
      alert("Data printer tidak ditemukan.");
      return;
    }

    const sections = FIELD_GROUPS.map((group, index) => `
      <section class="computer-form-section">
        <div class="computer-section-heading">
          <div class="computer-section-icon">
            <i data-lucide="${group.icon}"></i>
          </div>

          <div>
            <h3>${group.title}</h3>
            <p>${group.subtitle}</p>
          </div>

          <span class="computer-section-number">0${index + 1}</span>
        </div>

        <div class="computer-form-grid">
          ${group.fields.map(field =>
            renderFormField(field, row, editing)
          ).join("")}
        </div>
      </section>
    `).join("");

    modal(
      editing ? "Edit Printer" : "Tambah Printer",
      `<form id="printerForm" class="computer-form">

        <div class="computer-form-intro">
          <div class="computer-form-intro-icon">
            <i data-lucide="printer"></i>
          </div>

          <div>
            <strong>${editing
              ? "Perbarui informasi printer"
              : "Daftarkan printer baru"}</strong>

            <p>${editing
              ? "Pastikan informasi printer sudah sesuai."
              : "Lengkapi informasi printer untuk menambahkannya ke inventaris."}</p>
          </div>
        </div>

        ${sections}

        <div class="computer-form-required">
          <span><em>*</em> Wajib diisi</span>
        </div>

        <div class="computer-form-message" id="printerFormMessage"
             role="status" aria-live="polite"></div>

        <div class="computer-form-footer">
          <button type="button" class="button button-secondary"
                  id="cancelPrinterForm">
            Batal
          </button>

          <button type="submit" class="button button-primary"
                  id="savePrinterBtn">
            <i data-lucide="save"></i>
            ${editing ? "Simpan Perubahan" : "Simpan Printer"}
          </button>
        </div>
      </form>`,
      "computer-modal"
    );

    ui().$("#cancelPrinterForm").addEventListener("click", closeModal);

    const form = ui().$("#printerForm");
    const ftpInput = form.elements.namedItem("ftp");
    const mpInput = form.elements.namedItem("mp");

    function updateMP() {
      mpInput.value = calculateMP(ftpInput.value);
    }

    ftpInput.addEventListener("input", updateMP);
    ftpInput.addEventListener("change", updateMP);

    updateMP();

    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (busy) return;

      const data = {};

      FIELDS.forEach(([key]) => {
        const input = form.elements.namedItem(key);
        data[key] = String(input.value || "").trim();
      });

      if (!data.serial) {
        showFormMessage("Serial Number wajib diisi.", "error");
        return;
      }

      data.ftp = normalizeFTPDate(data.ftp);
      data.mp = calculateMP(data.ftp);

      if (editing) {
        data.serial = String(serial);
        data.status = row.status || "Aktif";
      } else {
        data.status = "Aktif";
      }

      await savePrinter(
        editing ? "printers.update" : "printers.create",
        data
      );
    });

    ui().iconRefresh();
  }

  async function savePrinter(action, data) {
    setBusy(true);

    try {
      await request(action, { data });

      closeModal();
      await loadPrinterRows();

      alert(
        action === "printers.create"
          ? "Printer berhasil ditambahkan."
          : "Data printer berhasil diperbarui."
      );
    } catch (error) {
      showFormMessage(
        error.message || "Gagal menyimpan data printer.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  async function archivePrinter(serial) {
    if (!isAdmin()) return;

    if (!confirm(
      `Arsipkan printer dengan serial ${serial}?\n\nData tidak akan dihapus.`
    )) return;

    setBusy(true);

    try {
      await request("printers.archive", { serial });
      await loadPrinterRows();
      alert("Printer berhasil diarsipkan.");
    } catch (error) {
      alert(error.message || "Gagal mengarsipkan printer.");
    } finally {
      setBusy(false);
    }
  }

  async function unarchivePrinter(serial) {
    if (!isAdmin()) return;

    if (!confirm(`Aktifkan kembali printer ${serial}?`)) return;

    setBusy(true);

    try {
      await request("printers.unarchive", { serial });
      await loadPrinterRows();
      alert("Printer berhasil diaktifkan kembali.");
    } catch (error) {
      alert(error.message || "Gagal mengaktifkan printer.");
    } finally {
      setBusy(false);
    }
  }

  function showFormMessage(message, type) {
    const el = ui().$("#printerFormMessage");
    if (!el) return;

    el.textContent = message;
    el.className = `computer-form-message ${type || ""}`;
  }

  function setBusy(value) {
    busy = value;

    const button = ui().$("#savePrinterBtn");

    if (button) {
      button.disabled = value;
      button.innerHTML = value
        ? '<span class="spinner"></span> Menyimpan...'
        : '<i data-lucide="save"></i> Simpan Printer';

      ui().iconRefresh();
    }
  }

  function modal(title, content, variant) {
    closeModal();

    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";

    wrap.innerHTML =
      `<section class="modal ${variant || ""}">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-title-eyebrow">GOJAK TECHOPS · ASSET MANAGEMENT</span>
            <h2>${escape(title)}</h2>
          </div>

          <button class="icon-button" type="button" aria-label="Tutup">
            <i data-lucide="x"></i>
          </button>
        </div>

        ${content}
      </section>`;

    document.body.appendChild(wrap);
    modalElement = wrap;

    wrap.querySelector(".icon-button").addEventListener("click", closeModal);

    wrap.addEventListener("click", event => {
      if (event.target === wrap) closeModal();
    });

    ui().iconRefresh();
  }

  function closeModal() {
    if (modalElement) {
      modalElement.remove();
      modalElement = null;
    }
  }

  window.PrintersPage = {
    render,
    refresh: loadPrinterRows
  };

})();
