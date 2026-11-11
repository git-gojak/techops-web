(function () {
  "use strict";
  const ui = () => window.TechOpsUI;
  const state = () => window.TechOpsState;

  function render() {
    const host = ui().$("#appContent");
    const rows = state().computers;
    host.innerHTML = ui().pageHeading("Inventaris Komputer", "Daftar komputer yang tercatat dalam database.", "ASSET MANAGEMENT") +
      `<section class="panel">
        <div class="table-toolbar"><div class="search-box"><i data-lucide="search"></i><input id="computerSearch" type="search" placeholder="Cari nama, merek, model, serial, pengguna..."></div><span class="badge">${rows.length} perangkat</span></div>
        <div id="computerTable"></div>
      </section>`;
    const input = ui().$("#computerSearch");
    input.addEventListener("input", () => drawTable(input.value));
    drawTable("");
    ui().bindRefresh(); ui().iconRefresh();
  }

  function drawTable(query) {
    const all = state().computers;
    const q = String(query || "").toLowerCase();
    const filtered = all.filter(row => ["komputer","merek","model","serial","pengguna","tahun"].some(k => String(row[k] ?? "").toLowerCase().includes(q)));
    const host = ui().$("#computerTable");
    if (!filtered.length) { host.innerHTML = `<div class="empty-state">Tidak ada data komputer yang cocok.</div>`; return; }
    host.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>NO</th><th>COMPUTER NAME</th><th>MEREK / MODEL</th><th>SERIAL</th><th>PENGGUNA</th><th>TAHUN</th><th>AKSI</th></tr></thead><tbody>${filtered.map((r,i) =>
      `<tr><td>${i+1}</td><td class="primary-cell">${ui().escapeHTML(r.komputer)}</td><td>${ui().escapeHTML([r.merek,r.model].filter(Boolean).join(" "))}</td><td>${ui().escapeHTML(r.serial)}</td><td>${ui().escapeHTML(r.pengguna)}</td><td>${ui().escapeHTML(r.tahun)}</td><td><button class="table-action" data-serial="${ui().escapeHTML(r.serial)}">Detail</button></td></tr>`
    ).join("")}</tbody></table></div><div class="table-footer"><span>Menampilkan ${filtered.length} dari ${all.length} komputer</span></div>`;
    host.querySelectorAll("[data-serial]").forEach(btn => btn.addEventListener("click", () => showDetail(btn.dataset.serial)));
  }

  function showDetail(serial) {
    const row = state().computers.find(x => String(x.serial) === String(serial));
    if (!row) return;
    const labels = {tahun:"Tahun Perolehan",komputer:"Computer Name",merek:"Manufacturer",model:"Model",serial:"Asset / Serial ID",cpu:"CPU",core:"Core",thread:"Thread",ram:"RAM",storage:"Storage",gpu:"GPU",os:"Operating System",pengguna:"Pengguna",scan_terakhir:"Scan Terakhir",perubahan:"Perubahan",status:"Status"};
    const body = Object.entries(labels).map(([key,label]) => `<div class="detail-item"><small>${label}</small><strong>${ui().escapeHTML(row[key] || "-")}</strong></div>`).join("");
    modal("Detail Komputer", `<div class="detail-grid">${body}</div>`);
  }

  function modal(title, content) {
    const wrap = document.createElement("div"); wrap.className = "modal-backdrop";
    wrap.innerHTML = `<section class="modal"><div class="modal-header"><h2>${title}</h2><button class="icon-button" aria-label="Tutup"><i data-lucide="x"></i></button></div>${content}</section>`;
    document.body.appendChild(wrap);
    wrap.querySelector("button").onclick = () => wrap.remove();
    wrap.addEventListener("click", e => { if (e.target === wrap) wrap.remove(); });
    ui().iconRefresh();
  }
  window.ComputersPage = { render };
})();
