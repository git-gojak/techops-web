
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzZDgkgWTr6_JUY9pBgr6RFtm41DKA3C7bazuTNw26IVBNEpgrN72IpawsIE74HV2MK/exec";

  const PARENT_ORIGIN = "https://git-gojak.github.io";
  const PARENT_SOURCE = "GOJAK_TECHOPS";
  const BRIDGE_SOURCE = "GOJAK_TECHOPS_AUTH";

  let bridgeFrame = null;
  let bridgeReady = false;
  let bridgePromise = null;
  let bridgeResolve = null;
  let bridgeReject = null;

  let bridgeWindow = null;
  let bridgeOrigin = "";

const SESSION_STORAGE_KEY = "GOJAK_TECHOPS_SESSION";

let sessionId = "";

try {
  sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY) || "";
} catch (error) {
  console.warn("Tidak dapat membaca sesi Admin:", error);
}

let user = null;
let requestCounter = 0;

  const pendingRequests = new Map();
  const authListeners = [];

  function createRequestId() {
    requestCounter++;
    return "req_" + Date.now() + "_" + requestCounter;
  }

  function notifyAuthChange() {
    authListeners.forEach(function (callback) {
      try {
        callback({
          authenticated: !!sessionId,
          user: user
        });
      } catch (error) {
        console.error("Auth listener error:", error);
      }
    });
  }

  function clearSession() {
  sessionId = "";
  user = null;

  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Tidak dapat menghapus sesi Admin:", error);
  }

  notifyAuthChange();
}

  function isTrustedBridgeOrigin(origin) {
    try {
      const hostname = new URL(origin).hostname;

      return hostname === "script.google.com" ||
        hostname.endsWith(".googleusercontent.com");
    } catch (error) {
      return false;
    }
  }

  function isBridgeFrameSource(source) {
    if (!bridgeFrame || !source) return false;

    const pending = [bridgeFrame.contentWindow];
    const visited = new Set();

    while (pending.length) {
      const current = pending.shift();

      if (!current || visited.has(current)) continue;

      if (current === source) return true;

      visited.add(current);

      try {
        for (let i = 0; i < current.frames.length; i++) {
          pending.push(current.frames[i]);
        }
      } catch (error) {
        // Frame lintas domain yang tidak dapat diperiksa dilewati.
      }
    }

    return false;
  }

  function initializeBridge() {
    if (bridgeReady && bridgeFrame && bridgeWindow) {
      return Promise.resolve();
    }

    if (bridgePromise) {
      return bridgePromise;
    }

    bridgePromise = new Promise(function (resolve, reject) {
      bridgeResolve = resolve;
      bridgeReject = reject;

      bridgeFrame = document.createElement("iframe");
      bridgeFrame.src = API_URL + "?page=auth-bridge";
      bridgeFrame.style.display = "none";
      bridgeFrame.setAttribute("aria-hidden", "true");
      bridgeFrame.setAttribute("title", "GoJak TechOps Auth Bridge");

      const timeout = setTimeout(function () {
        if (!bridgeReady) {
          bridgeReady = false;
          bridgeWindow = null;
          bridgeOrigin = "";
          bridgePromise = null;

          bridgeFrame?.remove();
          bridgeFrame = null;

          if (bridgeReject) {
            bridgeReject(new Error("AuthBridge tidak merespons."));
          }

          bridgeResolve = null;
          bridgeReject = null;
        }
      }, 20000);

      bridgeFrame.onerror = function () {
        clearTimeout(timeout);

        bridgeReady = false;
        bridgeWindow = null;
        bridgeOrigin = "";
        bridgePromise = null;

        if (bridgeReject) {
          bridgeReject(new Error("Gagal memuat AuthBridge."));
        }

        bridgeResolve = null;
        bridgeReject = null;

        bridgeFrame?.remove();
        bridgeFrame = null;
      };

      document.body.appendChild(bridgeFrame);

      const originalResolve = resolve;

      bridgeResolve = function () {
        clearTimeout(timeout);
        originalResolve();
      };
    });

    return bridgePromise;
  }

  function send(type, payload) {
    return initializeBridge().then(function () {
      return new Promise(function (resolve, reject) {
        if (!bridgeWindow || !bridgeOrigin || !bridgeReady) {
          reject(new Error("Koneksi AuthBridge belum siap."));
          return;
        }

        const requestId = createRequestId();

        const timeout = setTimeout(function () {
          pendingRequests.delete(requestId);
          reject(new Error("Permintaan ke server timeout."));
        }, 30000);

        pendingRequests.set(requestId, {
          resolve: function (result) {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: function (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        try {
          // Kirim ke frame yang benar-benar mengirim BRIDGE_READY.
          bridgeWindow.postMessage({
            source: PARENT_SOURCE,
            type: type,
            requestId: requestId,
            payload: payload || {}
          }, bridgeOrigin);

        } catch (error) {
          clearTimeout(timeout);
          pendingRequests.delete(requestId);
          reject(error);
        }
      });
    });
  }

  window.addEventListener("message", function (event) {
    if (!bridgeFrame) return;

    if (!isBridgeFrameSource(event.source)) return;

    if (!isTrustedBridgeOrigin(event.origin)) return;

    const message = event.data;

    if (!message || message.source !== BRIDGE_SOURCE) return;

    if (message.type === "BRIDGE_READY") {
      bridgeWindow = event.source;
      bridgeOrigin = event.origin;
      bridgeReady = true;

      if (bridgeResolve) {
        bridgeResolve();
      }

      bridgeResolve = null;
      bridgeReject = null;

      return;
    }

    if (event.source !== bridgeWindow) return;
    if (event.origin !== bridgeOrigin) return;

    const payload = message.payload || {};
    const requestId = payload.requestId;

    if (!requestId || !pendingRequests.has(requestId)) return;

    const pending = pendingRequests.get(requestId);
    pendingRequests.delete(requestId);

    if (payload.success) {
      pending.resolve(payload.result);
    } else {
      pending.reject(
        new Error(payload.message || "Permintaan gagal.")
      );
    }
  });

  /* LOGIN ADMIN */

  async function login(pin) {
    if (typeof pin !== "string" || !/^[0-9]{6}$/.test(pin)) {
      throw new Error("PIN harus terdiri dari 6 digit angka.");
    }

    const result = await send("LOGIN", { pin: pin });

    if (!result || !result.success || !result.sessionId) {
      throw new Error(
        result?.message || "Login Admin gagal."
      );
    }

sessionId = result.sessionId;

try {
  sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
} catch (error) {
  console.warn("Tidak dapat menyimpan sesi Admin:", error);
}

user = result.user || {
  nama: "Admin",
  role: "Admin"
};

    notifyAuthChange();

    return result;
  }

  /* INISIALISASI PIN */

  async function initializePin(token, pin) {
    if (!/^\d{6}$/.test(String(pin || ""))) {
      throw new Error("PIN harus terdiri dari 6 digit.");
    }

    const result = await send("INITIALIZE_PIN", {
      token: token,
      pin: pin
    });

    if (!result || result.success === false) {
      throw new Error(
        result?.message || "Gagal menginisialisasi PIN."
      );
    }

    return result;
  }

  /* VALIDASI SESSION */

  async function validateSession() {
    if (!sessionId) return false;

    try {
      const result = await send("VALIDATE_SESSION", {
        sessionId: sessionId
      });

      if (result && result.success === true) {
        user = result.user || user;
        notifyAuthChange();
        return true;
      }

      clearSession();
      return false;

    } catch (error) {
      clearSession();
      return false;
    }
  }

  /* LOGOUT ADMIN */

  async function logout() {
    if (!sessionId) {
      clearSession();
      return true;
    }

    const currentSession = sessionId;

    try {
      const result = await send("LOGOUT", {
        sessionId: currentSession
      });

      if (!result || result.success === false) {
        throw new Error(
          result?.message || "Logout gagal."
        );
      }

      clearSession();
      return true;

    } catch (error) {
      clearSession();
      throw error;
    }
  }

  /* GANTI PIN ADMIN */

  async function changePin(oldPin, newPin) {
    if (!sessionId) {
      throw new Error("Admin harus login terlebih dahulu.");
    }

    if (
      !/^[0-9]{6}$/.test(oldPin) ||
      !/^[0-9]{6}$/.test(newPin)
    ) {
      throw new Error("PIN harus terdiri dari 6 digit angka.");
    }

    if (oldPin === newPin) {
      throw new Error("PIN baru harus berbeda dari PIN lama.");
    }

    const result = await send("CHANGE_PIN", {
      sessionId: sessionId,
      oldPin: oldPin,
      newPin: newPin
    });

    if (result && result.success === false) {
      throw new Error(result.message || "Gagal mengganti PIN.");
    }

    clearSession();

    return result;
  }

  /* REQUEST DATA */

  async function request(action, payload) {
    const result = await send("API_REQUEST", {
      sessionId: sessionId || "",
      action: action,
      payload: payload || {}
    });

    if (!result || result.success === false) {
      throw new Error(
        result?.message || "Permintaan data gagal."
      );
    }

    return result;
  }

  async function get(action, params) {
    const result = await request(action, params || {});
    return result.data;
  }

  /* STATUS AUTHENTIKASI */

  function isAuthenticated() {
    return !!sessionId;
  }

  function getUser() {
    return user;
  }

  function onAuthChange(callback) {
    if (typeof callback === "function") {
      authListeners.push(callback);
    }
  }

  /* PUBLIC API */

  window.TechOpsAPI = {
    get: get,
    request: request,
    login: login,
    initializePin: initializePin,
    validateSession: validateSession,
    logout: logout,
    changePin: changePin,
    isAuthenticated: isAuthenticated,
    getUser: getUser,
    onAuthChange: onAuthChange
  };

})();
