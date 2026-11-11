
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbzZDgkgWTr6_JUY9pBgr6RFtm41DKA3C7bazuTNw26IVBNEpgrN72IpawsIE74HV2MK/exec";

  const PARENT_ORIGIN = "https://git-gojak.github.io";
  const PARENT_SOURCE = "GOJAK_TECHOPS";
  const BRIDGE_SOURCE = "GOJAK_TECHOPS_AUTH";

  let bridgeFrame = null;
  let bridgeReady = false;
  let sessionId = "";
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

  function initializeBridge() {
    return new Promise(function (resolve, reject) {
      if (bridgeReady && bridgeFrame) {
        resolve();
        return;
      }

      if (bridgeFrame) {
        const existing = bridgeFrame;

        if (existing.dataset.failed === "true") {
          existing.remove();
          bridgeFrame = null;
        } else {
          const checkInterval = setInterval(function () {
            if (bridgeReady) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);

          setTimeout(function () {
            clearInterval(checkInterval);
            if (!bridgeReady) {
              reject(new Error("AuthBridge tidak merespons."));
            }
          }, 15000);

          return;
        }
      }

      bridgeFrame = document.createElement("iframe");
      bridgeFrame.src = API_URL + "?page=auth-bridge";
      bridgeFrame.style.display = "none";
      bridgeFrame.setAttribute("aria-hidden", "true");

      bridgeFrame.onerror = function () {
        bridgeFrame.dataset.failed = "true";
        reject(new Error("Gagal memuat AuthBridge."));
      };

      document.body.appendChild(bridgeFrame);

      const checkInterval = setInterval(function () {
        if (bridgeReady) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(function () {
        clearInterval(checkInterval);

        if (!bridgeReady) {
          reject(new Error("AuthBridge tidak merespons."));
        }
      }, 15000);
    });
  }

  function send(type, payload, responseType) {
    return initializeBridge().then(function () {
      return new Promise(function (resolve, reject) {
        const requestId = createRequestId();

        pendingRequests.set(requestId, {
          resolve: resolve,
          reject: reject
        });

        bridgeFrame.contentWindow.postMessage({
          source: PARENT_SOURCE,
          type: type,
          requestId: requestId,
          payload: payload || {}
        }, PARENT_ORIGIN);

        setTimeout(function () {
          const pending = pendingRequests.get(requestId);

          if (pending) {
            pendingRequests.delete(requestId);
            reject(new Error("Permintaan ke server timeout."));
          }
        }, 30000);
      });
    });
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== PARENT_ORIGIN) return;

    if (!bridgeFrame || event.source !== bridgeFrame.contentWindow) {
      return;
    }

    const message = event.data;

    if (!message || message.source !== BRIDGE_SOURCE) return;

    if (message.type === "BRIDGE_READY") {
      bridgeReady = true;
      return;
    }

    const payload = message.payload || {};
    const requestId = payload.requestId;

    if (!requestId || !pendingRequests.has(requestId)) return;

    const pending = pendingRequests.get(requestId);
    pendingRequests.delete(requestId);

    if (payload.success) {
      pending.resolve(payload.result);
    } else {
      pending.reject(new Error(payload.message || "Permintaan gagal."));
    }
  });

  async function login(pin) {
    if (typeof pin !== "string" || !/^[0-9]{6}$/.test(pin)) {
      throw new Error("PIN harus terdiri dari 6 digit angka.");
    }

    const result = await send("LOGIN", {
      pin: pin
    }, "LOGIN_RESULT");

    if (!result || !result.success || !result.sessionId) {
      throw new Error(
        result && result.message
          ? result.message
          : "Login Admin gagal."
      );
    }

    sessionId = result.sessionId;
    user = result.user || { nama: "Admin", role: "admin" };

    notifyAuthChange();

    return result;
  }

  async function initializePin(token, pin) {
    if (typeof token !== "string" || !token) {
      throw new Error("Token inisialisasi tidak valid.");
    }

    if (typeof pin !== "string" || !/^[0-9]{6}$/.test(pin)) {
      throw new Error("PIN harus terdiri dari 6 digit angka.");
    }

    return send("INITIALIZE_PIN", {
      token: token,
      pin: pin
    }, "INITIALIZE_PIN_RESULT");
  }

  async function validateSession() {
    if (!sessionId) return false;

    try {
      const result = await send("VALIDATE_SESSION", {
        sessionId: sessionId
      }, "SESSION_RESULT");

      if (result && result.valid) {
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

  async function logout() {
    if (!sessionId) {
      clearSession();
      return true;
    }

    const currentSession = sessionId;

    try {
      await send("LOGOUT", {
        sessionId: currentSession
      }, "LOGOUT_RESULT");

      clearSession();
      return true;

    } catch (error) {
      clearSession();
      throw error;
    }
  }

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
    }, "CHANGE_PIN_RESULT");

    // Backend mengganti versi session sehingga semua sesi lama tidak berlaku.
    clearSession();

    return result;
  }

  async function request(action, payload) {
    const result = await send("API_REQUEST", {
      sessionId: sessionId || "",
      action: action,
      payload: payload || {}
    }, "API_RESULT");

    if (!result || result.success === false) {
      throw new Error(
        result && result.message
          ? result.message
          : "Permintaan data gagal."
      );
    }

    return result;
  }

  async function get(action, params) {
    const result = await request(action, params || {});
    return result.data;
  }

  function clearSession() {
    sessionId = "";
    user = null;
    notifyAuthChange();
  }

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
