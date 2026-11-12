
(function () {
  "use strict";

  const ui = () => window.TechOpsUI;
  const state = () => window.TechOpsState;

  const FIELD_GROUPS = [
    {
      title: "Identitas Perangkat",
      subtitle: "Informasi utama dan identitas komputer",
      icon: "monitor",
      fields: [
        ["tahun", "Tahun Perolehan", "number"],
        ["komputer", "Computer Name", "text"],
        ["merek", "Manufacturer", "text"],
        ["model", "Model", "text"],
        ["serial", "Asset / Serial ID", "text"]
      ]
    },
    {
      title: "Spesifikasi Hardware",
      subtitle: "Detail komponen perangkat",
      icon: "cpu",
      fields: [
        ["cpu", "CPU", "text"],
        ["core", "Core", "number"],
        ["thread", "Thread", "number"],
        ["ram", "RAM", "text"],
        ["storage", "Storage", "text"],
        ["gpu", "GPU", "text"],
        ["os", "Operating System", "text"]
      ]
    },
    {
      title: "Informasi Penggunaan",
      subtitle: "Penanggung jawab perangkat",
      icon: "users",
      fields: [
        ["pengguna", "Pengguna", "text"]
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

  async function loadComputerRows() {
    const result = await request("computers.list", {
      includeArchived: isAdmin()
    });

    state().computers = Array.isArray(result) ? result : [];
    drawTable(currentQuery);
  }

  function render() {
    const host = ui().$("#appContent");
    const rows = state().computers || [];

    host.innerHTML =
      ui().pageHeading(
        "Inventaris Komputer",
        "Daftar komputer yang tercatat dalam database.",
        "ASSET MANAGEMENT"
      ) +
      `<section class="panel">
        <div class="table-toolbar">
          <div class="search-box">
            <i data-lucide="search"></i>
            <input
              id="computerSearch"
              type="search"
              placeholder="Cari nama, merek, model, serial, pengguna..."
            >
          </div>
          <div class="computer-toolbar-actions">
            <span class="badge" id="computerCount">${rows.length} perangkat</span>
            ${isAdmin()
              ? `<button class="button button-primary" id="addComputerBtn" type="button">
                   <i data-lucide="plus"></i> Tambah Komputer
                 </button>`
              : ""}
          </div>
        </div>
        <div id="computerTable"></div>
      </section>`;

    const input = ui().$("#computerSearch");

    input.addEventListener("input", () => {
      currentQuery = input.value;
      drawTable(currentQuery);
    });

    if (isAdmin()) {
      ui().$("#addComputerBtn").addEventListener("click", () => {
        openForm();
      });
    }

    drawTable("");
    ui().bindRefresh();
    ui().iconRefresh();

    loadComputerRows().catch(error => {
      console.error("Gagal memuat komputer:", error);
    });
  }

  function drawTable(query) {
    const all = state().computers || [];
    const q = String(query || "").trim().toLowerCase();

    const filtered = all.filter(row => {
      if (!q) return true;

      return Object.keys(row).some(key =>
        String(row[key] ?? "").toLowerCase().includes(q)
      );
    });

    const host = ui().$("#computerTable");
    const count = ui().$("#computerCount");

    if (count) {
      count.textContent = `${filtered.length} perangkat`;
    }

    if (!host) return;

    if (!filtered.length) {
      host.innerHTML =
        `<div class="empty-state">Tidak ada data komputer yang cocok.</div>`;
      return;
    }

    host.innerHTML =
      `<div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>NO</th>
              <th>COMPUTER NAME</th>
              <th>MEREK / MODEL</th>
              <th>SERIAL</th>
              <th>PENGGUNA</th>
              <th>TAHUN</th>
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
                <td class="primary-cell">${escape(row.komputer)}</td>
                <td>${escape([row.merek, row.model].filter(Boolean).join(" "))}</td>
                <td>${escape(row.serial)}</td>
                <td>${escape(row.pengguna)}</td>
                <td>${escape(row.tahun)}</td>
                <td>
                  <span class="badge ${archived ? "gray" : "green"}">
                    ${archived ? "Arsip" : escape(row.status || "Aktif")}
                  </span>
                </td>
                <td>
                  <div class="computer-table-actions">
                    <button
                      class="table-action"
                      type="button"
                      data-action="detail"
                      data-serial="${serial}"
                    >Detail</button>

                    ${isAdmin() ? `
                      ${!archived ? `
                        <button
                          class="table-action"
                          type="button"
                          data-action="edit"
                          data-serial="${serial}"
                        >Edit</button>
                        <button
                          class="table-action danger"
                          type="button"
                          data-action="archive"
                          data-serial="${serial}"
                        >Arsipkan</button>
                      ` : `
                        <button
                          class="table-action"
                          type="button"
                          data-action="unarchive"
                          data-serial="${serial}"
                        >Aktifkan</button>
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
        <span>Menampilkan ${filtered.length} dari ${all.length} komputer</span>
      </div>`;

    host.querySelectorAll("[data-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        const serial = button.dataset.serial;

        if (action === "detail") showDetail(serial);
        if (action === "edit") openForm(serial);
        if (action === "archive") archiveComputer(serial);
        if (action === "unarchive") unarchiveComputer(serial);
      });
    });
  }

  function showDetail(serial) {
    const row = (state().computers || []).find(
      item => String(item.serial) === String(serial)
    );

    if (!row) return;

    const labels = {
      tahun: "Tahun Perolehan",
      komputer: "Computer Name",
      merek: "Manufacturer",
      model: "Model",
      serial: "Asset / Serial ID",
      cpu: "CPU",
      core: "Core",
      thread: "Thread",
      ram: "RAM",
      storage: "Storage",
      gpu: "GPU",
      os: "Operating System",
      pengguna: "Pengguna",
      scan_terakhir: "Scan Terakhir",
      perubahan: "Perubahan",
      status: "Status"
    };

    const body = Object.entries(labels).map(([key, label]) =>
      `<div class="detail-item">
        <small>${label}</small>
        <strong>${escape(row[key] || "-")}</strong>
      </div>`
    ).join("");

    modal(
      "Detail Komputer",
      `<div class="detail-grid">${body}</div>`
    );
  }

  function renderFormField(field, row, editing) {
    const [key, label, type] = field;
    const required = ["komputer", "serial"].includes(key);
    const readonly = editing && key === "serial";
    const value = row[key] == null ? "" : row[key];

    return `
      <label class="computer-form-field ${key === "komputer" ? "computer-field-wide" : ""}">
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
          ${type === "number" ? 'min="0" step="1"' : ""}
          autocomplete="off"
        >
        ${readonly
          ? '<small class="computer-field-hint">Serial ID tidak dapat diubah.</small>'
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
      ? (state().computers || []).find(
          item => String(item.serial) === String(serial)
        )
      : {};

    if (editing && !row) {
      alert("Data komputer tidak ditemukan.");
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
      editing ? "Edit Komputer" : "Tambah Komputer",
      `<form id="computerForm" class="computer-form">
        <div class="computer-form-intro">
          <div class="computer-form-intro-icon">
            <i data-lucide="monitor"></i>
          </div>
          <div>
            <strong>${editing ? "Perbarui informasi perangkat" : "Daftarkan perangkat baru"}</strong>
            <p>${editing
              ? "Pastikan informasi komputer sudah sesuai."
              : "Lengkapi informasi komputer untuk menambahkannya ke inventaris."}</p>
          </div>
        </div>

        ${sections}

        <div class="computer-form-required">
          <span><em>*</em> Wajib diisi</span>
        </div>

        <div class="computer-form-message" id="computerFormMessage"
             role="status" aria-live="polite"></div>

        <div class="computer-form-footer">
          <button type="button" class="button button-secondary" id="cancelComputerForm">
            Batal
          </button>
          <button type="submit" class="button button-primary" id="saveComputerBtn">
            <i data-lucide="save"></i>
            ${editing ? "Simpan Perubahan" : "Simpan Komputer"}
          </button>
        </div>
      </form>`,
      "computer-modal"
    );

    ui().$("#cancelComputerForm").addEventListener("click", closeModal);

    ui().$("#computerForm").addEventListener("submit", async event => {
      event.preventDefault();

      if (busy) return;

      const form = event.currentTarget;
      const data = {};

      FIELDS.forEach(([key]) => {
        const input = form.elements.namedItem(key);
        data[key] = String(input.value || "").trim();
      });

      if (!data.komputer || !data.serial) {
        showFormMessage("Computer Name dan Serial wajib diisi.", "error");
        return;
      }

      if (editing) {
        data.serial = String(serial);
        data.scan_terakhir = row.scan_terakhir || "";
        data.perubahan = row.perubahan || "";
        data.status = row.status || "Aktif";
      } else {
        data.status = "Aktif";
      }

      await saveComputer(
        editing ? "computers.update" : "computers.create",
        data
      );
    });

    ui().iconRefresh();
  }

  async function saveComputer(action, data) {
    setBusy(true);

    try {
      await request(action, { data });
      closeModal();
      await loadComputerRows();

      alert(
        action === "computers.create"
          ? "Komputer berhasil ditambahkan."
          : "Data komputer berhasil diperbarui."
      );
    } catch (error) {
      showFormMessage(error.message || "Gagal menyimpan data.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function archiveComputer(serial) {
    if (!isAdmin()) return;

    if (!confirm(
      `Arsipkan komputer dengan serial ${serial}?\n\nData tidak akan dihapus.`
    )) return;

    setBusy(true);

    try {
      await request("computers.archive", { serial });
      await loadComputerRows();
      alert("Komputer berhasil diarsipkan.");
    } catch (error) {
      alert(error.message || "Gagal mengarsipkan komputer.");
    } finally {
      setBusy(false);
    }
  }

  async function unarchiveComputer(serial) {
    if (!isAdmin()) return;

    if (!confirm(`Aktifkan kembali komputer ${serial}?`)) return;

    setBusy(true);

    try {
      await request("computers.unarchive", { serial });
      await loadComputerRows();
      alert("Komputer berhasil diaktifkan kembali.");
    } catch (error) {
      alert(error.message || "Gagal mengaktifkan komputer.");
    } finally {
      setBusy(false);
    }
  }

  function showFormMessage(message, type) {
    const el = ui().$("#computerFormMessage");
    if (!el) return;

    el.textContent = message;
    el.className = `computer-form-message ${type || ""}`;
  }

  function setBusy(value) {
    busy = value;

    const button = ui().$("#saveComputerBtn");
    if (button) {
      button.disabled = value;
      button.innerHTML = value
        ? '<span class="spinner"></span> Menyimpan...'
        : '<i data-lucide="save"></i> Simpan Komputer';

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

  window.ComputersPage = { render };
})();
