
/**
 * GOJAK TECHOPS — SECURE API CONNECTOR
 *
 * Frontend : GitHub Pages
 * Backend  : Google Apps Script
 * Bridge   : AuthBridge.html
 *
 * Komunikasi:
 * GitHub Pages -> AuthBridge -> API_request -> Google Sheets
 *
 * Tidak menggunakan JSONP.
 * Password dan session tidak dikirim melalui URL.
 */

(function (global) {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzZDgkgWTr6_JUY9pBgr6RFtm41DKA3C7bazuTNw26IVBNEpgrN72IpawsIE74HV2MK/exec";

  const PARENT_ORIGIN = "https://git-gojak.github.io";

  const PARENT_SOURCE = "GOJAK_TECHOPS";
  const BRIDGE_SOURCE = "GOJAK_TECHOPS_AUTH";

  const TIMEOUT = 30000;

  let iframe = null;
  let bridgeReady = false;
  let bridgePromise = null;
  let bridgeResolve = null;
  let bridgeReject = null;

  let sequence = 0;
  let sessionId = "";
  let currentUser = null;

  const pending = new Map();

  /* ===================================================
     1. REQUEST ID
  =================================================== */

  function createRequestId() {
    sequence++;

    return (
      "gojak_" +
      Date.now() +
      "_" +
      sequence
    );
  }


  /* ===================================================
     2. EVENT AUTH
  =================================================== */

  const authListeners = new Set();

  function notifyAuth() {
    const data = {
      authenticated: !!sessionId,
      user: currentUser
    };

    authListeners.forEach(function (callback) {
      try {
        callback(data);
      } catch (error) {
        console.error("Auth listener:", error);
      }
    });
  }

  function onAuthChange(callback) {
    if (typeof callback !== "function") {
      throw new Error("Callback harus berupa function.");
    }

    authListeners.add(callback);

    return function () {
      authListeners.delete(callback);
    };
  }


  /* ===================================================
     3. MEMBUAT IFRAME BRIDGE
  =================================================== */

  function createBridge() {
    if (bridgePromise) {
      return bridgePromise;
    }

    bridgePromise = new Promise(function (resolve, reject) {
      bridgeResolve = resolve;
      bridgeReject = reject;

      iframe = document.createElement("iframe");

      iframe.id = "gojakTechOpsAuthBridge";
      iframe.title = "GoJak TechOps Authentication Bridge";

      iframe.style.position = "fixed";
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.style.left = "-10000px";
      iframe.style.top = "-10000px";
      iframe.style.border = "0";
      iframe.style.opacity = "0";

      iframe.setAttribute("aria-hidden", "true");

      iframe.src = API_URL + "?page=auth-bridge";

      iframe.onerror = function () {
        failBridge(
          new Error("AuthBridge tidak dapat dimuat.")
        );
      };

      document.body.appendChild(iframe);

      setTimeout(function () {
        if (!bridgeReady) {
          failBridge(
            new Error(
              "AuthBridge tidak merespons. Periksa deployment Apps Script."
            )
          );
        }
      }, TIMEOUT);
    });

    return bridgePromise;
  }


  function failBridge(error) {
    if (bridgeReady) return;

    bridgeReady = false;

    if (bridgeReject) {
      bridgeReject(error);
      bridgeReject = null;
      bridgeResolve = null;
    }
  }


  /* ===================================================
     4. MENERIMA PESAN DARI BRIDGE
  =================================================== */

  global.addEventListener("message", function (event) {

    if (!iframe) return;

    // Pesan harus berasal dari iframe yang kita buat.
    if (event.source !== iframe.contentWindow) return;

    const message = event.data;

    if (
      !message ||
      message.source !== BRIDGE_SOURCE ||
      typeof message.type !== "string"
    ) {
      return;
    }

    const payload = message.payload || {};

    if (message.type === "BRIDGE_READY") {

      bridgeReady = true;

      if (bridgeResolve) {
        bridgeResolve(true);
        bridgeResolve = null;
        bridgeReject = null;
      }

      return;
    }

    const requestId = String(payload.requestId || "");

    if (!requestId || !pending.has(requestId)) {
      return;
    }

    const request = pending.get(requestId);

    clearTimeout(request.timer);
    pending.delete(requestId);

    if (request.type !== message.type) {
      request.reject(
        new Error("Jenis respons AuthBridge tidak sesuai.")
      );
      return;
    }

    if (payload.success === false) {
      request.reject(
        new Error(payload.message || "Permintaan gagal.")
      );
      return;
    }

    request.resolve(payload.result);
  });


  /* ===================================================
     5. MENGIRIM PESAN KE BRIDGE
  =================================================== */

  async function send(type, payload, responseType) {

    await createBridge();

    if (!iframe || !iframe.contentWindow) {
      throw new Error("AuthBridge belum tersedia.");
    }

    const requestId = createRequestId();

    return new Promise(function (resolve, reject) {

      const timer = setTimeout(function () {
        pending.delete(requestId);

        reject(
          new Error("Waktu tunggu AuthBridge habis.")
        );

      }, TIMEOUT);

      pending.set(requestId, {
        resolve: resolve,
        reject: reject,
        timer: timer,
        type: responseType
      });

      iframe.contentWindow.postMessage({

        source: PARENT_SOURCE,

        type: type,

        requestId: requestId,

        ...(payload || {})

      }, "*");

    });
  }


  /* ===================================================
     6. LOGIN
  =================================================== */

  async function login(nama, password) {

    nama = String(nama || "").trim();
    password = String(password || "");

    if (!nama || !password) {
      throw new Error("Nama dan password wajib diisi.");
    }

    const result = await send(
      "LOGIN",
      {
        nama: nama,
        password: password
      },
      "LOGIN_RESULT"
    );

    if (
      !result ||
      result.success !== true ||
      !result.sessionId ||
      !result.user
    ) {
      throw new Error(
        result && result.message
          ? result.message
          : "Login gagal."
      );
    }

    sessionId = result.sessionId;
    currentUser = result.user;

    notifyAuth();

    return {
      success: true,
      user: currentUser
    };
  }


  /* ===================================================
     7. VALIDASI SESSION
  =================================================== */

  async function validateSession() {

    if (!sessionId) {
      return {
        success: false,
        authenticated: false,
        message: "Belum ada sesi login."
      };
    }

    try {

      const result = await send(
        "VALIDATE_SESSION",
        {
          sessionId: sessionId
        },
        "SESSION_RESULT"
      );

      if (
        !result ||
        result.success !== true
      ) {
        clearSession();

        return {
          success: false,
          authenticated: false
        };
      }

      // authValidateSession_ mengembalikan data user.
      const user = result.user || result;

      if (!user.role || !user.nama) {
        throw new Error("Data pengguna tidak valid.");
      }

      currentUser = {
        nama: user.nama,
        role: user.role
      };

      notifyAuth();

      return {
        success: true,
        authenticated: true,
        user: currentUser
      };

    } catch (error) {

      clearSession();

      return {
        success: false,
        authenticated: false,
        message: error.message
      };
    }
  }


  /* ===================================================
     8. LOGOUT
  =================================================== */

  async function logout() {

    if (!sessionId) {
      clearSession();

      return {
        success: true
      };
    }

    const oldSession = sessionId;

    try {

      const result = await send(
        "LOGOUT",
        {
          sessionId: oldSession
        },
        "LOGOUT_RESULT"
      );

      clearSession();

      return result || {
        success: true
      };

    } catch (error) {

      throw error;
    }
  }


  function clearSession() {
    sessionId = "";
    currentUser = null;

    notifyAuth();
  }


  /* ===================================================
     9. API REQUEST TERLINDUNGI
  =================================================== */

  async function request(action, payload = {}) {

    if (!sessionId) {
      throw new Error("Silakan login terlebih dahulu.");
    }

    if (!action) {
      throw new Error("Action API wajib diisi.");
    }

    const result = await send(
      "API_REQUEST",
      {
        sessionId: sessionId,
        action: action,
        payload: payload
      },
      "API_RESULT"
    );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result && result.message
          ? result.message
          : "Permintaan API gagal."
      );
    }

    return result;
  }


  /* ===================================================
     10. GET — KOMPATIBILITAS MODUL LAMA
  =================================================== */

  async function get(action, params = {}) {

    const result = await request(
      action,
      params
    );

    return result.data;
  }


  /* ===================================================
     11. STATUS AUTENTIKASI
  =================================================== */

  function isAuthenticated() {
    return !!sessionId;
  }

  function getUser() {
    return currentUser;
  }


  /* ===================================================
     12. PUBLIC API
  =================================================== */

  global.TechOpsAPI = Object.freeze({

    get: get,

    request: request,

    login: login,

    validateSession: validateSession,

    logout: logout,

    isAuthenticated: isAuthenticated,

    getUser: getUser,

    onAuthChange: onAuthChange

  });

})(window);
