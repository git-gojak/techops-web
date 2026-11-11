
/**
 * GOJAK TECHOPS — FRONTEND API CONNECTOR
 * GitHub Pages -> Google Apps Script
 */

(function (global) {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzZDgkgWTr6_JUY9pBgr6RFtm41DKA3C7bazuTNw26IVBNEpgrN72IpawsIE74HV2MK/exec";

  let requestCounter = 0;

  /**
   * Mengirim permintaan GET menggunakan JSONP.
   *
   * Contoh:
   * TechOpsAPI.get("computers.list")
   * TechOpsAPI.get("computers.get", { serial: "FCGBZR3" })
   */
  function get(action, params = {}) {
    return new Promise(function (resolve, reject) {
      if (!action) {
        reject(new Error("Action API wajib diisi."));
        return;
      }

      const callbackName =
        "__techOpsCallback_" +
        Date.now() +
        "_" +
        (++requestCounter);

      const script = document.createElement("script");
      let timeoutId;

      function cleanup() {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        delete global[callbackName];

        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      global[callbackName] = function (response) {
        cleanup();
        resolve(response);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("Gagal menghubungi TechOps API."));
      };

      const query = new URLSearchParams();

      query.set("action", action);

      Object.keys(params).forEach(function (key) {
        const value = params[key];

        if (value !== undefined && value !== null) {
          query.set(key, String(value));
        }
      });

      query.set("callback", callbackName);

      script.async = true;
      script.src = API_URL + "?" + query.toString();

      timeoutId = setTimeout(function () {
        cleanup();
        reject(new Error("TechOps API tidak memberikan respons."));
      }, 20000);

      document.head.appendChild(script);
    });
  }

  global.TechOpsAPI = {
    get: get
  };

})(window);
