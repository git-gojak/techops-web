/**
 * GoJak TechOps API connector
 * Frontend GitHub Pages -> Google Apps Script JSONP
 *
 * Public read-only requests only. Do not put secrets or passwords here.
 */
(function (global) {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbzZDgkgWTr6_JUY9pBgr6RFtm41DKA3C7bazuTNw26IVBNEpgrN72IpawsIE74HV2MK/exec";
  let sequence = 0;

  function get(action, params = {}) {
    return new Promise((resolve, reject) => {
      if (!action) return reject(new Error("Action API wajib diisi."));

      const callback = "__gojakTechOps_" + Date.now() + "_" + (++sequence);
      const script = document.createElement("script");
      let timer;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        try { delete global[callback]; } catch (_) { global[callback] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      };

      global[callback] = (payload) => {
        cleanup();
        resolve(payload);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Tidak dapat memuat respons Apps Script. Periksa URL, deployment, dan action API."));
      };

      const query = new URLSearchParams({ action, callback });
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== "") {
          query.set(key, String(value));
        }
      });

      timer = setTimeout(() => {
        cleanup();
        reject(new Error("Waktu tunggu API habis (20 detik)."));
      }, 20000);

      script.async = true;
      script.src = API_URL + "?" + query.toString();
      document.head.appendChild(script);
    });
  }

  global.TechOpsAPI = Object.freeze({ get });
})(window);
