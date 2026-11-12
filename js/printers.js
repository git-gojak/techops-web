
(function () {
  "use strict";

  const ui = () => window.TechOpsUI;
  const state = () => window.TechOpsState;

  let currentFilter = "Aktif";
  let currentSearch = "";
  let currentModal = null;

  const fields = [
    { key: "serial", label: "Serial Number", required: true },
    { key: "unit", label: "Unit", required: true },
    { key: "merek", label: "Merek", required: true },
    { key: "model", label: "Model", required: true },
    { key: "tinta", label: "Jenis Tinta" },
    { key: "ftp", label: "Tanggal FTP", type: "date" },
    { key: "mp", label: "MP" }
  ];

  function isAdmin() {
    return !!state().authenticated;
  }

  function esc(value) {
    return ui().escapeHTML(String(value ?? ""));
  }

  function printers() {
    return Array.isArray(state().printers) ? state().printers : [];
  }

  async function api(action, payload = {}) {
    return window.TechOpsAPI.request(action, payload);
  }

  async function loadPrinters() {
    const result = await api("printers.list", {
      includeArchived: isAdmin()
    });

    state().printers = Array.isArray(result.data)
      ? result.data
      : [];

    drawTable();
  }

  function render() {
    const host = ui().$("#appContent");

    host.innerHTML =
      ui().pageHeading(
        "Inventaris Printer",
        "Daftar printer yang tercatat dalam database.",
        "ASSET MANAGEMENT"
      ) +
      `
      <section class="panel">
        <div class="table-toolbar">
          <div class="search-box">
            <i data-lucide="search"></i>
            <input
              id="printerSearch"
              type="search"
              placeholder="Cari serial, unit, merek, model..."
              autocomplete="off"
            >
          </div>

          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <select id="printerFilter" class="form-control"
              style="max-width:140px">
              <option value="Aktif">Printer Aktif</option>
              ${isAdmin()
                ? '<option value="Arsip">Printer Arsip</option>'
                : ""}
            </select>

            <span class="badge" id="printerCount">0 perangkat</span>

            ${isAdmin()
              ? `<button class="btn primary" id="addPrinterBtn">
                   <i data-lucide="plus"></i>
                   Tambah Printer
                 </button>`
              : ""}
          </div>
        </div>

        <div id="printerTable"></div>
      </section>
      `;

    ui().$("#printerSearch").addEventListener("input", e => {
      currentSearch = e.target.value;
      drawTable();
    });

    ui().$("#printerFilter").addEventListener("change", e => {
      currentFilter = e.target.value;
      drawTable();
    });

    if (isAdmin()) {
      ui().$("#addPrinterBtn").addEventListener("click", () => {
        showForm();
      });
    }

    ui().bindRefresh();
    ui().iconRefresh();

    drawTable();

    loadPrinters().catch(error => {
      ui().toast(error.message || "Gagal memuat data printer.", "error");
    });
  }

  function drawTable() {
    const host = ui().$("#printerTable");
    if (!host) return;

    const query = currentSearch.toLowerCase().trim();

    const rows = printers().filter(row => {
      const status = String(row.status || "Aktif");
      const matchStatus = status.toLowerCase() ===
        currentFilter.toLowerCase();

      const searchable = [
        row.serial,
        row.unit,
        row.merek,
        row.model,
        row.tinta,
        row.ftp,
        row.mp,
        row.status
      ].join(" ").toLowerCase();

      return matchStatus && searchable.includes(query);
    });

    const count = ui().$("#printerCount");
    if (count) count.textContent = `${rows.length} perangkat`;

    if (!rows.length) {
      host.innerHTML = `
        <div class="empty-state">
          <i data-lucide="printer"></i>
          <p>Tidak ada data printer.</p>
        </div>
      `;
      ui().iconRefresh();
      return;
    }

    host.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Serial Number</th>
              <th>Unit</th>
              <th>Merek</th>
              <th>Model</th>
              <th>Tinta</th>
              <th>FTP</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>
                  <div class="primary-cell">${esc(row.serial)}</div>
                </td>
                <td>${esc(row.unit)}</td>
                <td>${esc(row.merek)}</td>
                <td>${esc(row.model)}</td>
                <td>${esc(row.tinta)}</td>
                <td>${esc(row.ftp)}</td>
                <td>
                  <span class="badge">
                    ${esc(row.status || "Aktif")}
                  </span>
                </td>
                <td>
                  <div style="display:flex;gap:8px;align-items:center">
                    <button class="table-action"
                      data-action="detail"
                      data-serial="${esc(row.serial)}">
                      Detail
                    </button>

                    ${isAdmin() && row.status !== "Arsip"
                      ? `
                        <button class="table-action"
                          data-action="edit"
                          data-serial="${esc(row.serial)}">
                          Edit
                        </button>
                        <button class="table-action"
                          data-action="archive"
                          data-serial="${esc(row.serial)}">
                          Arsipkan
                        </button>
                      `
                      : ""}

                    ${isAdmin() && row.status === "Arsip"
                      ? `
                        <button class="table-action"
                          data-action="unarchive"
                          data-serial="${esc(row.serial)}">
                          Aktifkan
                        </button>
                      `
                      : ""}
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="table-footer">
        Menampilkan ${rows.length} printer
      </div>
    `;

    host.querySelectorAll("[data-action]").forEach(button => {
      button.addEventListener("click", () => {
        handleAction(
          button.dataset.action,
          button.dataset.serial
        );
      });
    });

    ui().iconRefresh();
  }

  function findPrinter(serial) {
    return printers().find(row =>
      String(row.serial) === String(serial)
    );
  }

  async function handleAction(action, serial) {
    const row = findPrinter(serial);
    if (!row) return;

    if (action === "detail") {
      showDetail(row);
      return;
    }

    if (!isAdmin()) {
      ui().toast("Login Admin diperlukan.", "error");
      return;
    }

    if (action === "edit") {
      showForm(row);
      return;
    }

    if (action === "archive") {
      if (!confirm(`Arsipkan printer ${serial}?`)) return;

      try {
        await api("printers.archive", { serial });
        ui().toast("Printer berhasil diarsipkan.", "success");
        await loadPrinters();
      } catch (error) {
        ui().toast(error.message || "Gagal mengarsipkan printer.", "error");
      }
      return;
    }

    if (action === "unarchive") {
      if (!confirm(`Aktifkan kembali printer ${serial}?`)) return;

      try {
        await api("printers.unarchive", { serial });
        ui().toast("Printer berhasil diaktifkan kembali.", "success");
        await loadPrinters();
      } catch (error) {
        ui().toast(error.message || "Gagal mengaktifkan printer.", "error");
      }
    }
  }

  function showDetail(row) {
    closeModal();

    const actions = isAdmin() && row.status !== "Arsip"
      ? `
        <button class="btn primary" id="detailEditBtn">
          Edit Printer
        </button>
      `
      : "";

    openModal(`
      <div class="modal-header">
        <div>
          <h3>Detail Printer</h3>
          <p>${esc(row.serial)}</p>
        </div>
        <button class="icon-button" id="closePrinterModal">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="detail-grid">
        ${fields.map(field => `
          <div class="detail-item">
            <span>${esc(field.label)}</span>
            <strong>${esc(row[field.key] || "-")}</strong>
          </div>
        `).join("")}

        <div class="detail-item">
          <span>Status</span>
          <strong>${esc(row.status || "Aktif")}</strong>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px">
        ${actions}
      </div>
    `);

    bindClose();

    const editButton = document.getElementById("detailEditBtn");
    if (editButton) {
      editButton.addEventListener("click", () => showForm(row));
    }
  }

  function showForm(row = null) {
    if (!isAdmin()) {
      ui().toast("Login Admin diperlukan.", "error");
      return;
    }

    const editing = !!row;

    openModal(`
      <div class="modal-header">
        <div>
          <h3>${editing ? "Edit Printer" : "Tambah Printer"}</h3>
          <p>${editing
            ? "Perbarui informasi printer."
            : "Masukkan informasi printer baru."}</p>
        </div>
        <button class="icon-button" id="closePrinterModal">
          <i data-lucide="x"></i>
        </button>
      </div>

      <form id="printerForm">
        <div class="detail-grid">
          ${fields.map(field => `
            <label class="computer-form-field">
              <span>${esc(field.label)}${field.required ? " *" : ""}</span>
              <input
                name="${field.key}"
                type="${field.type || "text"}"
                value="${esc(row ? row[field.key] : "")}"
                ${field.required ? "required" : ""}
                ${field.key === "serial" && editing ? "readonly" : ""}
                placeholder="Masukkan ${esc(field.label.toLowerCase())}"
              >
            </label>
          `).join("")}
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px">
          <button type="submit" class="btn primary" id="savePrinterBtn">
            ${editing ? "Simpan Perubahan" : "Simpan Printer"}
          </button>
        </div>
      </form>
    `);

    bindClose();

    document.getElementById("printerForm")
      .addEventListener("submit", async event => {
        event.preventDefault();

        if (!isAdmin()) {
          ui().toast("Sesi Admin tidak tersedia.", "error");
          return;
        }

        const form = event.currentTarget;
        const data = {};

        fields.forEach(field => {
          data[field.key] = form.elements[field.key].value.trim();
        });

        data.status = row?.status || "Aktif";

        const button = document.getElementById("savePrinterBtn");
        button.disabled = true;
        button.textContent = "Menyimpan...";

        try {
          await api(
            editing ? "printers.update" : "printers.create",
            { data }
          );

          closeModal();
          ui().toast(
            editing
              ? "Data printer berhasil diperbarui."
              : "Printer berhasil ditambahkan.",
            "success"
          );

          await loadPrinters();
        } catch (error) {
          button.disabled = false;
          button.textContent = editing
            ? "Simpan Perubahan"
            : "Simpan Printer";

          ui().toast(
            error.message || "Gagal menyimpan data printer.",
            "error"
          );
        }
      });
  }

  function openModal(content) {
    closeModal();

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        ${content}
      </div>
    `;

    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) closeModal();
    });

    document.body.appendChild(backdrop);
    currentModal = backdrop;

    ui().iconRefresh();
  }

  function bindClose() {
    const button = document.getElementById("closePrinterModal");
    if (button) button.addEventListener("click", closeModal);
  }

  function closeModal() {
    if (currentModal) {
      currentModal.remove();
      currentModal = null;
    }
  }

  window.PrintersPage = {
    render,
    refresh: loadPrinters
  };

})();
