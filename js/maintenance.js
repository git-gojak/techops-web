(function () {
  "use strict";
  const ui = () => window.TechOpsUI;
  const state = () => window.TechOpsState;

  function render() {
    const host = ui().$("#appContent"), rows = state().maintenance;
    host.innerHTML = ui().pageHeading("Maintenance", "Riwayat perawatan dan perbaikan komputer maupun printer.", "IT SERVICE") +
      `<section class="panel"><div class="notice warning">Mode baca saja: pencatatan maintenance akan diaktifkan setelah mekanisme login dan pembatasan akses tersedia.</div><div class="table-toolbar" style="margin-top:16px"><div class="search-box"><i data-lucide="search"></i><input id="maintenanceSearch" type="search" placeholder="Cari perangkat, serial, kegiatan, teknisi..."></div><span class="badge">${rows.length} riwayat</span></div><div id="maintenanceTable"></div></section>`;
    ui().$("#maintenanceSearch").addEventListener("input", e => drawTable(e.target.value));
    drawTable(""); ui().bindRefresh(); ui().iconRefresh();
  }

  function drawTable(query) {
    const all = state().maintenance, q = String(query || "").toLowerCase();
    const rows = all.filter(r => ["Tanggal","jenis_aset","nama_aset","serial","kegiatan","kondisi","keterangan","teknisi","jadwal"].some(k => String(r[k] ?? "").toLowerCase().includes(q)));
    const host = ui().$("#maintenanceTable");
    if (!rows.length) { host.innerHTML = `<div class="empty-state">Tidak ada riwayat maintenance yang cocok.</div>`; return; }
    host.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>TANGGAL</th><th>JENIS</th><th>NAMA PERANGKAT</th><th>SERIAL</th><th>KEGIATAN</th><th>KONDISI</th><th>TEKNISI</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${ui().escapeHTML(formatDate(r.Tanggal))}</td><td><span class="badge ${String(r.jenis_aset).toLowerCase()==="printer"?"green":""}">${ui().escapeHTML(r.jenis_aset)}</span></td><td class="primary-cell">${ui().escapeHTML(r.nama_aset)}</td><td>${ui().escapeHTML(r.serial)}</td><td>${ui().escapeHTML(r.kegiatan)}</td><td>${ui().escapeHTML(r.kondisi)}</td><td>${ui().escapeHTML(r.teknisi)}</td></tr>`).join("")}</tbody></table></div><div class="table-footer"><span>Menampilkan ${rows.length} dari ${all.length} riwayat</span></div>`;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("id-ID", {day:"2-digit",month:"short",year:"numeric"});
  }
  window.MaintenancePage = { render };
})();
