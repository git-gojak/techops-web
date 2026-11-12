
(function () {
  "use strict";

  const ui = () => window.TechOpsUI;
  const state = () => window.TechOpsState;

  const FIELDS = [
    ["tahun", "Tahun Perolehan", "number"],
    ["komputer", "Computer Name", "text"],
    ["merek", "Manufacturer", "text"],
    ["model", "Model", "text"],
    ["serial", "Asset / Serial ID", "text"],
    ["cpu", "CPU", "text"],
    ["core", "Core", "number"],
    ["thread", "Thread", "number"],
    ["ram", "RAM", "text"],
    ["storage", "Storage", "text"],
    ["gpu", "GPU", "text"],
    ["os", "Operating System", "text"],
    ["pengguna", "Pengguna", "text"]
  ];

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
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="badge" id="computerCount">${rows.length} perangkat</span>
            ${isAdmin()
              ? `<button class="btn primary" id="addComputerBtn" type="button">
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

    // Muat ulang daftar dengan arsip untuk Admin.
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
                  <span class="badge">
                    ${archived ? "Arsip" : escape(row.status || "Aktif")}
                  </span>
                </td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
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
                          class="table-action"
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

    const fields = FIELDS.map(([key, label, type]) => {
      const readonly = editing && key === "serial";

      return `<label class="computer-form-field">
        <span>${label}${["komputer", "serial"].includes(key) ? " *" : ""}</span>
        <input
          name="${key}"
          type="${type}"
          value="${escape(row[key] || "")}"
          ${readonly ? "readonly" : ""}
          ${["komputer", "serial"].includes(key) ? "required" : ""}
          ${type === "number" ? 'min="0"' : ""}
        >
      </label>`;
    }).join("");

    modal(
      editing ? "Edit Komputer" : "Tambah Komputer",
      `<form id="computerForm">
        <div class="detail-grid">${fields}</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px">
          <button type="button" class="btn" id="cancelComputerForm">
            Batal
          </button>
          <button type="submit" class="btn primary" id="saveComputerBtn">
            Simpan
          </button>
        </div>
        <p id="computerFormMessage" role="status"></p>
      </form>`
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
        showFormMessage("Computer Name dan Serial wajib diisi.");
        return;
      }

      // Field administratif ini tidak diubah melalui form.
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
      showFormMessage(error.message || "Gagal menyimpan data.");
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

  function showFormMessage(message) {
    const el = ui().$("#computerFormMessage");
    if (el) el.textContent = message;
  }

  function setBusy(value) {
    busy = value;

    const button = ui().$("#saveComputerBtn");
    if (button) {
      button.disabled = value;
      button.textContent = value ? "Menyimpan..." : "Simpan";
    }
  }

  function modal(title, content) {
    closeModal();

    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";

    wrap.innerHTML =
      `<section class="modal">
        <div class="modal-header">
          <h2>${escape(title)}</h2>
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
