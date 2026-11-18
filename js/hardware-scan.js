(function () {
  "use strict";

  const ENDPOINT = "http://127.0.0.1:47831";
  const STYLE_ID = "techops-hardware-scan-style";

  const GROUPS = [
    {
      title: "Identitas Perangkat",
      icon: "monitor",
      fields: [
        ["computerName", "Computer Name"],
        ["manufacturer", "Manufacturer"],
        ["model", "Model"],
        ["assetSerialID", "Asset / Serial ID"]
      ]
    },
    {
      title: "Spesifikasi Hardware",
      icon: "cpu",
      fields: [
        ["cpu", "Processor"],
        ["core", "Core"],
        ["thread", "Thread"],
        ["ram", "RAM"],
        ["storage", "Storage"],
        ["gpu", "GPU"],
        ["operatingSystem", "Operating System"]
      ]
    },
    {
      title: "Jaringan",
      icon: "network",
      fields: [
        ["ipAddress", "IP Address"],
        ["gateway", "Gateway"]
      ]
    }
  ];

  const esc = value => String(value ?? "-").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hwscan-backdrop{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:18px}
      .hwscan-dialog{width:min(760px,100%);max-height:90vh;overflow:auto;background:var(--surface,#fff);color:var(--text,#172033);border:1px solid var(--border,#e5e7eb);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.25)}
      .hwscan-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px;border-bottom:1px solid var(--border,#e5e7eb)}
      .hwscan-head h2{font-size:18px;margin:0}.hwscan-head p{font-size:12px;opacity:.7;margin:5px 0 0}
      .hwscan-close{border:0;background:transparent;font-size:24px;cursor:pointer;color:inherit}
      .hwscan-body{padding:20px 22px}.hwscan-status{padding:12px 14px;border-radius:10px;background:var(--surface-muted,#f3f4f6);font-size:13px;margin-bottom:16px}
      .hwscan-status.error{background:#fef2f2;color:#991b1b}.hwscan-groups{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .hwscan-group{border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:14px;min-width:0}
      .hwscan-group h3{font-size:13px;margin:0 0 12px;display:flex;gap:8px;align-items:center}
      .hwscan-field{display:grid;grid-template-columns:125px minmax(0,1fr);gap:10px;padding:7px 0;border-top:1px solid var(--border,#edf0f3);font-size:12px}
      .hwscan-field span:first-child{opacity:.65}.hwscan-field strong{font-weight:600;overflow-wrap:anywhere}
      .hwscan-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      .hwscan-actions button{border:1px solid var(--border,#d1d5db);border-radius:9px;padding:9px 14px;background:var(--surface,#fff);color:inherit;cursor:pointer}
      .hwscan-actions .primary{background:var(--primary,#2563eb);border-color:var(--primary,#2563eb);color:white}
      .hwscan-note{font-size:11px;opacity:.65;margin-top:12px}
      @media(max-width:620px){.hwscan-groups{grid-template-columns:1fr}.hwscan-field{grid-template-columns:112px minmax(0,1fr)}.hwscan-backdrop{padding:8px}.hwscan-dialog{max-height:95vh}}
    `;
    document.head.appendChild(style);
  }

  function close() {
    document.querySelector(".hwscan-backdrop")?.remove();
    document.body.classList.remove("modal-open");
  }

  function renderResults(data) {
    const groups = GROUPS.map(group => `
      <section class="hwscan-group">
        <h3><i data-lucide="${group.icon}"></i>${esc(group.title)}</h3>
        ${group.fields.map(([key, label]) => `
          <div class="hwscan-field">
            <span>${esc(label)}</span>
            <strong>${esc(data[key] || "-")}</strong>
          </div>`).join("")}
      </section>`).join("");

    return `
      <div class="hwscan-status">Scan berhasil. Data berikut hanya ditampilkan di halaman ini dan tidak disimpan ke inventaris.</div>
      <div class="hwscan-groups">${groups}</div>
      <p class="hwscan-note">Waktu scan: ${esc(data.scannedAt || "-")}</p>
      <div class="hwscan-actions">
        <button type="button" data-hwscan-close>Tutup</button>
        <button type="button" class="primary" data-hwscan-again>Scan Ulang</button>
      </div>`;
  }

  async function runScan(body) {
    body.innerHTML = `<div class="hwscan-status">Menghubungi collector lokal dan membaca spesifikasi komputer...</div>`;
    try {
      const response = await fetch(`${ENDPOINT}/scan`, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        credentials: "omit"
      });
      if (!response.ok) throw new Error(`Collector merespons HTTP ${response.status}.`);
      const result = await response.json();
      if (!result.success || !result.data) throw new Error(result.message || "Hasil scan tidak valid.");
      body.innerHTML = renderResults(result.data);
      body.querySelector("[data-hwscan-close]")?.addEventListener("click", close);
      body.querySelector("[data-hwscan-again]")?.addEventListener("click", () => runScan(body));
      if (window.lucide) window.lucide.createIcons();
    } catch (error) {
      body.innerHTML = `
        <div class="hwscan-status error">
          <strong>Collector lokal belum dapat dihubungi.</strong><br>
          ${esc(error.message)}<br><br>
          Pastikan Hardware Collector sudah diinstal dan aktif di Windows. Jika baru selesai instalasi, muat ulang halaman TechOps.
        </div>
        <div class="hwscan-actions">
          <button type="button" data-hwscan-close>Tutup</button>
          <button type="button" class="primary" data-hwscan-again>Coba Lagi</button>
        </div>`;
      body.querySelector("[data-hwscan-close]")?.addEventListener("click", close);
      body.querySelector("[data-hwscan-again]")?.addEventListener("click", () => runScan(body));
    }
  }

  function open() {
    addStyles();
    close();
    const backdrop = document.createElement("div");
    backdrop.className = "hwscan-backdrop";
    backdrop.innerHTML = `
      <section class="hwscan-dialog" role="dialog" aria-modal="true" aria-labelledby="hwscan-title">
        <header class="hwscan-head">
          <div><h2 id="hwscan-title">Scan Spesifikasi Komputer</h2><p>Windows Hardware Collector · Mode baca saja</p></div>
          <button class="hwscan-close" type="button" aria-label="Tutup">&times;</button>
        </header>
        <div class="hwscan-body"><div class="hwscan-status">Menyiapkan scan...</div></div>
      </section>`;
    document.body.appendChild(backdrop);
    document.body.classList.add("modal-open");
    backdrop.querySelector(".hwscan-close").addEventListener("click", close);
    backdrop.addEventListener("click", event => { if (event.target === backdrop) close(); });
    runScan(backdrop.querySelector(".hwscan-body"));
  }

  window.TechOpsHardwareScan = { open, close };
})();
