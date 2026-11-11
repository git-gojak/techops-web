(function () {
  "use strict";
  const ui = () => window.TechOpsUI;
  const state = () => window.TechOpsState;

  function render() {
    const host = ui().$("#appContent"), rows = state().printers;
    host.innerHTML = ui().pageHeading("Inventaris Printer", "Daftar printer yang tercatat dalam database.", "ASSET MANAGEMENT") +
      `<section class="panel"><div class="table-toolbar"><div class="search-box"><i data-lucide="search"></i><input id="printerSearch" type="search" placeholder="Cari serial, unit, merek, model..."></div><span class="badge">${rows.length} perangkat</span></div><div id="printerTable"></div></section>`;
    ui().$("#printerSearch").addEventListener("input", e => drawTable(e.target.value));
    drawTable(""); ui().bindRefresh(); ui().iconRefresh();
  }

  function drawTable(query) {
    const all = state().printers, q = String(query || "").toLowerCase();
    const rows = all.filter(r => ["serial","unit","merek","model","tinta","ftp","mp","status"].some(k => String(r[k] ?? "").toLowerCase().includes(q)));
    const host = ui().$("#printerTable");
    if (!rows.length) { host.innerHTML = `<div class="empty-state">Tidak ada data printer yang cocok.</div>`; return; }
    host.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>NO</th><th>SERIAL</th><th>UNIT</th><th>MEREK</th><th>MODEL</th><th>TINTA</th><th>FTP</th><th>AKSI</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td class="primary-cell">${ui().escapeHTML(r.serial)}</td><td>${ui().escapeHTML(r.unit)}</td><td>${ui().escapeHTML(r.merek)}</td><td>${ui().escapeHTML(r.model)}</td><td>${ui().escapeHTML(r.tinta)}</td><td>${ui().escapeHTML(r.ftp)}</td><td><button class="table-action" data-serial="${ui().escapeHTML(r.serial)}">Detail</button></td></tr>`).join("")}</tbody></table></div><div class="table-footer"><span>Menampilkan ${rows.length} dari ${all.length} printer</span></div>`;
    host.querySelectorAll("[data-serial]").forEach(btn => btn.addEventListener("click", () => showDetail(btn.dataset.serial)));
  }

  function showDetail(serial) {
    const row = state().printers.find(x => String(x.serial) === String(serial));
    if (!row) return;
    const labels = {serial:"Serial / Asset ID",unit:"Unit",merek:"Manufacturer",model:"Model",tinta:"Tinta",ftp:"FTP",mp:"MP",status:"Status"};
    const content = Object.entries(labels).map(([k,v])=>`<div class="detail-item"><small>${v}</small><strong>${ui().escapeHTML(row[k] || "-")}</strong></div>`).join("");
    const wrap=document.createElement("div"); wrap.className="modal-backdrop";
    wrap.innerHTML=`<section class="modal"><div class="modal-header"><h2>Detail Printer</h2><button class="icon-button"><i data-lucide="x"></i></button></div><div class="detail-grid">${content}</div></section>`;
    document.body.appendChild(wrap); wrap.querySelector("button").onclick=()=>wrap.remove(); wrap.addEventListener("click",e=>{if(e.target===wrap)wrap.remove();}); ui().iconRefresh();
  }
  window.PrintersPage = { render };
})();
