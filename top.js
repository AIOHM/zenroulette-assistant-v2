// ✅ top.js for ZenRoulette Assistant side panel
(function () {
  if (typeof chrome === "undefined" || !chrome.runtime) {
    const previewStorage = {};
    const runtimeListeners = [];

    const ensureCallback = (cb, payload) => {
      if (typeof cb === "function") {
        cb(payload);
      }
    };

    const localStorageApi = {
      get(keys, cb) {
        let result = {};
        if (Array.isArray(keys)) {
          keys.forEach((k) => {
            if (Object.prototype.hasOwnProperty.call(previewStorage, k)) {
              result[k] = previewStorage[k];
            }
          });
        } else if (typeof keys === "string") {
          if (Object.prototype.hasOwnProperty.call(previewStorage, keys)) {
            result[keys] = previewStorage[keys];
          }
        } else if (keys && typeof keys === "object") {
          result = Object.assign({}, keys);
          Object.keys(keys).forEach((k) => {
            if (Object.prototype.hasOwnProperty.call(previewStorage, k)) {
              result[k] = previewStorage[k];
            }
          });
        } else {
          result = Object.assign({}, previewStorage);
        }
        ensureCallback(cb, result);
        return Promise.resolve(result);
      },
      set(values, cb) {
        Object.assign(previewStorage, values || {});
        ensureCallback(cb, undefined);
        return Promise.resolve();
      },
      remove(keys, cb) {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach((k) => delete previewStorage[k]);
        ensureCallback(cb, undefined);
        return Promise.resolve();
      }
    };

    window.chrome = {
      runtime: {
        lastError: null,
        sendMessage(_msg, cb) {
          ensureCallback(cb, { success: false, preview: true });
        },
        onMessage: {
          addListener(fn) {
            runtimeListeners.push(fn);
          }
        }
      },
      storage: { local: localStorageApi },
      downloads: {
        download(_opts, cb) {
          ensureCallback(cb, 0);
        }
      },
      tabs: {
        query(_query, cb) {
          ensureCallback(cb, []);
          return Promise.resolve([]);
        },
        sendMessage(_tabId, _msg, _opts, cb) {
          if (typeof _opts === "function") {
            ensureCallback(_opts, undefined);
          } else {
            ensureCallback(cb, undefined);
          }
        }
      },
      scripting: {
        executeScript() {
          return Promise.resolve([]);
        }
      },
      webNavigation: {
        getAllFrames(_opts, cb) {
          ensureCallback(cb, []);
        }
      },
      action: {
        onClicked: {
          addListener() {}
        }
      },
      sidePanel: {
        open() {
          return Promise.resolve();
        },
        setPanelBehavior() {
          return Promise.resolve();
        }
      }
    };
  }

  const IS_PREVIEW_MODE = !chrome.runtime || !chrome.runtime.id;

  var playData = [];
  var allSessions = 0;
  var winSessions = 0;
  var jackpotSessions = 0;
  var waitSessions = 0;
  var loggedIn = false;
  var sessionActive = false;
  var recordingActive = false;
  var lastLiveNumbers = [];
  var liveNumbersPollTimer = null;
  var lastPrimaryDashboardAt = 0;
  var headerResetTimer = null;
  var recordingStream = null;
  var mediaRecorder = null;
  var recordingChunks = [];
  var panelInitialized = false;
  var lastStoredDashboardKey = null;
  var lastStableDashboardAt = 0;
  var currentDashboardState = {
    winner: null,
    zoneNumbers: [],
    betNumbers: [],
    candidateNumbers: [],
    jackpotNumbers: [],
    goldenNumbers: [],
    standardNumbers: [],
    patternNumbers: [],
    activePatterns: [],
    patternTargets: {},
    strategyMode: "STANDARD",
    decision: "WAIT",
    isWaitRound: true,
    recentNumbers: [],
    mathCounts: { std: 0, gold: 0, jp: 0 },
    updatedAt: null,
    dealer: "zra"
  };
  var cachedStrategy = {
    favoriteNumbers: [],
    betFavorites: [],
    highStakeNumbers: []
  };

  // Gemini Assistant State Variables
  var geminiApiKey = "";
  var geminiEnabled = false;
  var geminiConnectedGoogle = false;
  const DEV_BYPASS_AUTH = false;
  const LICENSE_STORAGE_KEY = "zrrLicense";
  const INSTALLATION_STORAGE_KEY = "zrrInstallationId";
  var licenseCountdownTimer = null;
  var licenseExpiryRefreshPending = false;
  var persistentJackpotsLt = [];
  var lastWinnerForJackpotsLt = null;
  var lastCnsHitWinnerLt = null;
  var currentMathCounts = { std: 0, gold: 0, jp: 0 };
  var currentMathCountsLt = { std: 0, gold: 0, jp: 0 };
  var hasUserModifiedBudget = false;
  var cachedRecentNumbers = [];
  var cachedHighStakeNumbers = [];
  var cachedHighStakeNumbersLt = [];
  var cachedJackpotNumbersLt = [];
  var cachedZoneStrategy = {};
  var cachedPatternNumbersLt = [];
  var cachedDuplicatesLt = new Set();
  var cachedIsWaitRoundLt = true;
  var lastPatternChipStatesLt = { ZERO: false, REP: false, CNS: false, PREF: false };
  var activeCanvasId = "canvas";
  var enabledPatternsLt = { zero: true, rep: true, cns: true, pref: true };
  var customPrefMappingLt = {};
  var lastPatternReport = null;
  var currentTableType = "UNKNOWN";
  var multiplierHitCount = 0;
  const defaultPrefMappingLt = {
    "0": ["10"],
    "1": ["3"],
    "2": ["11"],
    "3": ["1", "21"],
    "4": ["10"],
    "5": ["8"],
    "6": ["36"],
    "7": ["17", "27"],
    "8": ["18", "28"],
    "9": ["23"],
    "10": ["4", "0", "20", "30"],
    "11": ["2", "8", "13"],
    "12": ["36"],
    "13": ["31", "22"],
    "14": ["1", "9"],
    "15": ["1"],
    "16": ["23", "32"],
    "17": ["7", "27"],
    "18": ["8", "28", "7", "9"],
    "19": ["9", "29"],
    "20": ["10", "30", "4", "0"],
    "21": ["27", "31", "12"],
    "22": ["13"],
    "23": ["32"],
    "24": ["22", "36"],
    "25": ["29"],
    "26": ["34", "3", "0", "19"],
    "27": ["21", "35"],
    "28": ["8", "18", "7", "9"],
    "29": ["9", "19"],
    "30": ["8", "11", "22", "20"],
    "31": ["13"],
    "32": ["23"],
    "33": ["6"],
    "34": ["25", "26", "27", "13"],
    "35": ["27", "32", "19"],
    "36": ["24"]
  };


  // Wheel configuration
  var numbers = ["0", "32", "15", "19", "4", "21", "2", "25", "17", "34", "6", "27", "13", "36", "11", "30", "8", "23", "10", "5", "24", "16", "33", "1", "20", "14", "31", "9", "22", "18", "29", "7", "28", "12", "35", "3", "26"];
  var colors = ["green", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222", "#e0232a", "#222222"];
  const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const BLACK_NUMBERS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);
  var strategyCore = window.ZenRouletteStrategy || null;
  var arc = Math.PI / 37 * 2;
  var startAngle = 3 * Math.PI / 2 - arc / 2;
  var ctx;
  var lastCenterNumbers = [];

  // DOM Elements
  const dashboardTab = document.getElementById("dashboardTab");
  const lightningTab = document.getElementById("lightningTab");
  const sessionTab = document.getElementById("sessionTab");
  const accountTab = document.getElementById("accountTab");

  const dashboardContent = document.getElementById("dashboardContent");
  const lightningContent = document.getElementById("lightningContent");
  const sessionContent = document.getElementById("sessionContent");
  const accountContent = document.getElementById("accountContent");

  const dashboardLocked = document.getElementById("dashboardLocked");
  const dashboardUnlocked = document.getElementById("dashboardUnlocked");
  const lightningLocked = document.getElementById("lightningLocked");
  const lightningUnlocked = document.getElementById("lightningUnlocked");
  const sessionLocked = document.getElementById("sessionLocked");
  const sessionUnlocked = document.getElementById("sessionUnlocked");

  const loginContainer = document.getElementById("zrr-login-container");
  const memberContainer = document.getElementById("zrr-member-container");
  const licenseContainer = document.getElementById("zrr-license-container");
  const promoBanner = document.getElementById("zrr-promo-banner");
  const memberEmail = document.getElementById("zrr-member-email");
  const membershipType = document.getElementById("zrr-membership");
  const licenseEmailInput = document.getElementById("zrr-license-email");
  const licenseCodeInput = document.getElementById("zrr-license-code");
  const licenseStatusBox = document.getElementById("zrr-license-status");
  const licenseExpiryValue = document.getElementById("zrr-license-expiry");
  const licenseCountdownValue = document.getElementById("zrr-license-countdown");
  const headerElement = document.getElementById("zrr-header");
  const headerBadge = document.getElementById("zrr-header-badge");
  const headerHelper = document.getElementById("zrr-header-helper");
  const sessionNote = document.getElementById("zrr-session-note");
  const startSessionBtn = document.getElementById("zrr-start-session");
  const endSessionBtn = document.getElementById("zrr-end-session");
  const recordSessionBtn = document.getElementById("zrr-record-session");

  // Gemini Assistant UI elements
  const geminiToggle = document.getElementById("zrr-gemini-toggle");
  const geminiKeyInput = document.getElementById("zrr-gemini-key");
  const geminiSaveBtn = document.getElementById("zrr-gemini-save-btn");
  const geminiGoogleBtn = document.getElementById("zrr-gemini-google-btn");
  const geminiFeed = document.getElementById("zrr-gemini-feed");
  const geminiText = document.getElementById("zrr-gemini-text");
  const geminiStatusDot = document.getElementById("zrr-gemini-status-dot");
  const geminiConfigPanel = document.getElementById("zrr-gemini-config");
  const geminiModelBadge = document.getElementById("zrr-gemini-model-badge");

  function setHeaderState(state, options) {
    const settings = options || {};
    if (!headerElement) {
      return;
    }

    if (headerResetTimer) {
      clearTimeout(headerResetTimer);
      headerResetTimer = null;
    }

    headerElement.classList.remove("state-idle", "state-live", "state-win", "state-loss", "state-victory", "state-gold");
    headerElement.classList.add(`state-${state}`);

    if (headerBadge) {
      headerBadge.innerText = settings.badge || state;
    }

    if (headerHelper) {
      headerHelper.innerText = settings.helper || "";
    }

    if (sessionNote) {
      sessionNote.innerText = settings.note || "";
    }

    if (settings.autoRevert) {
      const fallbackState = sessionActive ? "live" : "idle";
      const fallbackBadge = sessionActive ? "Live" : "Idle";
      const revertDelay = settings.revertDelayMs || 8500;
      headerResetTimer = setTimeout(() => {
        setHeaderState(fallbackState, {
          badge: fallbackBadge,
          helper: sessionActive ? "live log" : "ready",
          note: sessionActive ? "logging" : ""
        });
      }, revertDelay);
    }
  }

  function updateSessionButtons() {
    if (startSessionBtn) {
      startSessionBtn.disabled = sessionActive;
    }
    if (endSessionBtn) {
      endSessionBtn.disabled = !sessionActive;
    }
    if (recordSessionBtn) {
      recordSessionBtn.disabled = !sessionActive;
      recordSessionBtn.classList.toggle("hidden", !sessionActive);
      recordSessionBtn.classList.toggle("recording", recordingActive);
      recordSessionBtn.setAttribute("data-tooltip", recordingActive ? "Stop Recording" : "Record Session");
      recordSessionBtn.setAttribute("aria-label", recordingActive ? "Stop Recording" : "Record Session");
    }
  }

  function getRecordingMimeType() {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];

    for (let i = 0; i < candidates.length; i++) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidates[i])) {
        return candidates[i];
      }
    }

    return "video/webm";
  }

  function stopRecordingStream() {
    if (recordingStream) {
      recordingStream.getTracks().forEach((track) => track.stop());
      recordingStream = null;
    }
  }

  function saveRecordingBlob() {
    if (!recordingChunks || recordingChunks.length === 0) {
      return;
    }

    const blob = new Blob(recordingChunks, { type: getRecordingMimeType() });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    chrome.downloads.download({
      url,
      filename: `zra-session-${timestamp}.webm`
    }, () => {
      URL.revokeObjectURL(url);
    });
  }

  function finalizeRecordingState() {
    recordingActive = false;
    mediaRecorder = null;
    stopRecordingStream();
    updateSessionButtons();

    if (sessionActive) {
      setHeaderState("live", {
        badge: "Live",
        helper: "live log",
        note: "logging"
      });
    } else {
      setHeaderState("idle", {
        badge: "Ended",
        helper: "saved state",
        note: "archived"
      });
    }
  }

  function stopSessionRecording() {
    if (!mediaRecorder) {
      finalizeRecordingState();
      return;
    }

    const recorder = mediaRecorder;
    if (recorder.state !== "inactive") {
      recorder.stop();
    } else {
      finalizeRecordingState();
    }
  }

  async function startSessionRecording() {
    if (!sessionActive || recordingActive) {
      return;
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.id) {
        throw new Error("No active roulette tab found");
      }

      const activeUrl = String(activeTab.url || "");
      if (activeUrl.startsWith("chrome://") || activeUrl.startsWith("chrome-extension://")) {
        throw new Error("Open the roulette tab first");
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: 1920,
          height: 1080,
          frameRate: 30
        },
        audio: true
      });

      recordingStream = stream;
      recordingChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: getRecordingMimeType() });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunks.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        saveRecordingBlob();
        recordingChunks = [];
        finalizeRecordingState();
      };
      mediaRecorder.onerror = () => {
        recordingChunks = [];
        finalizeRecordingState();
      };

      mediaRecorder.start(1000);
      recordingActive = true;
      updateSessionButtons();
      setHeaderState("live", {
        badge: "Rec",
        helper: "capture on",
        note: "recording"
      });
    } catch (error) {
      recordingActive = false;
      stopRecordingStream();
      updateSessionButtons();
      setHeaderState("loss", {
        badge: "Err",
        helper: "capture blocked",
        note: "rec fail"
      });
    }
  }

  function toggleSessionRecording() {
    if (recordingActive) {
      stopSessionRecording();
      return;
    }
    startSessionRecording();
  }

  function updateSessionStatsUi() {
    document.getElementById("stat-plays-val").innerText = allSessions;
    document.getElementById("stat-ratio-val").innerText = `${allSessions > 0 ? ((winSessions / allSessions) * 100).toFixed(0) : 0}%`;
    document.getElementById("stat-wins-val").innerText = winSessions;
    document.getElementById("stat-losses-val").innerText = allSessions - winSessions;
    document.getElementById("stat-jp-val").innerText = jackpotSessions;
    const waitsEl = document.getElementById("stat-waits-val");
    if (waitsEl) {
      waitsEl.innerText = waitSessions;
    }

    const multEl = document.getElementById("zrr-multiplier-hits-val");
    if (multEl) {
      multEl.innerText = multiplierHitCount;
    }
  }

  function ensureMultiplierInfoRow() {
    const sessionCard = document.getElementById("zrr-dealer-container");
    if (!sessionCard) {
      return;
    }

    if (document.getElementById("zrr-multiplier-hits-row")) {
      return;
    }

    const row = document.createElement("div");
    row.id = "zrr-multiplier-hits-row";
    row.className = "info-row";
    row.innerHTML = '<span class="info-label">Multiplier Hits</span><span id="zrr-multiplier-hits-val" class="info-val">0</span>';
    if (sessionCard.parentNode) {
      sessionCard.parentNode.insertBefore(row, sessionCard.nextSibling);
    }
  }

  function startSession() {
    sessionActive = true;
    playData = [];
    allSessions = 0;
    winSessions = 0;
    jackpotSessions = 0;
    waitSessions = 0;
    clearPlayInformation();
    updateSessionStatsUi();
    updateSessionButtons();
    setHeaderState("live", {
      badge: "Live",
      helper: "live log",
      note: "logging"
    });
  }

  function endSession() {
    if (recordingActive) {
      stopSessionRecording();
    }
    sessionActive = false;
    updateSessionButtons();
    setHeaderState("idle", {
      badge: "Ended",
      helper: "saved state",
      note: "archived"
    });
  }

  // Tab switching
  function switchTab(tabId) {
    [dashboardTab, lightningTab, sessionTab, accountTab].forEach(btn => {
      if (btn) btn.classList.remove("active");
    });
    [dashboardContent, lightningContent, sessionContent, accountContent].forEach(sec => {
      if (sec) sec.classList.remove("active");
    });

    if (tabId === "dashboard") {
      dashboardTab.classList.add("active");
      dashboardContent.classList.add("active");
      activeCanvasId = "canvas";
      redrawActiveWheel();
      calculateStrategyMath();
    } else if (tabId === "lightning") {
      lightningTab.classList.add("active");
      lightningContent.classList.add("active");
      activeCanvasId = "canvas-lt";
      redrawActiveWheel();
      calculateStrategyMath();
    } else if (tabId === "session") {
      sessionTab.classList.add("active");
      sessionContent.classList.add("active");
    } else if (tabId === "account") {
      accountTab.classList.add("active");
      accountContent.classList.add("active");
    }
  }

  // Colors utility
  function getColorFromNumber(n) {
    const num = parseInt(n, 10);
    if (num === 0) return 'green';
    if (RED_NUMBERS.has(num)) return 'red';
    if (BLACK_NUMBERS.has(num)) return 'black';
    return 'green';
  }

  function sendManualBet(number, neighborhoodSize = 3) {
    if (!number) {
      return;
    }
 
    chrome.runtime.sendMessage({
      type: "manual-bet",
      number: String(number),
      neighborhoodSize: neighborhoodSize
    });
 
    document.querySelectorAll(".zrr-recommendation, .zrr-recommendation-lt").forEach(recAlert => {
      recAlert.innerText = `Manual strategy: ${number} + ${neighborhoodSize} neighborhood`;
      recAlert.classList.add("alert-highlight");
      recAlert.classList.remove("clickable");
      recAlert.style.display = "block";
    });
  }

  function renderInteractiveNumbers(container, numbers, limit, interactive) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    const canClick = interactive !== false;
    numbers.slice(0, limit).forEach((n) => {
      const color = getColorFromNumber(n);
      const badge = document.createElement("span");
      badge.className = `number-badge ${color}${canClick ? " clickable" : ""}`;
      badge.innerText = n;
      if (canClick) {
        badge.dataset.number = String(n);
        badge.title = "Click to apply this number on live board";
      }
      container.appendChild(badge);
    });
  }

  function renderWaitStack(container) {
    if (!container) {
      return;
    }

    container.innerHTML = "";
    ["W", "A", "I", "T"].forEach((letter) => {
      const chip = document.createElement("span");
      chip.className = "number-badge wait-badge";
      chip.innerText = letter;
      container.appendChild(chip);
    });
  }

  function calculateStrategyMath() {
    // 1. Calculate Standard Dashboard Math
    const budgetInput = document.querySelector(".zrr-math-budget");
    const profitInput = document.querySelector(".zrr-math-profit-percent");
    const unitSelect = document.querySelector(".zrr-math-unit");
    const spinsInput = document.querySelector(".zrr-math-min-spins");

    if (budgetInput && profitInput && unitSelect && spinsInput) {
      const budget = parseFloat(budgetInput.value) || 1000;
      const profitPercent = parseFloat(profitInput.value) || 30;
      const unitSize = parseFloat(unitSelect.value) || 1;
      const minSpins = parseFloat(spinsInput.value) || 20;

      const targetProfit = budget * (profitPercent / 100);
      const targetExit = budget + targetProfit;
      
      document.querySelectorAll(".zrr-math-exit-target").forEach(el => {
        el.innerText = targetExit.toFixed(2) + " RON";
      });

      const nStd = currentMathCounts.std;
      const nGold = currentMathCounts.gold;
      const nJp = currentMathCounts.jp;

      document.querySelectorAll(".zrr-math-std-count").forEach(el => el.innerText = nStd);
      document.querySelectorAll(".zrr-math-gold-count").forEach(el => el.innerText = nGold);
      document.querySelectorAll(".zrr-math-jp-count").forEach(el => el.innerText = nJp);

      const totalWeights = nStd + (2 * nGold) + (3 * nJp);
      let optStdBet = unitSize;
      if (totalWeights > 0) {
        const maxStdBetAllowed = budget / (minSpins * totalWeights);
        optStdBet = Math.max(unitSize, Math.floor(maxStdBetAllowed / unitSize) * unitSize);
      }

      const optGoldBet = optStdBet * 2;
      const optJpBet = optStdBet * 3;

      const totalBetPerRound = (nStd * optStdBet) + (nGold * optGoldBet) + (nJp * optJpBet);

      document.querySelectorAll(".zrr-math-std-bet").forEach(el => el.innerText = optStdBet.toFixed(2));
      document.querySelectorAll(".zrr-math-std-total").forEach(el => el.innerText = (nStd * optStdBet).toFixed(2));

      document.querySelectorAll(".zrr-math-gold-bet").forEach(el => el.innerText = optGoldBet.toFixed(2));
      document.querySelectorAll(".zrr-math-gold-total").forEach(el => el.innerText = (nGold * optGoldBet).toFixed(2));

      document.querySelectorAll(".zrr-math-jp-bet").forEach(el => el.innerText = optJpBet.toFixed(2));
      document.querySelectorAll(".zrr-math-jp-total").forEach(el => el.innerText = (nJp * optJpBet).toFixed(2));

      document.querySelectorAll(".zrr-math-total-bet").forEach(el => el.innerText = totalBetPerRound.toFixed(2));

      const survivalSpins = totalBetPerRound > 0 ? Math.floor(budget / totalBetPerRound) : 0;
      document.querySelectorAll(".zrr-math-survival-spins").forEach(el => el.innerText = survivalSpins);

      const stdNet = totalBetPerRound > 0 ? (optStdBet * 36) - totalBetPerRound : 0;
      const goldNet = totalBetPerRound > 0 ? (optGoldBet * 36) - totalBetPerRound : 0;
      const jpNet = totalBetPerRound > 0 ? (optJpBet * 36) - totalBetPerRound : 0;

      document.querySelectorAll(".zrr-math-std-profit-val").forEach(el => {
        el.innerText = (stdNet >= 0 ? "+" : "") + stdNet.toFixed(2) + " RON";
        el.style.color = stdNet >= 0 ? "var(--accent)" : "#ff5252";
      });
      document.querySelectorAll(".zrr-math-gold-profit-val").forEach(el => {
        el.innerText = (goldNet >= 0 ? "+" : "") + goldNet.toFixed(2) + " RON";
        el.style.color = goldNet >= 0 ? "#ffd84d" : "#ff5252";
      });
      document.querySelectorAll(".zrr-math-jp-profit-val").forEach(el => {
        el.innerText = (jpNet >= 0 ? "+" : "") + jpNet.toFixed(2) + " RON";
        el.style.color = jpNet >= 0 ? "#3399ff" : "#ff5252";
      });

      let hitsToExit = 0;
      if (jpNet > 0) {
        hitsToExit = Math.ceil(targetProfit / jpNet);
      }
      document.querySelectorAll(".zrr-math-hits-to-exit").forEach(el => {
        el.innerText = hitsToExit;
      });
    }

    // 2. Calculate Lightning Dashboard Math
    const budgetInputLt = document.querySelector("#zrr-math-budget-lt");
    const profitInputLt = document.querySelector("#zrr-math-profit-percent-lt");
    const unitSelectLt = document.querySelector("#zrr-math-unit-lt");
    const spinsInputLt = document.querySelector("#zrr-math-min-spins-lt");
    const multiplierSelectLt = document.querySelector("#zrr-math-multiplier-lt");

    if (budgetInputLt && profitInputLt && unitSelectLt && spinsInputLt && multiplierSelectLt) {
      const budget = parseFloat(budgetInputLt.value) || 1000;
      const profitPercent = parseFloat(profitInputLt.value) || 30;
      const unitSize = parseFloat(unitSelectLt.value) || 1;
      const minSpins = parseFloat(spinsInputLt.value) || 20;
      const multiplier = parseFloat(multiplierSelectLt.value) || 100;

      const targetProfit = budget * (profitPercent / 100);
      const targetExit = budget + targetProfit;

      document.querySelectorAll(".zrr-math-exit-target-lt").forEach(el => {
        el.innerText = targetExit.toFixed(2) + " RON";
      });

      const nStd = currentMathCountsLt.std;
      const nGold = currentMathCountsLt.gold;
      const nJp = currentMathCountsLt.jp;

      document.querySelectorAll(".zrr-math-std-count-lt").forEach(el => el.innerText = nStd);
      document.querySelectorAll(".zrr-math-gold-count-lt").forEach(el => el.innerText = nGold);
      document.querySelectorAll(".zrr-math-jp-count-lt").forEach(el => el.innerText = nJp);

      const totalWeights = nStd + (2 * nGold) + (3 * nJp);
      let optStdBet = unitSize;
      if (totalWeights > 0) {
        const maxStdBetAllowed = budget / (minSpins * totalWeights);
        optStdBet = Math.max(unitSize, Math.floor(maxStdBetAllowed / unitSize) * unitSize);
      }

      const optGoldBet = optStdBet * 2;
      const optJpBet = optStdBet * 3;

      const totalBetPerRound = (nStd * optStdBet) + (nGold * optGoldBet) + (nJp * optJpBet);

      document.querySelectorAll(".zrr-math-std-bet-lt").forEach(el => el.innerText = optStdBet.toFixed(2));
      document.querySelectorAll(".zrr-math-std-total-lt").forEach(el => el.innerText = (nStd * optStdBet).toFixed(2));

      document.querySelectorAll(".zrr-math-gold-bet-lt").forEach(el => el.innerText = optGoldBet.toFixed(2));
      document.querySelectorAll(".zrr-math-gold-total-lt").forEach(el => el.innerText = (nGold * optGoldBet).toFixed(2));

      document.querySelectorAll(".zrr-math-jp-bet-lt").forEach(el => el.innerText = optJpBet.toFixed(2));
      document.querySelectorAll(".zrr-math-jp-total-lt").forEach(el => el.innerText = (nJp * optJpBet).toFixed(2));

      document.querySelectorAll(".zrr-math-total-bet-lt").forEach(el => el.innerText = totalBetPerRound.toFixed(2));

      const survivalSpins = totalBetPerRound > 0 ? Math.floor(budget / totalBetPerRound) : 0;
      document.querySelectorAll(".zrr-math-survival-spins-lt").forEach(el => el.innerText = survivalSpins);

      // In Lightning roulette, standard pays 30x.
      // Golden Overlaps and Jackpot targets can get the simulated multiplier.
      const stdNet = totalBetPerRound > 0 ? (optStdBet * 30) - totalBetPerRound : 0;
      const goldNet = totalBetPerRound > 0 ? (optGoldBet * multiplier) - totalBetPerRound : 0;
      const jpNet = totalBetPerRound > 0 ? (optJpBet * multiplier) - totalBetPerRound : 0;

      document.querySelectorAll(".zrr-math-std-profit-val-lt").forEach(el => {
        el.innerText = (stdNet >= 0 ? "+" : "") + stdNet.toFixed(2) + " RON";
        el.style.color = stdNet >= 0 ? "var(--accent)" : "#ff5252";
      });
      document.querySelectorAll(".zrr-math-gold-profit-val-lt").forEach(el => {
        el.innerText = (goldNet >= 0 ? "+" : "") + goldNet.toFixed(2) + " RON";
        el.style.color = goldNet >= 0 ? "#ffd84d" : "#ff5252";
      });
      document.querySelectorAll(".zrr-math-jp-profit-val-lt").forEach(el => {
        el.innerText = (jpNet >= 0 ? "+" : "") + jpNet.toFixed(2) + " RON";
        el.style.color = jpNet >= 0 ? "#3399ff" : "#ff5252";
      });

      let hitsToExit = 0;
      if (jpNet > 0) {
        hitsToExit = Math.ceil(targetProfit / jpNet);
      }
      document.querySelectorAll(".zrr-math-hits-to-exit-lt").forEach(el => {
        el.innerText = hitsToExit;
      });
    }
  }

  function renderRecommendationCard(recAlert, betDiv, highStakeDiv, recentNumbers, effectiveBetFavorites, zoneStrategy, jackpotNumbers, effectiveBetNumbers, highStakeNumbers, isWaitRound) {
    if (!recAlert || !betDiv || !highStakeDiv) return;

    if (!recentNumbers || recentNumbers.length === 0) {
      recAlert.style.display = "block";
      recAlert.innerText = "Waiting for live game roulette data... (Click to Reconnect)";
      recAlert.classList.add("clickable");
      recAlert.classList.remove("alert-highlight");
      betDiv.style.display = "none";
      highStakeDiv.innerHTML = "";
    } else if (isWaitRound) {
      recAlert.style.display = "block";
      recAlert.innerText = "We recommend to wait this round!";
      recAlert.classList.remove("clickable");
      recAlert.classList.remove("alert-highlight");
      betDiv.style.display = "none";
      highStakeDiv.innerHTML = "";
    } else {
      recAlert.style.display = "none";
      recAlert.innerText = "";
      recAlert.classList.remove("clickable");
      recAlert.classList.add("alert-highlight");
      betDiv.style.display = "flex";
      
      const isLt = (recAlert.id === "zrr-recommendation-lt");
      const subtitleText = isLt 
        ? "Cover focus 4 jackpot numbers with +3 neighbors." 
        : "Cover focus last 4 numbers with +3 neighbors. Play highlighted numbers first.";
      const overlapCount = zoneStrategy && zoneStrategy.overlapSet ? zoneStrategy.overlapSet.size : 0;
      const jackpotCount = Array.isArray(jackpotNumbers) ? new Set(jackpotNumbers.map((n) => String(n))).size : 0;
      const jackpotSet = new Set((jackpotNumbers || []).map((n) => String(n)));

      let badgesHtml = "";

      if ((jackpotNumbers || []).length > 0) {
        // Group by jackpot target: render centered rows with the jackpot in the middle and 3 left / 3 right neighbors
        const jpRows = [];
        (jackpotNumbers || []).forEach(jp => {
          const jpStr = String(jp);
          const idx = numbers.indexOf(jpStr);
          if (idx === -1) return;

          const rowNumbers = [];
          for (let offset = -3; offset <= 3; offset++) {
            const wrappedIdx = (idx + offset + numbers.length) % numbers.length;
            rowNumbers.push(numbers[wrappedIdx]);
          }

          const rowHtml = rowNumbers.map((n, rIdx) => {
            const color = getColorFromNumber(n);
            const isCenterJp = (rIdx === 3);
            const isOverlap = zoneStrategy.overlapSet && zoneStrategy.overlapSet.has(String(n));
            const isOtherJp = !isCenterJp && jackpotNumbers && jackpotNumbers.includes(String(n));
            const isClickableJp = jackpotSet.has(String(n));

            let extraClass = "";
            let extraStyle = "";

            if (isCenterJp) {
              extraClass = " strategy-badge-jackpot strategy-badge-jp-center";
              extraStyle = "transform: scale(1.25) translateY(-2px); z-index: 5; margin: 0 6px; box-shadow: 0 4px 15px rgba(51, 153, 255, 0.6); border-width: 2px;";
            } else {
              if (isOtherJp) {
                extraClass = " strategy-badge-jackpot";
              } else if (isOverlap) {
                extraClass = " strategy-badge-overlap";
              }

              let scale = 1.0;
              let translateY = 0;
              let rotate = 0;
              let zIndex = 2;

              if (rIdx === 0) { scale = 0.72; translateY = 12; rotate = -20; zIndex = 2; }
              else if (rIdx === 1) { scale = 0.85; translateY = 6; rotate = -12; zIndex = 3; }
              else if (rIdx === 2) { scale = 0.95; translateY = 2; rotate = -5; zIndex = 4; }
              else if (rIdx === 4) { scale = 0.95; translateY = 2; rotate = 5; zIndex = 4; }
              else if (rIdx === 5) { scale = 0.85; translateY = 6; rotate = 12; zIndex = 3; }
              else if (rIdx === 6) { scale = 0.72; translateY = 12; rotate = 20; zIndex = 2; }

              extraStyle = `transform: scale(${scale}) translateY(${translateY}px) rotate(${rotate}deg); z-index: ${zIndex}; opacity: 0.88; transition: all 0.25s ease;`;
            }

            const clickableClass = isClickableJp ? " clickable" : "";
            const numberAttr = isClickableJp ? ` data-number="${n}"` : "";
            const titleAttr = isClickableJp ? ` title="Click to apply jackpot ${n} + 3 neighbors on live board"` : "";

            return `<span class="number-badge strategy-badge ${color}${extraClass}${clickableClass}"${numberAttr}${titleAttr} style="${extraStyle}">${n}</span>`;
          }).join("");

          jpRows.push(`
            <div class="strategy-row-lt" style="display: flex; gap: 3px; justify-content: center; align-items: center; width: 100%; margin: 5px 0; padding-bottom: 2px;">
              ${rowHtml}
            </div>
          `);
        });

        // Add custom row for other recommended plays (e.g. preference mapping targets) that are not covered by any jackpot target's 3-neighbor range
        const coveredSet = new Set();
        (jackpotNumbers || []).forEach(jp => {
          const jpStr = String(jp);
          const idx = numbers.indexOf(jpStr);
          if (idx !== -1) {
            for (let offset = -3; offset <= 3; offset++) {
              const wrappedIdx = (idx + offset + numbers.length) % numbers.length;
              coveredSet.add(numbers[wrappedIdx]);
            }
          }
        });

        const extraPlays = (effectiveBetNumbers || []).filter(n => !coveredSet.has(String(n)));
        if (extraPlays.length > 0) {
          const extraBadgesHtml = extraPlays.map(n => {
            const color = getColorFromNumber(n);
            const isOverlap = zoneStrategy.overlapSet && zoneStrategy.overlapSet.has(String(n));
            let extraClass = isOverlap ? " strategy-badge-overlap" : "";
            return `<span class="number-badge strategy-badge ${color}${extraClass}">${n}</span>`;
          }).join("");

          const dividerColor = isLt ? "rgba(255, 204, 0, 0.15)" : "rgba(84, 180, 53, 0.2)";
          const extraLabel = isLt ? "Pref" : "Extra";

          jpRows.push(`
            <div class="strategy-row-lt" style="display: flex; gap: 8px; justify-content: center; align-items: center; width: 100%; margin: 6px 0; border-top: 1px dashed ${dividerColor}; padding-top: 6px;">
              <span style="font-size: 9px; color: var(--muted); margin-right: 4px; text-transform: uppercase;">${extraLabel}:</span>
              ${extraBadgesHtml}
            </div>
          `);
        }

        badgesHtml = `
          <div style="display: flex; flex-direction: column; gap: 1px; width: 100%; align-items: center; padding: 2px 0;">
            ${jpRows.join("")}
          </div>
        `;
      }

      let subtitleHtml = "";
      if (!isLt) {
        subtitleHtml = `
          <div style="display: flex; flex-direction: column; gap: 4px; text-align: center;">
            <div class="strategy-subtitle" style="font-size: 12px; color: var(--text-secondary); margin: 0 auto;">
              ${subtitleText}
            </div>
          </div>
        `;
      }

      let html = `
        <div class="strategy-shell" style="gap: 8px; width: 100%;">
          ${badgesHtml}
          ${subtitleHtml}
          <div style="display: flex; justify-content: center; gap: 18px; font-size: 10px; color: var(--muted); border-top: 1px solid rgba(84, 180, 53, 0.12); padding-top: 8px; margin-top: 4px; width: 100%;">
            <span style="display: inline-flex; flex-direction: column; align-items: center; gap: 3px; min-width: 120px;">
              <span style="display: inline-flex; align-items: center; gap: 4px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #ffd84d; background: transparent;"></span>
                Overlap Stack
              </span>
              <span style="font-size: 11px; font-weight: 800; color: #ffd84d; line-height: 1;">${overlapCount}x</span>
            </span>
            <span style="display: inline-flex; flex-direction: column; align-items: center; gap: 3px; min-width: 120px;">
              <span style="display: inline-flex; align-items: center; gap: 4px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #3399ff; background: transparent;"></span>
                Jackpot Target
              </span>
              <span style="font-size: 11px; font-weight: 800; color: #66b8ff; line-height: 1;">${jackpotCount}x</span>
            </span>
          </div>
        </div>
      `;

      betDiv.innerHTML = html;
      highStakeDiv.innerHTML = "";
    }
  }

  function getWheelGeometry() {
    const canvas = document.getElementById(activeCanvasId);
    if (!canvas) {
      return { canvas: null, centerX: 110, centerY: 110, outsideRadius: 108, textRadius: 92, insideRadius: 80 };
    }
    const outsideRadius = canvas.width / 2 - 2;
    const textRadius = outsideRadius - 16;
    const insideRadius = outsideRadius - 28;
    return {
      canvas,
      centerX: canvas.width / 2,
      centerY: canvas.height / 2,
      outsideRadius,
      textRadius,
      insideRadius
    };
  }

  function getJackpotNumbers(highStakeNumbers) {
    return (highStakeNumbers || []).map((n) => {
      if (n && typeof n === "object" && n.number !== undefined) {
        return String(n.number);
      }
      return String(n);
    }).slice(0, 4);
  }

  function renderJackpotNumbersWithScores(container, highStakeNumbers, limit) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    (highStakeNumbers || []).slice(0, limit).forEach((item) => {
      let num = "";
      let score = 0;
      if (item && typeof item === "object" && item.number !== undefined) {
        num = String(item.number);
        score = item.score !== undefined ? item.score : 0;
      } else {
        num = String(item);
        score = 0;
      }

      const color = getColorFromNumber(num);
      
      const wrapper = document.createElement("div");
      wrapper.className = "jackpot-badge-wrapper";
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "2px";
      wrapper.style.width = "28px";

      const badge = document.createElement("span");
      badge.className = `number-badge ${color} clickable`;
      badge.innerText = num;
      badge.dataset.number = num;
      badge.title = `Click to apply jackpot number ${num} on board (Score: ${score}%)`;

      const scoreEl = document.createElement("span");
      scoreEl.className = "jackpot-score-percentage";
      scoreEl.style.fontSize = "9px";
      scoreEl.style.fontWeight = "700";
      scoreEl.style.color = "#3399ff";
      scoreEl.innerText = `${score}%`;

      wrapper.appendChild(badge);
      wrapper.appendChild(scoreEl);
      container.appendChild(wrapper);
    });
  }

  function renderGoldenRingRail(container, overlapSet) {
    if (!container) return;
    container.innerHTML = "";
    
    if (!overlapSet || overlapSet.size === 0) {
      const emptySpan = document.createElement("span");
      emptySpan.style.fontSize = "9px";
      emptySpan.style.color = "var(--muted)";
      emptySpan.innerText = "WAIT";
      container.appendChild(emptySpan);
      return;
    }
    
    uniquePreserveOrder(Array.from(overlapSet).map((num) => String(num))).forEach(numStr => {
      if (!numbers.includes(numStr)) return;

      const badge = document.createElement("span");
      badge.className = `number-badge ${getColorFromNumber(numStr)} clickable`;
      badge.innerText = numStr;
      badge.dataset.number = numStr;
      badge.title = `Click to apply golden ring number ${numStr}`;
      container.appendChild(badge);
    });
  }

  function get3NeighborhoodFromWheel(number) {
    const idx = numbers.indexOf(String(number));
    if (idx === -1) {
      return [];
    }

    const out = [];
    for (let i = 1; i <= 3; i++) {
      out.push(numbers[(idx + i) % numbers.length]);
      out.push(numbers[(idx - i + numbers.length) % numbers.length]);
    }

    // Keep unique while preserving wheel-derived order.
    return out.filter((value, index, arr) => arr.indexOf(value) === index);
  }

  function uniquePreserveOrder(values, limit) {
    const seen = new Set();
    const out = [];
    const list = Array.isArray(values) ? values : [];

    for (let i = 0; i < list.length; i++) {
      const value = String(list[i]);
      if (seen.has(value)) {
        continue;
      }

      seen.add(value);
      out.push(value);

      if (limit && out.length >= limit) {
        break;
      }
    }

    return out;
  }

  function listToStrings(values) {
    return Array.isArray(values) ? values.map((value) => String(value)) : [];
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getPreferenceTargetsForHistory(recentNumbers) {
    if (!recentNumbers || recentNumbers.length === 0) {
      return [];
    }
    const lastNum = String(recentNumbers[0]);
    if (customPrefMappingLt[lastNum] !== undefined) {
      return listToStrings(customPrefMappingLt[lastNum]);
    }
    return listToStrings(defaultPrefMappingLt[lastNum] || []);
  }

  function getLightningPatternSnapshot(recentNumbers, currentWinner) {
    const context = listToStrings(recentNumbers);
    const current = currentWinner ? String(currentWinner) : (context[0] || "");
    const zeroTargets = enabledPatternsLt.zero ? listToStrings(getZeroRuleJackpotNumbers(context)) : [];
    const repeatTargets = enabledPatternsLt.rep ? listToStrings(getLightningPatternNumbers(context)) : [];
    const consecutive = enabledPatternsLt.cns ? getLightningConsecutiveNumbers(context) : { triggerSet: new Set(), neighborSet: new Set() };
    const consecutiveTargets = consecutive && consecutive.triggerSet && consecutive.triggerSet.size > 0
      ? getConsecutiveNeighbors(current)
      : [];
    const preferenceTargets = enabledPatternsLt.pref ? getPreferenceTargetsForHistory(context) : [];
    const activePatterns = [];

    if (zeroTargets.length > 0) activePatterns.push("ZERO");
    if (repeatTargets.length > 0) activePatterns.push("REP");
    if (consecutiveTargets.length > 0) activePatterns.push("CNS");
    if (preferenceTargets.length > 0) activePatterns.push("PREF");

    return {
      activePatterns,
      patternTargets: {
        ZERO: zeroTargets,
        REP: repeatTargets,
        CNS: consecutiveTargets,
        PREF: preferenceTargets
      },
      cnsTriggers: consecutive && consecutive.triggerSet ? Array.from(consecutive.triggerSet).map(String) : []
    };
  }

  function makeSessionLogEntry(previousState, currentWinner, dealer) {
    const prev = previousState || {};
    const winner = currentWinner ? String(currentWinner) : "";
    const isWait = !!prev.isWaitRound || prev.decision === "WAIT";
    const betOn = isWait ? [] : listToStrings(prev.betNumbers || prev.zoneNumbers);
    const jackpotNumbers = listToStrings(prev.jackpotNumbers);
    const goldenNumbers = listToStrings(prev.goldenNumbers);
    const win = !isWait && betOn.includes(winner);
    const favorite = !isWait && jackpotNumbers.includes(winner);
    const golden = !isWait && goldenNumbers.includes(winner);

    return {
      playTime: new Date().toLocaleTimeString(),
      loggedAt: new Date().toISOString(),
      dealer: dealer || prev.dealer || "zra",
      playRound: playData.length + 1,
      strategyMode: prev.strategyMode || "STANDARD",
      decision: isWait ? "WAIT" : "PLAY",
      previousWinner: prev.winner || "",
      winner,
      win,
      favorite,
      golden,
      betOn,
      candidateNumbers: listToStrings(prev.candidateNumbers || prev.zoneNumbers),
      standardNumbers: listToStrings(prev.standardNumbers),
      goldenNumbers,
      jackpotNumbers,
      patternNumbers: listToStrings(prev.patternNumbers),
      activePatterns: listToStrings(prev.activePatterns),
      patternTargets: prev.patternTargets || {},
      recentNumbersBefore: listToStrings(prev.recentNumbers).slice(0, 24),
      mathCounts: prev.mathCounts || { std: 0, gold: 0, jp: 0 },
      recommendationAt: prev.updatedAt || "",
      isWaitRound: isWait
    };
  }

  function getOutcomeFromLog(entry) {
    if (entry.isWaitRound || entry.decision === "WAIT") {
      return "wait";
    }
    if (entry.favorite) {
      return "victory";
    }
    if (entry.golden) {
      return "gold";
    }
    return entry.win ? "win" : "loss";
  }

  function buildZoneFromAnchors(anchors) {
    const counts = {};
    const ordered = [];

    (anchors || []).forEach((anchor) => {
      const zone = [String(anchor)].concat(get3NeighborhoodFromWheel(anchor));
      zone.forEach((n) => {
        const key = String(n);
        counts[key] = (counts[key] || 0) + 1;
        if (!ordered.includes(key)) {
          ordered.push(key);
        }
      });
    });

    const overlapOrdered = ordered.filter((n) => counts[String(n)] > 1);
    const overlapSet = new Set(overlapOrdered);
    return {
      zoneNumbers: ordered,
      overlapSet,
      overlapOrdered
    };
  }

  const FRENCH_BOARD_LAYOUT = {
    left: [5, 10, 23, 8],
    top: [24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35],
    bottom: [30, 11, 36, 13, 27, 6, 34, 17, 25, 2, 21, 4, 19, 15, 32],
    right: [3, 26, 0]
  };

  function buildFrenchTile(number, options) {
    const color = getColorFromNumber(number);
    const isCovered = options.coveredNumbers.includes(String(number));
    const isOverlap = options.overlapSet.has(String(number));
    const isCurrentWinner = String(number) === options.currentWinner;
    const classes = ["french-number-chip", color];
    if (isCovered) classes.push("covered");
    if (isOverlap) classes.push("overlap");
    if (isCurrentWinner) classes.push("jp-hit");
    return `<div class="${classes.join(" ")}">${number}</div>`;
  }

  function buildFrenchBoardHtml(zoneStrategy, highStakeNumbers, currentWinner) {
    const coveredNumbers = uniquePreserveOrder((zoneStrategy.zoneNumbers || []).map((n) => String(n)));
    const overlapSet = zoneStrategy.overlapSet || new Set();
    const options = {
      coveredNumbers,
      overlapSet,
      currentWinner: currentWinner ? String(currentWinner) : ""
    };

    const leftRail = FRENCH_BOARD_LAYOUT.left.map((n) => buildFrenchTile(n, options)).join("");
    const rightRail = FRENCH_BOARD_LAYOUT.right.map((n) => buildFrenchTile(n, options)).join("");
    const topRow = FRENCH_BOARD_LAYOUT.top.map((n) => buildFrenchTile(n, options)).join("");
    const bottomRow = FRENCH_BOARD_LAYOUT.bottom.map((n) => buildFrenchTile(n, options)).join("");

    const boardLabels = `
      <div class="french-zone-pill">TIER</div>
      <div class="french-zone-pill">ORPHELINS</div>
      <div class="french-zone-pill">VOISINS</div>
      <div class="french-zone-pill zero">ZERO</div>
    `;

    return `
      <div class="french-layout-board">
        <div class="french-board">
          <div class="french-rail">${leftRail}</div>
          <div class="french-core">
            <div class="french-number-row">${topRow}</div>
            <div class="french-zone-band">${boardLabels}</div>
            <div class="french-number-row">${bottomRow}</div>
          </div>
          <div class="french-rail">${rightRail}</div>
        </div>
      </div>
    `;
  }

  function isJackpotActiveInGolden(jpNumber, goldenRings, wheelOrder) {
    if (goldenRings.includes(String(jpNumber))) {
      return true;
    }
    const idx = wheelOrder.indexOf(String(jpNumber));
    if (idx === -1) {
      return false;
    }
    const leftNeighbor = wheelOrder[(idx - 1 + wheelOrder.length) % wheelOrder.length];
    const rightNeighbor = wheelOrder[(idx + 1) % wheelOrder.length];
    return goldenRings.includes(String(leftNeighbor)) || goldenRings.includes(String(rightNeighbor));
  }

  function calculateJackpotScore(numStr, recentNumbers, favoriteNumbers, wheelOrder, get3NeighborhoodFn) {
    const last4 = (recentNumbers || []).slice(0, 4).map((n) => String(n));
    const currentWinner = last4[0];

    if (numStr === currentWinner) {
      return 0;
    }

    let score = 0;

    // 1. Overlap Score (Max 35)
    let overlapCount = 0;
    const neighborhoodWeight = [12, 10, 8, 6];
    last4.forEach((anchor, index) => {
      const neighborhood = get3NeighborhoodFn(anchor);
      if (neighborhood.includes(numStr) || anchor === numStr) {
        overlapCount += neighborhoodWeight[index] || 6;
      }
    });
    score += Math.min(35, overlapCount);

    // 2. Direct Wheel Neighbor of Last 4 Winners (Max 25)
    let neighborScore = 0;
    const neighborWeights = [25, 15, 10, 5];
    last4.forEach((anchor, index) => {
      const idx = wheelOrder.indexOf(anchor);
      if (idx !== -1) {
        const leftNeighbor = wheelOrder[(idx - 1 + wheelOrder.length) % wheelOrder.length];
        const rightNeighbor = wheelOrder[(idx + 1) % wheelOrder.length];
        if (numStr === leftNeighbor || numStr === rightNeighbor) {
          neighborScore = Math.max(neighborScore, neighborWeights[index]);
        }
      }
    });
    score += neighborScore;

    // 3. Hot/Favorite Numbers (Max 20)
    const favs = (favoriteNumbers || []).map((n) => String(n));
    const favIndex = favs.indexOf(numStr);
    if (favIndex !== -1) {
      if (favIndex === 0) score += 20;
      else if (favIndex === 1) score += 18;
      else if (favIndex === 2) score += 16;
      else if (favIndex <= 4) score += 14;
      else score += 10;
    }

    // 4. Recent Frequency / Hits (Max 20)
    const last12 = (recentNumbers || []).slice(0, 12).map((n) => String(n));
    let hitScore = 0;
    for (let i = 1; i < last12.length; i++) {
      if (last12[i] === numStr) {
        if (i === 1) hitScore = Math.max(hitScore, 20); // 2 rounds ago
        else if (i === 2) hitScore = Math.max(hitScore, 15); // 3 rounds ago
        else if (i === 3) hitScore = Math.max(hitScore, 10); // 4 rounds ago
        else hitScore = Math.max(hitScore, 5); // 5-12 rounds ago
      }
    }
    score += hitScore;

    return Math.min(100, score);
  }

  function buildRouletteTableRows(values) {
    const list = uniquePreserveOrder((values || []).map((n) => String(n)));
    const buckets = {
      top: [],
      middle: [],
      bottom: [],
      zero: []
    };

    list.forEach((value) => {
      const number = parseInt(value, 10);
      if (Number.isNaN(number)) {
        return;
      }

      if (number === 0) {
        buckets.zero.push(String(number));
        return;
      }

      if (number % 3 === 0) {
        buckets.top.push(String(number));
      } else if (number % 3 === 2) {
        buckets.middle.push(String(number));
      } else {
        buckets.bottom.push(String(number));
      }
    });

    const numericSort = (a, b) => parseInt(a, 10) - parseInt(b, 10);
    buckets.top.sort(numericSort);
    buckets.middle.sort(numericSort);
    buckets.bottom.sort(numericSort);

    return {
      rows: [buckets.top, buckets.middle, buckets.bottom],
      zero: buckets.zero.filter(Boolean)[0] || null
    };
  }

  function buildStrategyBadgeHtml(number, overlapSet, isEmpty) {
    const classes = ["number-badge", "strategy-badge"];

    if (isEmpty) {
      classes.push("strategy-badge-empty");
      return `<span class="${classes.join(" ")}"></span>`;
    }

    const color = getColorFromNumber(number);
    const isOverlap = overlapSet.has(String(number));
    classes.push(color);

    if (isOverlap) {
      classes.push("strategy-badge-overlap");
    }

    return `<span class="${classes.join(" ")}">${number}</span>`;
  }

  // Draw roulette outer rim wheel
  function drawRouletteWheel() {
    var canvas = document.getElementById(activeCanvasId);
    if (canvas && canvas.getContext) {
      const geometry = getWheelGeometry();
      var outsideRadius = geometry.outsideRadius;
      var textRadius = geometry.textRadius;
      var insideRadius = geometry.insideRadius;

      ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = (activeCanvasId === "canvas-lt") ? "#0d0a1a" : "#071505";
      ctx.lineWidth = 1;
      ctx.font = '700 9px Montserrat, sans-serif';

      for (var i = 0; i < numbers.length; i++) {
        var angle = startAngle + i * arc;
        const numberColor = getColorFromNumber(numbers[i]);
        ctx.fillStyle = numberColor === "red"
          ? "#e0232a"
          : (numberColor === "black" ? "#222222" : "#2b741b");

        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, outsideRadius, angle, angle + arc, false);
        ctx.arc(canvas.width / 2, canvas.height / 2, insideRadius, angle + arc, angle, true);
        ctx.stroke();
        ctx.fill();

        ctx.save();
        ctx.fillStyle = "white";
        ctx.translate(canvas.width / 2 + Math.cos(angle + arc / 2) * textRadius,
                      canvas.height / 2 + Math.sin(angle + arc / 2) * textRadius);
        ctx.rotate(angle + arc / 2 + Math.PI / 2);
        var text = numbers[i];
        ctx.fillText(text, -ctx.measureText(text).width / 2, 3);
        ctx.restore();
      }
      clearAll();
    }
  }

  function drawWheelNumberLabels() {
    var canvas = document.getElementById(activeCanvasId);
    if (!canvas || !canvas.getContext) {
      return;
    }

    const geometry = getWheelGeometry();
    var textRadius = geometry.textRadius;
    ctx.save();
    ctx.font = '700 9px Montserrat, sans-serif';
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 2;

    for (var i = 0; i < numbers.length; i++) {
      var angle = startAngle + i * arc;
      ctx.save();
      ctx.translate(canvas.width / 2 + Math.cos(angle + arc / 2) * textRadius,
                    canvas.height / 2 + Math.sin(angle + arc / 2) * textRadius);
      ctx.rotate(angle + arc / 2 + Math.PI / 2);
      var text = numbers[i];
      ctx.fillText(text, -ctx.measureText(text).width / 2, 3);
      ctx.restore();
    }

    ctx.restore();
  }

  // Draw purple 3-neighborhood highlight slice
  function draw3Neighborhood(n) {
    var canvas = document.getElementById(activeCanvasId);
    if (canvas && canvas.getContext) {
      const geometry = getWheelGeometry();
      var outsideRadius = geometry.outsideRadius;
      let insideRadius = geometry.insideRadius;
      let idx = numbers.indexOf(String(n));
      if (idx !== -1) {
        let start_angle = startAngle + idx * arc;
        ctx.fillStyle = "rgba(168, 98, 187, 0.45)";
        ctx.strokeStyle = "#a862bb";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, outsideRadius, start_angle - 3 * arc, start_angle + 4 * arc, false);
        ctx.arc(canvas.width / 2, canvas.height / 2, insideRadius, start_angle + 4 * arc, start_angle - 3 * arc, true);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
    }
  }

  // Draw light blue single high stake slice
  function drawHighStakeNumber(n) {
    var canvas = document.getElementById(activeCanvasId);
    if (canvas && canvas.getContext) {
      const geometry = getWheelGeometry();
      var outsideRadius = geometry.outsideRadius;
      let insideRadius = geometry.insideRadius;
      const lightningRingInnerRadius = outsideRadius - 8;
      let idx = numbers.indexOf(String(n));
      if (idx !== -1) {
        let start_angle = startAngle + idx * arc;
        if (activeCanvasId === "canvas-lt") {
          // LT: draw a slim blue outer ring marker, matching Dealer ring thickness.
          ctx.fillStyle = "rgba(115, 196, 255, 0.62)";
          ctx.strokeStyle = "rgba(178, 226, 255, 0.98)";
          ctx.lineWidth = 0.9;
          insideRadius = lightningRingInnerRadius;
        } else {
          ctx.fillStyle = "rgba(51, 153, 255, 0.55)";
          ctx.strokeStyle = "#3399FF";
          ctx.lineWidth = 1;
        }
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, outsideRadius, start_angle, start_angle + arc, false);
        ctx.arc(canvas.width / 2, canvas.height / 2, insideRadius, start_angle + arc, start_angle, true);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();

      }
    }
  }

  function drawLightningJackpotZoneBoundaries(jackpotNums) {
    var canvas = document.getElementById(activeCanvasId);
    if (!canvas || !canvas.getContext || activeCanvasId !== "canvas-lt") {
      return;
    }

    const geometry = getWheelGeometry();
    const cx = geometry.centerX;
    const cy = geometry.centerY;
    const outerRadius = geometry.outsideRadius;
    const innerRadius = geometry.insideRadius;
    const bounds = new Set();

    // Fill the wheel middle with visible JP section color so covered zones are
    // easy to read against the dark background.
    ctx.save();
    ctx.fillStyle = "rgba(102, 184, 255, 0.2)";
    (jackpotNums || []).forEach((jp) => {
      const idx = numbers.indexOf(String(jp));
      if (idx === -1) {
        return;
      }

      const sectionStart = startAngle + (idx - 3) * arc;
      const sectionEnd = startAngle + (idx + 4) * arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, innerRadius, sectionStart, sectionEnd, false);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // Transparent zone tint for each recommended JP section (JP +/- 3 neighbors).
    ctx.save();
    ctx.fillStyle = "rgba(102, 184, 255, 0.11)";
    (jackpotNums || []).forEach((jp) => {
      const idx = numbers.indexOf(String(jp));
      if (idx === -1) {
        return;
      }

      const sectionStart = startAngle + (idx - 3) * arc;
      const sectionEnd = startAngle + (idx + 4) * arc;
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, sectionStart, sectionEnd, false);
      ctx.arc(cx, cy, innerRadius, sectionEnd, sectionStart, true);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    (jackpotNums || []).forEach((jp) => {
      const idx = numbers.indexOf(String(jp));
      if (idx === -1) {
        return;
      }

      const startBound = startAngle + (idx - 3) * arc;
      const endBound = startAngle + (idx + 4) * arc;
      bounds.add(startBound.toFixed(6));
      bounds.add(endBound.toFixed(6));
    });

    ctx.save();
    ctx.strokeStyle = "rgba(102, 184, 255, 0.82)";
    ctx.lineWidth = 1.15;
    ctx.globalAlpha = 0.95;

    Array.from(bounds).forEach((angleText) => {
      const angle = parseFloat(angleText);
      const x = cx + Math.cos(angle) * outerRadius;
      const y = cy + Math.sin(angle) * outerRadius;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    ctx.restore();
  }

  // Draw gold overlap marker ring for numbers shared by multiple strategy zones.
  function drawOverlapNumber(n) {
    var canvas = document.getElementById(activeCanvasId);
    if (canvas && canvas.getContext) {
      const geometry = getWheelGeometry();
      var outsideRadius = geometry.outsideRadius;
      var overlapInnerRadius = outsideRadius - 8;
      let idx = numbers.indexOf(String(n));
      if (idx !== -1) {
        let start_angle = startAngle + idx * arc;

        if (activeCanvasId === "canvas-lt") {
          // LT: use the same slim ring thickness so yellow overlap is clearly visible.
          ctx.fillStyle = "rgba(255, 220, 92, 0.6)";
          ctx.strokeStyle = "rgba(255, 238, 170, 0.98)";
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, outsideRadius, start_angle, start_angle + arc, false);
          ctx.arc(canvas.width / 2, canvas.height / 2, overlapInnerRadius, start_angle + arc, start_angle, true);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        } else {
          ctx.save();
          ctx.shadowColor = "rgba(255, 216, 77, 0.75)";
          ctx.shadowBlur = 8;
          ctx.fillStyle = "rgba(255, 216, 77, 0.65)";
          ctx.strokeStyle = "#ffd84d";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, outsideRadius, start_angle, start_angle + arc, false);
          ctx.arc(canvas.width / 2, canvas.height / 2, overlapInnerRadius, start_angle + arc, start_angle, true);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  // Draw central green/purple base circle
  function clearAll() {
    var canvas = document.getElementById(activeCanvasId);
    if (canvas && canvas.getContext) {
      const geometry = getWheelGeometry();
      let insideRadius = geometry.insideRadius;
      ctx.fillStyle = (activeCanvasId === "canvas-lt") ? "#140d2a" : "#0c1f0b";
      ctx.beginPath();
      ctx.arc(geometry.centerX, geometry.centerY, insideRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function updateCenterChip(number, jackpotNumbers) {
    ["wheel-center-chip", "wheel-center-chip-lt"].forEach(chipId => {
      const selector = chipId === "wheel-center-chip-lt" ? "#wheel-center-chip-lt" : "#wheel-center-chip";
      const chips = document.querySelectorAll(selector);
      chips.forEach(chip => {
        const isAgentActiveTab1 = geminiEnabled && (chipId === "wheel-center-chip" || chip.id === "wheel-center-chip");

        if (!number) {
          chip.className = isAgentActiveTab1 ? "wheel-center-chip agent-active" : "wheel-center-chip";
          chip.style.background = "";
          chip.innerText = "";
          return;
        }

        const color = getColorFromNumber(number);
        let bg = "#2b741b";
        if (color === "red")   bg = "#c81a22";
        if (color === "black") bg = "#1a1a1a";

        const isJackpot = Array.isArray(jackpotNumbers) && jackpotNumbers.includes(String(number));

        chip.style.background = isAgentActiveTab1
          ? ""
          : (isJackpot ? "linear-gradient(135deg, #1a3a6e 0%, #0d2252 100%)" : bg);
        chip.innerText = String(number);

        // Force animation restart
        chip.className = "wheel-center-chip";
        void chip.offsetWidth;

        const classList = ["wheel-center-chip"];
        if (isJackpot) classList.push("jackpot");
        else classList.push("visible");

        if (isAgentActiveTab1) {
          classList.push("agent-active");
        }
        chip.className = classList.join(" ");
      });
    });
  }

  function redrawActiveWheel() {
    const recentNumbers = cachedRecentNumbers || [];
    const highStakeNumbers = cachedHighStakeNumbers || [];
    const zoneStrategy = cachedZoneStrategy || {};

    drawRouletteWheel();

    if (activeCanvasId === "canvas-lt") {
      if (!cachedIsWaitRoundLt && cachedPatternNumbersLt.length > 0) {
        const activeJpSet = new Set(cachedJackpotNumbersLt || []);
        const activeGoldSet = cachedDuplicatesLt || new Set();

        cachedPatternNumbersLt.forEach((num) => {
          const val = String(num);
          if (activeJpSet.has(val)) {
            drawHighStakeNumber(val);
          } else if (activeGoldSet.has(val)) {
            drawOverlapNumber(val);
          } else {
            drawSingleGreenNumber(val);
          }
        });

        // Highlight jackpot numbers (including zero rule numbers) in blue on the wheel
        (cachedJackpotNumbersLt || []).forEach((val) => {
          drawHighStakeNumber(val);
        });

        // Delimit each JP zone (JP + 3 neighbors) with center radial lines.
        drawLightningJackpotZoneBoundaries(cachedJackpotNumbersLt || []);
      }
    } else {
      recentNumbers.slice(0, 4).forEach((n) => {
        draw3Neighborhood(n);
      });

      if (highStakeNumbers && highStakeNumbers.length > 0) {
        highStakeNumbers.forEach((numObj) => {
          const val = numObj && typeof numObj === "object" && numObj.number !== undefined ? numObj.number : numObj;
          drawHighStakeNumber(val);
        });
      }

      if (zoneStrategy.overlapSet && zoneStrategy.overlapSet.size > 0) {
        Array.from(zoneStrategy.overlapSet).forEach((num) => {
          drawOverlapNumber(num);
        });
      }
    }

    var canvas = document.getElementById(activeCanvasId);
    if (canvas && canvas.getContext) {
      const geometry = getWheelGeometry();
      let insideRadius = geometry.insideRadius;
      ctx.fillStyle = "transparent";
      ctx.strokeStyle = (activeCanvasId === "canvas-lt") ? "rgba(133, 149, 171, 0.5)" : "#22441b";
      ctx.lineWidth = (activeCanvasId === "canvas-lt") ? 0.8 : 1.5;
      ctx.beginPath();
      ctx.arc(geometry.centerX, geometry.centerY, insideRadius, 0, Math.PI * 2);
      ctx.stroke();

      if (activeCanvasId === "canvas-lt") {
        // Keep roulette numbers crisp after translucent LT overlays.
        drawWheelNumberLabels();
      }
    }
    syncAllWheelCanvases();
  }

  function syncAllWheelCanvases() {
    const primaryCanvas = document.getElementById(activeCanvasId);
    if (!primaryCanvas) return;
    const allCanvases = document.querySelectorAll(activeCanvasId === "canvas-lt" ? "#canvas-lt" : "#canvas");
    allCanvases.forEach(canvas => {
      if (canvas !== primaryCanvas) {
        const context = canvas.getContext("2d");
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(primaryCanvas, 0, 0);
        }
      }
    });
  }

  function getNumberFromWheelClick(event) {
    const canvas = document.getElementById(activeCanvasId);
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const geometry = getWheelGeometry();
    const dx = x - geometry.centerX;
    const dy = y - geometry.centerY;
    const distance = Math.sqrt((dx * dx) + (dy * dy));

    if (distance < geometry.insideRadius || distance > geometry.outsideRadius) {
      return null;
    }

    let angle = Math.atan2(dy, dx) - startAngle;
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;

    const index = Math.floor(angle / arc);
    return numbers[index] || null;
  }

  function getRepeatPatternStateFromHistory(recentNumbers) {
    if (!recentNumbers || recentNumbers.length < 3) {
      return false;
    }

    // Recent is newest-first. REP is active only if a trigger happened in the
    // last 8 rounds: current round repeats one of the previous 2 rounds.
    const window = recentNumbers.slice(0, 10).map((n) => String(n));
    const maxTriggerAge = Math.min(8, window.length - 2);
    for (let age = 0; age <= maxTriggerAge; age++) {
      const current = window[age];
      const prev = window[age + 1];
      const prev2 = window[age + 2];
      if (current === prev || current === prev2) {
        return true;
      }
    }

    return false;
  }

  function getLightningPatternNumbers(recentNumbers) {
    if (!enabledPatternsLt.rep) {
      return [];
    }
    if (!recentNumbers || recentNumbers.length < 2) {
      return [];
    }
    const isActive = getRepeatPatternStateFromHistory(recentNumbers);
    if (isActive) {
      const first = String(recentNumbers[0]);
      const second = String(recentNumbers[1]);
      if (first === second && recentNumbers.length >= 3) {
        return [first, String(recentNumbers[2])];
      }
      return [first, second];
    }
    return [];
  }

  function drawSingleGreenNumber(n) {
    var canvas = document.getElementById(activeCanvasId);
    if (canvas && canvas.getContext) {
      const geometry = getWheelGeometry();
      var outsideRadius = geometry.outsideRadius;
      let insideRadius = geometry.insideRadius;
      let idx = numbers.indexOf(String(n));
      if (idx !== -1) {
        let start_angle = startAngle + idx * arc;
        if (activeCanvasId === "canvas-lt") {
          ctx.fillStyle = "rgba(84, 180, 53, 0.2)";
          ctx.strokeStyle = "rgba(84, 180, 53, 0.35)";
          ctx.lineWidth = 0.7;
        } else {
          ctx.fillStyle = "rgba(84, 180, 53, 0.45)"; // green semitransparent
          ctx.strokeStyle = "#54b435";
          ctx.lineWidth = 1;
        }
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, outsideRadius, start_angle, start_angle + arc, false);
        ctx.arc(canvas.width / 2, canvas.height / 2, insideRadius, start_angle + arc, start_angle, true);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
    }
  }

  function getConsecutiveNeighbors(n) {
    const num = parseInt(n, 10);
    if (isNaN(num) || num === 0) return [];
    
    let prev = num - 1;
    let next = num + 1;
    
    // Wrap around 36 to 1, skipping 0
    if (prev < 1) prev = 36;
    if (next > 36) next = 1;
    
    return [String(prev), String(next)];
  }

  function areConsecutive(a, b) {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (isNaN(numA) || isNaN(numB)) return false;
    if (numA === 0 || numB === 0) return false;
    
    const diff = Math.abs(numA - numB);
    if (diff === 1) return true;
    if (numA === 1 && numB === 36) return true;
    if (numA === 36 && numB === 1) return true;
    
    return false;
  }

  function getLightningConsecutiveNumbers(recentNumbers) {
    if (!enabledPatternsLt.cns) {
      return { triggerSet: new Set(), neighborSet: new Set() };
    }
    if (!recentNumbers || recentNumbers.length < 2) {
      return { triggerSet: new Set(), neighborSet: new Set() };
    }

    // Check if CNS is deactivated due to a recent hit
    if (lastCnsHitWinnerLt !== null) {
      const hitIdx = recentNumbers.map(String).indexOf(String(lastCnsHitWinnerLt));
      if (hitIdx !== -1) {
        // Only look at spins completely after the hit (indices from 0 to hitIdx - 1)
        const postHitSpins = recentNumbers.slice(0, hitIdx);
        let hasNewConsec = false;
        const last5Post = postHitSpins.slice(0, 5).map(String);
        for (let i = 0; i < last5Post.length - 1; i++) {
          if (areConsecutive(last5Post[i], last5Post[i + 1])) {
            hasNewConsec = true;
            break;
          }
        }

        if (hasNewConsec) {
          lastCnsHitWinnerLt = null;
        } else {
          return { triggerSet: new Set(), neighborSet: new Set() };
        }
      } else {
        lastCnsHitWinnerLt = null;
      }
    }

    const last5 = recentNumbers.slice(0, 5).map(n => String(n));
    const triggerSet = new Set();
    const neighborSet = new Set();

    // Strict CNS: only back-to-back spins can trigger (i and i+1 in the last 5 rounds).
    for (let i = 0; i < last5.length - 1; i++) {
      if (!areConsecutive(last5[i], last5[i + 1])) {
        continue;
      }

      triggerSet.add(last5[i]);
      triggerSet.add(last5[i + 1]);

      getConsecutiveNeighbors(last5[i]).forEach(neighbor => neighborSet.add(neighbor));
      getConsecutiveNeighbors(last5[i + 1]).forEach(neighbor => neighborSet.add(neighbor));
    }

    return { triggerSet, neighborSet };
  }

  function getLightningPreferenceNumbers(recentNumbers) {
    if (!enabledPatternsLt.pref) {
      return [];
    }
    if (!recentNumbers || recentNumbers.length === 0) {
      return [];
    }
    const lastNum = String(recentNumbers[0]);
    if (customPrefMappingLt[lastNum] !== undefined) {
      return customPrefMappingLt[lastNum];
    }
    return defaultPrefMappingLt[lastNum] || [];
  }

  function getZeroRuleJackpotNumbers(recentNumbers) {
    if (!enabledPatternsLt.zero) {
      return [];
    }
    if (!recentNumbers || recentNumbers.length < 2) {
      return [];
    }
    const zeroRuleSet = new Set();
    // Scan the first 8 numbers in the history for "0"
    for (let i = 0; i < Math.min(recentNumbers.length, 8); i++) {
      if (String(recentNumbers[i]) === "0") {
        if (i + 1 < recentNumbers.length) {
          const prev = String(recentNumbers[i + 1]);
          const neighbors = getConsecutiveNeighbors(prev);
          const spunAfterZero = new Set(recentNumbers.slice(0, i).map(String));
          
          // Check if any neighbor has already hit after the zero
          const hasHit = neighbors.some(n => spunAfterZero.has(n));
          if (!hasHit) {
            neighbors.forEach(neighbor => {
              zeroRuleSet.add(neighbor);
            });
          }
        }
      }
    }
    return Array.from(zeroRuleSet);
  }

  function buildLightningJackpotNumbers(recentNumbers, favoriteNumbers, currentWinner) {
    if (!recentNumbers || recentNumbers.length < 4) {
      return [];
    }

    const hotSet = new Set((favoriteNumbers || []).map((n) => String(n)));
    const sourceMap = new Map();

    function addPatternTargets(sourceCode, targets) {
      uniquePreserveOrder((targets || []).map((n) => String(n))).forEach((numStr) => {
        if (!numStr) {
          return;
        }
        if (!sourceMap.has(numStr)) {
          sourceMap.set(numStr, new Set());
        }
        sourceMap.get(numStr).add(sourceCode);
      });
    }

    const zeroTargets = getZeroRuleJackpotNumbers(recentNumbers).map(String);
    const repTargets = getLightningPatternNumbers(recentNumbers).map(String);
    const consec = getLightningConsecutiveNumbers(recentNumbers);
    const cnsTargets = enabledPatternsLt.cns && consec && consec.triggerSet && consec.triggerSet.size > 0 && currentWinner
      ? getConsecutiveNeighbors(String(currentWinner)).map(String)
      : [];
    const prefTargets = enabledPatternsLt.pref ? getLightningPreferenceNumbers(recentNumbers).map(String) : [];

    addPatternTargets("ZERO", zeroTargets);
    addPatternTargets("REP", repTargets);
    addPatternTargets("CNS", cnsTargets);
    addPatternTargets("PREF", prefTargets);

    const scored = Array.from(sourceMap.entries()).map(([number, sources]) => {
      const patternCount = sources.size;
      const hotBonus = hotSet.has(number) ? 20 : 0;
      const score = Math.min(100, (patternCount * 20) + hotBonus);
      return {
        number,
        score,
        source: Array.from(sources).join("+"),
        patternCount,
        isHot: hotSet.has(number)
      };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.patternCount !== a.patternCount) {
        return b.patternCount - a.patternCount;
      }
      if (a.isHot !== b.isHot) {
        return a.isHot ? -1 : 1;
      }
      return numbers.indexOf(a.number) - numbers.indexOf(b.number);
    });

    return scored.slice(0, 4);
  }

  function renderLightningActivePatterns(container, recentNumbers) {
    if (!container) return;
    container.innerHTML = "";

    let zeroDesc = "Zero Rule inactive.";
    let isZeroActive = false;
    if (enabledPatternsLt.zero && recentNumbers && recentNumbers.length >= 2) {
      for (let i = 0; i < Math.min(recentNumbers.length, 8); i++) {
        if (String(recentNumbers[i]) === "0" && i + 1 < recentNumbers.length) {
          const prev = String(recentNumbers[i + 1]);
          const neighbors = getConsecutiveNeighbors(prev);
          const spunAfterZero = new Set(recentNumbers.slice(0, i).map(String));
          const hasHit = neighbors.some((n) => spunAfterZero.has(n));
          if (!hasHit) {
            isZeroActive = true;
            zeroDesc = `Zero spun after ${prev}. Playing neighbors ${neighbors.join(" & ")}. Active for ${8 - i} spins or until hit.`;
            break;
          }
        }
      }
    }

    const isRepActive = enabledPatternsLt.rep && getRepeatPatternStateFromHistory(recentNumbers);
    const repDesc = isRepActive
      ? "Repeat pattern is active. Recommends playing the last two numbers: " + recentNumbers.slice(0, 2).join(" & ") + "."
      : "Repeat Pattern inactive.";

    const consec = getLightningConsecutiveNumbers(recentNumbers);
    const isCnsActive = enabledPatternsLt.cns && consec && consec.triggerSet && consec.triggerSet.size > 0;
    const cnsDesc = isCnsActive
      ? "Consecutive numbers detected in history: " + Array.from(consec.triggerSet).join(" & ") + ". Recommends playing consecutive neighbors."
      : "Consecutive Pattern inactive.";

    const prefNums = enabledPatternsLt.pref && recentNumbers && recentNumbers.length > 0
      ? getLightningPreferenceNumbers(recentNumbers)
      : [];
    const isPrefActive = !!(enabledPatternsLt.pref && prefNums && prefNums.length > 0);
    const prefDesc = isPrefActive
      ? "Preference mapping is active for last spin " + recentNumbers[0] + ". Targets: " + prefNums.join(", ") + "."
      : "Preference Mapping inactive.";

    const chipMeta = [
      { key: "ZERO", code: "ZERO", colorClass: "blue", active: isZeroActive, desc: zeroDesc },
      { key: "REP", code: "REP", colorClass: "purple", active: isRepActive, desc: repDesc },
      { key: "CNS", code: "CNS", colorClass: "gold-glow", active: isCnsActive, desc: cnsDesc },
      { key: "PREF", code: "PREF", colorClass: "green-glow", active: isPrefActive, desc: prefDesc }
    ];

    chipMeta.forEach((chip) => {
      const wrapper = document.createElement("div");
      wrapper.className = "pattern-chip-wrapper";
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "2px";
      wrapper.style.width = "28px";

      const badge = document.createElement("span");
      const prevState = !!lastPatternChipStatesLt[chip.key];
      const changed = prevState !== chip.active;

      badge.className = `number-badge ${chip.active ? chip.colorClass : "wait-badge pattern-chip-inactive"}${changed ? " pattern-chip-rotate" : ""}`;
      badge.style.fontSize = "8px";
      badge.style.fontWeight = "800";
      badge.style.letterSpacing = "0.05em";
      badge.style.display = "flex";
      badge.style.alignItems = "center";
      badge.style.justifyContent = "center";
      badge.style.minWidth = "42px";
      badge.style.width = "42px";
      badge.style.height = "42px";
      badge.style.lineHeight = "42px";
      badge.style.fontSize = "10px";
      badge.style.borderRadius = "999px";
      badge.style.margin = "0";
      badge.innerText = chip.code;
      badge.title = `${chip.code}: ${chip.desc}`;

      const statusEl = document.createElement("span");
      statusEl.className = "pattern-chip-state";
      statusEl.style.fontSize = "9px";
      statusEl.style.fontWeight = "700";
      statusEl.style.color = chip.active ? "#54b435" : "var(--muted)";
      statusEl.innerText = chip.active ? "100%" : "0%";

      wrapper.appendChild(badge);
      wrapper.appendChild(statusEl);
      container.appendChild(wrapper);

      lastPatternChipStatesLt[chip.key] = chip.active;
    });
  }

  // Update UI Elements
  function updateDashboard(msg) {
    ensureMultiplierInfoRow();
    const recentNumbers = msg.recentNumbers || [];
    const incomingFavoriteNumbers = msg.favoriteNumbers || [];
    const incomingBetFavorites = msg.betFavorites || [];
    const incomingHighStakeNumbers = msg.highStakeNumbers || [];
    const dealer = msg.dealer;
    const incomingTableType = String(msg.tableType || "UNKNOWN");

    if (incomingTableType !== currentTableType) {
      currentTableType = incomingTableType;
      // Keep states separate across different live table types.
      persistentJackpotsLt = [];
      lastWinnerForJackpotsLt = null;
      lastCnsHitWinnerLt = null;
    }

    if (typeof msg.multiplierHits === "number" && !isNaN(msg.multiplierHits)) {
      multiplierHitCount = msg.multiplierHits;
    }

    const favoriteNumbers = incomingFavoriteNumbers;
    const effectiveBetFavorites = (recentNumbers || []).slice(0, 4).map((n) => String(n));
    const zoneStrategy = buildZoneFromAnchors(effectiveBetFavorites);
    const effectiveBetNumbers = zoneStrategy.zoneNumbers;
    const currentWinner = recentNumbers && recentNumbers[0] ? String(recentNumbers[0]) : null;
    const highStakeNumbers = (incomingHighStakeNumbers || []).slice(0, 4);

    const jackpotNumbers = getJackpotNumbers(highStakeNumbers);

    let maxBaseScore = 0;
    if (recentNumbers && recentNumbers.length >= 4) {
      highStakeNumbers.forEach(item => {
        let score = 0;
        if (item && typeof item === "object") {
          if (item.score !== undefined) {
            score = item.score;
          } else {
            const numVal = item.number !== undefined ? item.number : (item.num !== undefined ? item.num : item);
            score = calculateJackpotScore(String(numVal), recentNumbers, favoriteNumbers, numbers, get3NeighborhoodFromWheel);
          }
        } else {
          score = calculateJackpotScore(String(item), recentNumbers, favoriteNumbers, numbers, get3NeighborhoodFromWheel);
        }
        if (score > maxBaseScore) {
          maxBaseScore = score;
        }
      });
    }

    // Bypassed local calculations. The Lightning predictions are computed securely server-side.
    let finalHighStakeNumbersLt = [];
    let jackpotNumbersLt = [];
    let combinedPatternNumbersLt = [];
    let combinedDuplicatesLt = new Set();
    let isWaitRoundLt = true;

    if (msg.lightning) {
      finalHighStakeNumbersLt = msg.lightning.highStakeNumbers || [];
      jackpotNumbersLt = msg.lightning.jackpotNumbers || [];
      combinedPatternNumbersLt = msg.lightning.patternNumbers || [];
      combinedDuplicatesLt = new Set(msg.lightning.goldenRingNumbers || []);
      isWaitRoundLt = !!msg.lightning.isWaitRound;
    }
    const isWaitRound = !recentNumbers || recentNumbers.length < 4 || !effectiveBetFavorites || effectiveBetFavorites.length === 0 || !zoneStrategy.overlapSet || zoneStrategy.overlapSet.size === 0 || maxBaseScore < 50;
    const standardGoldNumbers = zoneStrategy.overlapSet ? Array.from(zoneStrategy.overlapSet).map(String) : [];
    const lightningGoldNumbers = combinedDuplicatesLt ? Array.from(combinedDuplicatesLt).map(String) : [];
    const lightningPatternSnapshot = getLightningPatternSnapshot(recentNumbers, currentWinner);

    if ((!recentNumbers || recentNumbers.length < 4) && currentDashboardState.winner && (Date.now() - lastStableDashboardAt < 12000)) {
      return;
    }

    if (recentNumbers && recentNumbers.length >= 4) {
      lastStableDashboardAt = Date.now();
    }

    const isNewWinner = currentWinner && currentWinner !== currentDashboardState.winner;
    const previousDashboardState = currentDashboardState;

    if (sessionActive && isNewWinner && previousDashboardState.winner) {
      updatePlayInformation(makeSessionLogEntry(previousDashboardState, currentWinner, dealer));
    }

    if (isNewWinner && previousDashboardState.winner) {
      const previousLog = makeSessionLogEntry(previousDashboardState, currentWinner, dealer);
      const outcome = getOutcomeFromLog(previousLog);

      if (outcome === "wait") {
        setHeaderState("live", {
          badge: "Wait",
          helper: "skipped",
          note: "no bet",
          autoRevert: true
        });
      } else if (outcome === "victory") {
        setHeaderState("victory", {
          badge: "Jackpot",
          helper: "jp hit",
          note: "victory",
          autoRevert: true
        });
      } else if (outcome === "gold") {
        setHeaderState("gold", {
          badge: "Gold",
          helper: "gold hit",
          note: "gold overlap hit",
          autoRevert: true
        });
      } else if (outcome === "win") {
        setHeaderState("win", {
          badge: "Win",
          helper: "cover hit",
          note: "strategy win",
          autoRevert: true
        });
      } else {
        setHeaderState("loss", {
          badge: "Loss",
          helper: "missed",
          note: "zen loss",
          autoRevert: true
        });
      }
    }

    if (currentWinner) {
      const isLightningMode = activeCanvasId === "canvas-lt";
      const currentIsWaitRound = isLightningMode ? isWaitRoundLt : isWaitRound;
      const currentRawBetNumbers = isLightningMode
        ? combinedPatternNumbersLt.map((n) => String(n))
        : effectiveBetNumbers.map((n) => String(n));
      const currentJackpotNumbers = isLightningMode ? jackpotNumbersLt : jackpotNumbers;
      const currentGoldenNumbers = isLightningMode ? lightningGoldNumbers : standardGoldNumbers;

      currentDashboardState = {
        winner: currentWinner,
        zoneNumbers: currentRawBetNumbers,
        betNumbers: currentIsWaitRound ? [] : currentRawBetNumbers,
        candidateNumbers: currentRawBetNumbers,
        jackpotNumbers: currentJackpotNumbers,
        goldenNumbers: currentGoldenNumbers,
        standardNumbers: currentRawBetNumbers.filter((n) => !currentJackpotNumbers.includes(String(n)) && !currentGoldenNumbers.includes(String(n))),
        patternNumbers: isLightningMode ? combinedPatternNumbersLt.map((n) => String(n)) : [],
        activePatterns: isLightningMode ? lightningPatternSnapshot.activePatterns : ["STANDARD"],
        patternTargets: isLightningMode ? lightningPatternSnapshot.patternTargets : {},
        strategyMode: isLightningMode ? "LIGHTNING" : "STANDARD",
        decision: currentIsWaitRound ? "WAIT" : "PLAY",
        isWaitRound: currentIsWaitRound,
        recentNumbers: listToStrings(recentNumbers),
        mathCounts: isLightningMode ? currentMathCountsLt : currentMathCounts,
        updatedAt: new Date().toISOString(),
        dealer: dealer || "zra"
      };
    }

    cachedStrategy = {
      favoriteNumbers: Array.isArray(incomingFavoriteNumbers) ? incomingFavoriteNumbers : [],
      betFavorites: Array.isArray(incomingBetFavorites) ? incomingBetFavorites : [],
      highStakeNumbers: highStakeNumbers
    };

    // Cache inputs for dynamic tab switching redraws
    cachedRecentNumbers = recentNumbers;
    cachedHighStakeNumbers = highStakeNumbers;
    cachedHighStakeNumbersLt = finalHighStakeNumbersLt;
    cachedJackpotNumbersLt = jackpotNumbersLt;
    cachedZoneStrategy = zoneStrategy;
    cachedPatternNumbersLt = combinedPatternNumbersLt;
    cachedDuplicatesLt = combinedDuplicatesLt;
    cachedIsWaitRoundLt = isWaitRoundLt;

    redrawActiveWheel();

    // Recent numbers (Last 4) and active patterns as clickable badges
    document.querySelectorAll(".zrr-last-four-numbers").forEach(container => {
      renderInteractiveNumbers(container, recentNumbers, 4, false);
    });
    document.querySelectorAll(".zrr-last-four-numbers-lt").forEach(container => {
      renderLightningActivePatterns(container, recentNumbers);
    });

    document.querySelectorAll(".zrr-jackpot-four-numbers").forEach(container => {
      if (jackpotNumbers.length > 0 && !isWaitRound) {
        renderJackpotNumbersWithScores(container, highStakeNumbers, 4);
      } else {
        renderWaitStack(container);
      }
    });

    document.querySelectorAll(".zrr-jackpot-four-numbers-lt").forEach(container => {
      if (jackpotNumbersLt.length > 0 && !isWaitRoundLt) {
        renderJackpotNumbersWithScores(container, finalHighStakeNumbersLt, 4);
      } else {
        renderWaitStack(container);
      }
    });

    // Render Golden Ring Overlaps stack in the right rail
    document.querySelectorAll(".zrr-gold-numbers").forEach(container => {
      renderGoldenRingRail(container, isWaitRound ? null : zoneStrategy.overlapSet);
    });
    document.querySelectorAll(".zrr-gold-numbers-lt").forEach(container => {
      renderGoldenRingRail(container, isWaitRoundLt ? null : combinedDuplicatesLt);
    });

    updateCenterChip(recentNumbers[0], jackpotNumbers);

    // Update balance if scraped from page and user hasn't overridden it
    if (msg && msg.balance !== undefined && msg.balance !== null) {
      const parsedBal = parseFloat(msg.balance);
      if (!isNaN(parsedBal)) {
        if (!hasUserModifiedBudget) {
          document.querySelectorAll(".zrr-math-budget").forEach(input => {
            input.value = Math.round(parsedBal);
          });
          document.querySelectorAll("#zrr-math-budget-lt").forEach(input => {
            input.value = Math.round(parsedBal);
          });
        }
      }
    }

    // Count categorization for Standard exit strategy math
    if (isWaitRound) {
      currentMathCounts = { std: 0, gold: 0, jp: 0 };
    } else {
      const activeJpSet = new Set(jackpotNumbers.map(n => String(n)));
      const activeGoldSet = new Set();
      if (zoneStrategy.overlapSet) {
        zoneStrategy.overlapSet.forEach(n => {
          const val = String(n);
          if (!activeJpSet.has(val)) {
            activeGoldSet.add(val);
          }
        });
      }
      const activeStdSet = new Set();
      if (effectiveBetNumbers) {
        effectiveBetNumbers.forEach(n => {
          const val = String(n);
          if (!activeJpSet.has(val) && !activeGoldSet.has(val)) {
            activeStdSet.add(val);
          }
        });
      }

      currentMathCounts = {
        std: activeStdSet.size,
        gold: activeGoldSet.size,
        jp: activeJpSet.size
      };
    }

    // Count categorization for Lightning exit strategy math
    if (isWaitRoundLt) {
      currentMathCountsLt = { std: 0, gold: 0, jp: 0 };
    } else {
      const activeJpSet = new Set(jackpotNumbersLt);
      const activeGoldSet = new Set();
      if (combinedDuplicatesLt) {
        combinedDuplicatesLt.forEach(n => {
          const val = String(n);
          if (!activeJpSet.has(val)) {
            activeGoldSet.add(val);
          }
        });
      }
      const activeStdSet = new Set();
      if (combinedPatternNumbersLt) {
        combinedPatternNumbersLt.forEach(n => {
          const val = String(n);
          if (!activeJpSet.has(val) && !activeGoldSet.has(val)) {
            activeStdSet.add(val);
          }
        });
      }

      currentMathCountsLt = {
        std: activeStdSet.size,
        gold: activeGoldSet.size,
        jp: activeJpSet.size
      };
    }

    if (currentDashboardState && currentDashboardState.winner === currentWinner) {
      currentDashboardState.mathCounts = currentDashboardState.strategyMode === "LIGHTNING"
        ? Object.assign({}, currentMathCountsLt)
        : Object.assign({}, currentMathCounts);
    }

    calculateStrategyMath();

    // Calculate clumping strength based on highStakeNumbers' base scores
    const clumpingIndicator = document.getElementById("zrr-clumping-indicator");
    const clumpingValue = document.getElementById("zrr-clumping-value");
    const clumpingIndicatorLt = document.getElementById("zrr-clumping-indicator-lt");
    const clumpingValueLt = document.getElementById("zrr-clumping-value-lt");

    if (clumpingIndicatorLt) {
      clumpingIndicatorLt.style.display = "none";
    }

    [
      { ind: clumpingIndicator, val: clumpingValue }
    ].forEach(item => {
      if (item.ind && item.val) {
        if (!recentNumbers || recentNumbers.length < 4) {
          item.ind.style.display = "none";
        } else {
          item.ind.style.display = "flex";

          let level = "Low";
          let color = "#e74c3c"; // red
          let actionTip = "Wait / Sit Out";

          if (maxBaseScore >= 60) {
            level = "High";
            color = "#54b435"; // green
            actionTip = "Bet Recommended (Zones Converging)";
          } else if (maxBaseScore >= 35) {
            level = "Medium";
            color = "#e67e22"; // orange
            actionTip = "Caution (Zones Shifting)";
          } else {
            level = "Low";
            color = "#e74c3c"; // red
            actionTip = "Wait / Sit Out (No clumping)";
          }

          item.val.innerHTML = `<span style="color: ${color}; font-weight: 700;">${level} (${maxBaseScore}%)</span> &mdash; ${actionTip}`;
        }
      }
    });

    // Strategy recommendation display (looping over all instances of strategy cards to update clones)
    const strategyCards = document.querySelectorAll(".strategy-card:not(#zrr-strategy-card-lt)");
    strategyCards.forEach(card => {
      const recAlert = card.querySelector(".zrr-recommendation");
      const betDiv = card.querySelector(".zrr-bet-numbers");
      const highStakeDiv = card.querySelector(".zrr-high-stake-numbers");
      renderRecommendationCard(recAlert, betDiv, highStakeDiv, recentNumbers, effectiveBetFavorites, zoneStrategy, jackpotNumbers, effectiveBetNumbers, highStakeNumbers, isWaitRound);
    });

    const strategyCardsLt = document.querySelectorAll("#zrr-strategy-card-lt");
    strategyCardsLt.forEach(card => {
      const recAlertLt = card.querySelector(".zrr-recommendation-lt");
      const betDivLt = card.querySelector(".zrr-bet-numbers-lt");
      const highStakeDivLt = card.querySelector(".zrr-high-stake-numbers-lt");
      renderRecommendationCard(recAlertLt, betDivLt, highStakeDivLt, recentNumbers, effectiveBetFavorites, zoneStrategyLt, jackpotNumbersLt, combinedPatternNumbersLt, finalHighStakeNumbersLt, isWaitRoundLt);
    });

    // Update dealer name
    if (dealer) {
      document.getElementById("zrr-dealer-name").innerText = dealer;
    }

    // Automatic commentary is disabled; assistant is on standby for chatbox questions.
  }

  // Update session stats and last rounds list
  function updatePlayInformation(msg) {
    if (msg.dealer) {
      document.getElementById("zrr-dealer-name").innerText = msg.dealer;
    }

    if (!sessionActive) {
      return;
    }

    const resultType = getOutcomeFromLog(msg);

    playData.push({
      playTime: msg.playTime,
      loggedAt: msg.loggedAt,
      dealer: msg.dealer,
      playRound: msg.playRound,
      strategyMode: msg.strategyMode || "STANDARD",
      decision: msg.decision || (msg.isWaitRound ? "WAIT" : "PLAY"),
      previousWinner: msg.previousWinner || "",
      betOn: listToStrings(msg.betOn),
      winner: msg.winner,
      win: !!msg.win,
      favorite: !!msg.favorite,
      golden: !!msg.golden,
      resultType: resultType,
      candidateNumbers: listToStrings(msg.candidateNumbers),
      standardNumbers: listToStrings(msg.standardNumbers),
      goldenNumbers: listToStrings(msg.goldenNumbers),
      jackpotNumbers: listToStrings(msg.jackpotNumbers),
      patternNumbers: listToStrings(msg.patternNumbers),
      activePatterns: listToStrings(msg.activePatterns),
      patternTargets: msg.patternTargets || {},
      recentNumbersBefore: listToStrings(msg.recentNumbersBefore),
      mathCounts: msg.mathCounts || { std: 0, gold: 0, jp: 0 },
      recommendationAt: msg.recommendationAt || "",
      isWaitRound: !!msg.isWaitRound
    });

    if (resultType === "wait") {
      waitSessions++;
    } else {
      allSessions++;
      if (msg.win) {
        winSessions++;
      }
      if (msg.favorite) {
        jackpotSessions++;
      }
    }

    updateSessionStatsUi();

    // Repaint hands list
    const handsContainer = document.getElementById("zrr-play-information");
    handsContainer.innerHTML = "";
    
    // Show last 8 hands (newest first)
    const lastHands = playData.slice(-8).reverse();
    
    if (lastHands.length === 0) {
      handsContainer.innerHTML = '<div class="msg">No rounds recorded yet in this session.</div>';
    } else {
      lastHands.forEach((hand) => {
        const color = getColorFromNumber(hand.winner);
        const resultLabel = hand.resultType === "wait"
          ? "WAIT"
          : (hand.resultType === "victory"
          ? "VICTORY"
          : (hand.resultType === "gold" ? "GOLD" : (hand.win ? "WIN" : "LOSS")));
        const item = document.createElement("div");
        item.className = "hand-item";
        item.style.flexDirection = "column";
        item.style.alignItems = "stretch";
        item.style.gap = "6px";
        const patterns = hand.activePatterns && hand.activePatterns.length > 0 ? hand.activePatterns.join(" ") : "-";
        const betCount = hand.betOn ? hand.betOn.length : 0;
        const jpText = hand.jackpotNumbers && hand.jackpotNumbers.length > 0 ? hand.jackpotNumbers.join(" ") : "-";
        const goldText = hand.goldenNumbers && hand.goldenNumbers.length > 0 ? hand.goldenNumbers.join(" ") : "-";
        
        item.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div>
              <span class="number-badge ${color}" style="margin:0; width:22px; height:22px; line-height:22px; font-size:11px;">${escapeHtml(hand.winner)}</span>
              <span style="color:var(--text-secondary); margin-left:6px; font-size:12px;">${escapeHtml(hand.playTime)} · ${escapeHtml(hand.strategyMode)} · ${escapeHtml(hand.decision)}</span>
            </div>
            <div class="hand-result ${hand.resultType}">
              ${resultLabel}
            </div>
          </div>
          <div style="font-size:10px; color:var(--muted); display:grid; grid-template-columns: 1fr 1fr; gap:4px 8px; line-height:1.35;">
            <span>Prev: ${escapeHtml(hand.previousWinner || "-")}</span>
            <span>Bet #: ${betCount}</span>
            <span>Patterns: ${escapeHtml(patterns)}</span>
            <span>JP: ${escapeHtml(jpText)}</span>
            <span>Gold: ${escapeHtml(goldText)}</span>
            <span>Recent: ${escapeHtml((hand.recentNumbersBefore || []).slice(0, 6).join(" "))}</span>
          </div>
        `;
        handsContainer.appendChild(item);
      });
    }
  }

  function clearPlayInformation() {
    document.getElementById('zrr-play-information').innerHTML = '<div class="msg">No rounds recorded yet in this session.</div>';
  }

  // Save Stats
  function saveStatus() {
    chrome.runtime.sendMessage({
      type: "save-stats",
      playData: playData
    });
  }

  // Reset Stats
  function resetStatus() {
    playData = [];
    allSessions = 0;
    winSessions = 0;
    jackpotSessions = 0;
    waitSessions = 0;
    clearPlayInformation();
    updateSessionStatsUi();
    if (sessionActive) {
      setHeaderState("live", {
        badge: "Live",
        helper: "live log",
        note: "logging"
      });
    } else {
      setHeaderState("idle", {
        badge: "Idle",
        helper: "tap start",
        note: "idle"
      });
    }
  }

  // Call API for auth
  const api = (data) => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "api", data: data }, resolve);
  });

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function formatMembershipLabel(value) {
    const membership = String(value || "").trim().toLowerCase();
    if (membership === "club" || membership === "club_member" || membership === "club-member") {
      return "CLUB Member";
    }
    if (membership === "administrator") {
      return "Administrator";
    }
    if (membership === "wordpress") {
      return "WordPress Member";
    }
    if (membership === "trial") {
      return "Trial Member";
    }
    return "TRIBE Member";
  }

  function createInstallationId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `zri-${globalThis.crypto.randomUUID()}`;
    }
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return `zri-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  async function getDeviceId() {
    const stored = await chrome.storage.local.get([INSTALLATION_STORAGE_KEY]);
    const existing = String((stored && stored[INSTALLATION_STORAGE_KEY]) || "");
    if (/^zri-[a-zA-Z0-9-]{16,}$/.test(existing)) {
      return existing;
    }
    const installationId = createInstallationId();
    await chrome.storage.local.set({ [INSTALLATION_STORAGE_KEY]: installationId });
    return installationId;
  }

  function parseExpiryMs(expiresAt) {
    const ms = Date.parse(expiresAt || "");
    return Number.isFinite(ms) ? ms : 0;
  }

  function formatExpiry(expiresAt) {
    const ms = parseExpiryMs(expiresAt);
    if (!ms) {
      return "Not active";
    }
    return new Date(ms).toLocaleString();
  }

  function clearLicenseCountdown() {
    if (licenseCountdownTimer) {
      clearInterval(licenseCountdownTimer);
      licenseCountdownTimer = null;
    }
    if (licenseCountdownValue) {
      licenseCountdownValue.innerText = "--:--:--";
    }
  }

  function formatRemaining(ms) {
    const safeMs = Math.max(0, ms);
    const totalSeconds = Math.floor(safeMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function startLicenseCountdown(expiresAt) {
    clearLicenseCountdown();
    const expiryMs = parseExpiryMs(expiresAt);
    if (!expiryMs || !licenseCountdownValue) {
      return;
    }

    const updateCountdown = () => {
      const remainingMs = expiryMs - Date.now();
      if (remainingMs <= 0) {
        clearLicenseCountdown();
        if (licenseCountdownValue) {
          licenseCountdownValue.innerText = "Expired";
        }
        if (!licenseExpiryRefreshPending) {
          licenseExpiryRefreshPending = true;
          chrome.storage.local.remove(LICENSE_STORAGE_KEY)
            .then(() => checkAuth())
            .finally(() => {
              licenseExpiryRefreshPending = false;
            });
        }
        return;
      }
      licenseCountdownValue.innerText = formatRemaining(remainingMs);
    };

    updateCountdown();
    licenseCountdownTimer = setInterval(updateCountdown, 1000);
  }

  function setLicenseStatus(message, isError) {
    if (!licenseStatusBox) {
      return;
    }
    licenseStatusBox.innerText = message || "";
    licenseStatusBox.style.color = isError ? "#ff7d7d" : "var(--text-secondary)";
  }

  function syncLicenseEmailFromAuth() {
    const authEmailInput = document.getElementById("zrr-email");
    if (!licenseEmailInput || !authEmailInput) {
      return;
    }
    if (!licenseEmailInput.value && authEmailInput.value) {
      licenseEmailInput.value = authEmailInput.value;
    }
  }

  async function getStoredLicense() {
    const res = await chrome.storage.local.get([LICENSE_STORAGE_KEY]);
    return res && res[LICENSE_STORAGE_KEY] ? res[LICENSE_STORAGE_KEY] : null;
  }

  function isValidLocalLicense(license, emailHint, deviceId) {
    if (!license) {
      return false;
    }
    const expiresMs = parseExpiryMs(license.expiresAt);
    if (!expiresMs || expiresMs <= Date.now()) {
      return false;
    }
    if (license.deviceId !== deviceId) {
      return false;
    }
    if (emailHint && normalizeEmail(license.email) !== normalizeEmail(emailHint)) {
      return false;
    }
    return true;
  }

  async function refreshLicenseUiFromStorage(emailHint) {
    const stored = await getStoredLicense();
    const deviceId = await getDeviceId();
    const valid = isValidLocalLicense(stored, emailHint, deviceId);
    let serverValid = valid;

    if (valid && stored && normalizeEmail(stored.email)) {
      try {
        const statusRes = await api({
          action: "license_status",
          email: normalizeEmail(stored.email),
          deviceId
        });
        serverValid = !!(statusRes && statusRes.success && statusRes.valid);
        if (serverValid && statusRes.expiresAt && stored.expiresAt !== statusRes.expiresAt) {
          stored.expiresAt = statusRes.expiresAt;
          await chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: stored });
        }
      } catch (_error) {
        // Keep local state if status endpoint is temporarily unreachable.
        serverValid = valid;
      }
    }

    if (licenseExpiryValue) {
      licenseExpiryValue.innerText = serverValid && stored ? formatExpiry(stored.expiresAt) : "Not active";
    }
    if (serverValid && stored && stored.expiresAt) {
      startLicenseCountdown(stored.expiresAt);
    } else {
      clearLicenseCountdown();
    }
    if ((!serverValid || !valid) && stored && parseExpiryMs(stored.expiresAt) <= Date.now()) {
      await chrome.storage.local.remove(LICENSE_STORAGE_KEY);
    }
    return { valid: serverValid, license: serverValid ? stored : null };
  }

  function updateRequestButtonState() {
    chrome.storage.local.get(["lastRequestTime"], (result) => {
      const lastRequestTime = result.lastRequestTime || 0;
      const cooldownMs = 30000; // 30 seconds
      const elapsed = Date.now() - lastRequestTime;
      const requestBtn = document.getElementById("zrr-license-request-btn");
      if (!requestBtn) return;

      if (elapsed >= 0 && elapsed < cooldownMs) {
        requestBtn.disabled = true;
        const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
        requestBtn.innerText = `Wait ${remaining}s...`;
        setTimeout(updateRequestButtonState, 1000);
      } else {
        requestBtn.disabled = false;
        requestBtn.innerText = "Request from Admin";
      }
    });
  }

  async function requestLicenseCode() {
    const email = normalizeEmail((licenseEmailInput && licenseEmailInput.value) || document.getElementById("zrr-email").value);
    if (!email) {
      setLicenseStatus("Add your email first.", true);
      return;
    }

    const now = Date.now();
    const storedState = await chrome.storage.local.get(["lastRequestTime"]);
    const lastRequestTime = storedState.lastRequestTime || 0;
    const cooldownMs = 30000;
    if (now - lastRequestTime < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - (now - lastRequestTime)) / 1000);
      setLicenseStatus(`Please wait ${remainingSeconds}s before requesting again.`, true);
      return;
    }

    const requestBtn = document.getElementById("zrr-license-request-btn");
    if (requestBtn) {
      requestBtn.disabled = true;
      requestBtn.innerText = "Requesting...";
    }
    setLicenseStatus("Sending your licence request to the administrator...", false);

    try {
      const deviceId = await getDeviceId();
      const res = await api({ action: "license_request", email, deviceId });
      await chrome.storage.local.set({ lastRequestTime: Date.now() });

      if (!res || !res.success) {
        setLicenseStatus((res && (res.msg || res.error)) || "Could not request code.", true);
        return;
      }
      if (res.alreadyActive && res.expiresAt) {
        await chrome.storage.local.set({
          [LICENSE_STORAGE_KEY]: {
            email,
            deviceId,
            activatedAt: res.activatedAt || null,
            expiresAt: res.expiresAt
          }
        });
        setLicenseStatus("License already active on this installation.", false);
        await checkAuth();
        return;
      }
      if (licenseExpiryValue) {
        licenseExpiryValue.innerText = formatExpiry(res.expiresAt);
      }
      startLicenseCountdown(res.expiresAt);

      const requestLabel = res.requestId ? `Request #${res.requestId}` : "Request";
      const duplicateNote = res.duplicate
        ? `${requestLabel} is already pending.`
        : `${requestLabel} was sent to the administrator.`;
      setLicenseStatus(`${duplicateNote} The licence code will be emailed to this address after it is issued.`, false);
    } catch (error) {
      await chrome.storage.local.set({ lastRequestTime: Date.now() });
      setLicenseStatus("License request failed. Try again.", true);
    } finally {
      updateRequestButtonState();
    }
  }

  function openDailyLicenseCheckout() {
    window.open("https://zenroulette.com/zenroulette-assistant-daily/", "_blank");
  }

  async function activateLicenseCode() {
    const email = normalizeEmail((licenseEmailInput && licenseEmailInput.value) || document.getElementById("zrr-email").value);
    const code = String((licenseCodeInput && licenseCodeInput.value) || "").trim().toUpperCase();
    if (!email || !code) {
      setLicenseStatus("Email and long code are required.", true);
      return;
    }

    const activateBtn = document.getElementById("zrr-license-activate-btn");
    if (activateBtn) {
      activateBtn.disabled = true;
      activateBtn.innerText = "Activating...";
    }

    try {
      const deviceId = await getDeviceId();
      const res = await api({ action: "license_activate", email, deviceId, licenseCode: code });
      if (!res || !res.success) {
        setLicenseStatus((res && (res.msg || res.error)) || "Invalid or expired code.", true);
        if (licenseExpiryValue) {
          licenseExpiryValue.innerText = "Not active";
        }
        clearLicenseCountdown();
        return;
      }

      const licenseState = {
        email,
        deviceId,
        activatedAt: res.activatedAt || new Date().toISOString(),
        expiresAt: res.expiresAt || null
      };
      await chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: licenseState });
      if (licenseCodeInput) {
        licenseCodeInput.value = "";
      }

      if (licenseExpiryValue) {
        licenseExpiryValue.innerText = formatExpiry(licenseState.expiresAt);
      }
      startLicenseCountdown(licenseState.expiresAt);
      setLicenseStatus(`License active until ${formatExpiry(licenseState.expiresAt)}.`, false);
      await checkAuth();
      switchTab("dashboard");
    } catch (error) {
      setLicenseStatus("Activation failed. Please retry.", true);
    } finally {
      if (activateBtn) {
        activateBtn.disabled = false;
        activateBtn.innerText = "Activate License";
      }
    }
  }

  async function updateFromStoredDashboardSnapshot() {
    try {
      const stored = await chrome.storage.local.get(["zraLatestDashboard"]);
      const snapshot = stored && stored.zraLatestDashboard;
      if (!snapshot || !Array.isArray(snapshot.recentNumbers) || snapshot.recentNumbers.length < 4) {
        return false;
      }

      if (!snapshot.updatedAt || Date.now() - snapshot.updatedAt > 15000) {
        return false;
      }

      const key = snapshot.recentNumbers.slice(0, 12).join(",");
      if (key === lastStoredDashboardKey) {
        return true;
      }

      lastStoredDashboardKey = key;
      lastLiveNumbers = snapshot.recentNumbers.slice(0, 4);
      updateDashboard({
        recentNumbers: snapshot.recentNumbers,
        favoriteNumbers: Array.isArray(snapshot.favoriteNumbers) ? snapshot.favoriteNumbers : [],
        betFavorites: Array.isArray(snapshot.betFavorites) ? snapshot.betFavorites : [],
        highStakeNumbers: Array.isArray(snapshot.highStakeNumbers) ? snapshot.highStakeNumbers : [],
        dealer: snapshot.dealer || "zra"
      });
      return true;
    } catch (error) {
      console.debug("Stored dashboard snapshot read error", error);
      return false;
    }
  }

  async function scrapeRecentNumbersFromActiveTab() {
    function isLikelyRouletteUrl(url) {
      const lower = String(url || "").toLowerCase();
      if (!lower || lower === "about:blank") {
        return false;
      }

      const hasHostHint =
        lower.includes("vladcazino.ro") ||
        lower.includes("evolution") ||
        lower.includes("evo-games.com") ||
        lower.includes("wirebankers.com") ||
        lower.includes("fortunejack.com") ||
        lower.includes("bc.game");

      const hasGameHint =
        lower.includes("roulette") ||
        lower.includes("table_id=") ||
        lower.includes("playforreal") ||
        lower.includes("/play/") ||
        lower.includes("live-casino") ||
        lower.includes("game/");

      return hasHostHint || hasGameHint;
    }

    let targetTab = null;

    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentActive = currentTabs && currentTabs[0];
    if (currentActive && currentActive.id && isLikelyRouletteUrl(currentActive.url)) {
      targetTab = currentActive;
    }

    if (!targetTab) {
      const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const focusedActive = focusedTabs && focusedTabs[0];
      if (focusedActive && focusedActive.id && isLikelyRouletteUrl(focusedActive.url)) {
        targetTab = focusedActive;
      }
    }

    if (!targetTab) {
      const allTabs = await chrome.tabs.query({});
      const now = Date.now();
      const ranked = allTabs
        .filter((tab) => tab && tab.id && isLikelyRouletteUrl(tab.url))
        .sort((a, b) => {
          const score = (tab) => {
            let s = 0;
            if (tab.active) s += 200;
            if (tab.lastAccessed) {
              const ageMs = Math.max(0, now - tab.lastAccessed);
              s += Math.max(0, 100 - Math.floor(ageMs / 15000));
            }

            const lowerUrl = String(tab.url || "").toLowerCase();
            if (lowerUrl.includes("bucharest-roulette")) s += 80;
            if (lowerUrl.includes("playforreal")) s += 40;
            return s;
          };

          return score(b) - score(a);
        });

      targetTab = ranked[0] || null;
    }

    if (!targetTab || !targetTab.id) {
      return [];
    }

    const injected = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id, allFrames: true },
      func: async () => {
        function getScrapedDealerName() {
          const selectors = [
            "[data-testid*='dealer-name']",
            "[data-role*='dealer-name']",
            "[class*='dealerName']",
            "[class*='dealer-name']",
            "[class*='croupier-name']",
            "[class*='croupierName']",
            "[class*='dealer-'] span",
            "[class*='croupier-'] span"
          ];
          
          for (let i = 0; i < selectors.length; i++) {
            const nodes = querySelectorAllDeep(selectors[i]);
            for (let j = 0; j < nodes.length; j++) {
              const txt = (nodes[j].textContent || "").trim();
              if (txt && txt.length > 2 && txt.length < 24 && !/wait|spin|round|cover|zen|loss|win|jp|cazino|vlada|roulette|game|play|dealer|croupier|table/i.test(txt)) {
                return txt.replace(/^(?:dealer|croupier)\s*:\s*/i, "").trim();
              }
            }
          }

          const nodes = getAllElementsDeep();
          for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            const identity = getElementIdentity(el);
            if (identity.includes("croupiername") || identity.includes("dealername") || (identity.includes("dealer") && identity.includes("name"))) {
              const txt = (el.textContent || "").trim();
              if (txt && txt.length > 2 && txt.length < 24 && !/wait|spin|round|cover|zen|loss|win|jp|cazino|vlada|roulette|game|play|dealer|croupier|table/i.test(txt)) {
                return txt.replace(/^(?:dealer|croupier)\s*:\s*/i, "").trim();
              }
            }
          }

          return "zra";
        }

        function normalizeToken(token) {
          if (!token) return null;
          const trimmed = String(token).trim();
          if (!/^(0|[1-9][0-9]?)$/.test(trimmed)) return null;
          const n = parseInt(trimmed, 10);
          if (n < 0 || n > 36) return null;
          return String(n);
        }

        function extractNumbers(text) {
          if (!text) return [];
          let source = String(text).replace(/([0-9])[\u2009\u202f]([0-9])/g, "$1$2");
          source = source.replace(/\b\d+(?:[.:-]\d+){1,}\b/g, " ");
          const cleaned = source
            // Keep number when multiplier/label markers are attached.
            .replace(/\b(?:x|ori)\s*(\d{1,2})\b/gi, "$1 ")
            .replace(/\b(\d{1,2})\s*(?:x|ori)\b/gi, "$1 ");
          const matches = cleaned.match(/(?:^|\D)(0|[1-9][0-9]?)(?=\D|$)/g) || [];
          const out = [];
          for (let i = 0; i < matches.length; i++) {
            const token = matches[i].replace(/\D/g, "");
            const normalized = normalizeToken(token);
            if (normalized !== null) out.push(normalized);
          }
          return out;
        }

        function uniquePreserveOrder(values, limit) {
          const seen = new Set();
          const out = [];
          for (let i = 0; i < values.length; i++) {
            const v = values[i];
            if (!seen.has(v)) {
              seen.add(v);
              out.push(v);
              if (limit && out.length >= limit) break;
            }
          }
          return out;
        }

        function getClassText(el) {
          if (!el || !el.className) return "";
          if (typeof el.className === "string") return el.className;
          if (el.className && typeof el.className.baseVal === "string") return el.className.baseVal;
          return String(el.className || "");
        }

        function getElementIdentity(el) {
          if (!el || typeof el.getAttribute !== "function") return "";
          return [
            getClassText(el),
            el.id || "",
            el.getAttribute("aria-label") || "",
            el.getAttribute("data-testid") || "",
            el.getAttribute("data-role") || "",
            el.getAttribute("data-name") || ""
          ].join(" ").toLowerCase();
        }

        function getSearchRoots() {
          const roots = [document];
          const seen = new Set(roots);

          for (let i = 0; i < roots.length; i++) {
            let nodes = [];
            try {
              nodes = roots[i].querySelectorAll ? roots[i].querySelectorAll("*") : [];
            } catch (_error) {
              nodes = [];
            }

            for (let j = 0; j < nodes.length; j++) {
              const shadow = nodes[j].shadowRoot;
              if (shadow && !seen.has(shadow)) {
                seen.add(shadow);
                roots.push(shadow);
              }
            }
          }

          return roots;
        }

        function querySelectorAllDeep(selector) {
          const out = [];
          getSearchRoots().forEach((root) => {
            try {
              root.querySelectorAll(selector).forEach((node) => out.push(node));
            } catch (_error) {
              // Ignore unsupported selectors in a particular root.
            }
          });
          return out;
        }

        function getAllElementsDeep() {
          const out = [];
          getSearchRoots().forEach((root) => {
            try {
              root.querySelectorAll("*").forEach((node) => out.push(node));
            } catch (_error) {
              // Ignore inaccessible roots.
            }
          });
          return out;
        }

        function readVisibleNumberRows() {
          const nodes = getAllElementsDeep();
          const items = [];
          const seen = new Set();

          function readSingleNumber(el) {
            const fields = [
              el.textContent,
              el.getAttribute("aria-label"),
              el.getAttribute("title"),
              el.getAttribute("alt"),
              el.getAttribute("data-number"),
              el.getAttribute("data-value"),
              el.getAttribute("data-cell"),
              el.getAttribute("data-bet-spot-id"),
              el.getAttribute("data-testid"),
              el.getAttribute("data-role")
            ];

            for (let i = 0; i < fields.length; i++) {
              const raw = (fields[i] || "").replace(/\s+/g, "");
              const parsed = extractNumbers(raw);
              if (parsed.length === 1) {
                return parsed[0];
              }
            }

            return null;
          }

          function isMostlyLinearSequence(values) {
            if (!Array.isArray(values) || values.length < 8) {
              return false;
            }

            const nums = values.map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value));
            let linearDiffs = 0;
            for (let i = 1; i < nums.length; i++) {
              const diff = nums[i] - nums[i - 1];
              if (diff === 1 || diff === 3) {
                linearDiffs++;
              }
            }

            return linearDiffs >= nums.length - 2;
          }

          for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            const value = readSingleNumber(el);
            if (value === null) {
              continue;
            }

            const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
            if (!rect || rect.width < 1 || rect.height < 1 || rect.width > 80 || rect.height > 60) {
              continue;
            }
            if (rect.top < 0 || rect.left < 0 || rect.top > window.innerHeight * 0.8) {
              continue;
            }

            const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
            if (style && (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)) {
              continue;
            }

            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const key = `${value}:${Math.round(cx / 4)}:${Math.round(cy / 4)}`;
            if (seen.has(key)) {
              continue;
            }
            seen.add(key);

            items.push({
              value,
              x: cx,
              y: cy,
              classId: getElementIdentity(el)
            });
          }

          const rows = [];
          items.sort((a, b) => a.y - b.y || a.x - b.x).forEach((item) => {
            let row = rows.find((candidate) => Math.abs(candidate.y - item.y) < 12);
            if (!row) {
              row = { y: item.y, items: [] };
              rows.push(row);
            }
            row.items.push(item);
            row.y = row.items.reduce((sum, entry) => sum + entry.y, 0) / row.items.length;
          });

          let best = null;
          let bestScore = -Infinity;

          rows.forEach((row) => {
            const sorted = row.items.slice().sort((a, b) => a.x - b.x);
            const values = sorted.map((item) => item.value);
            if (values.length < 4 || values.length > 24) {
              return;
            }

            const spanWidth = sorted[sorted.length - 1].x - sorted[0].x;
            let score = values.length * 5;
            if (values.length >= 6 && values.length <= 20) score += 50;
            if (row.y < window.innerHeight * 0.38) score += 60;
            if (spanWidth > 80 && spanWidth < 560) score += 20;
            if (sorted.some((item) => /history|recent|result|outcome|statistics/.test(item.classId))) score += 45;
            if (isMostlyLinearSequence(values)) score -= 90;

            if (score > bestScore) {
              bestScore = score;
              best = values;
            }
          });

          return best || [];
        }

        function readBodyTextRuns() {
          const body = document.body || document.documentElement;
          const source = body ? (body.innerText || body.textContent || "") : "";
          if (!source) return [];

          function isMostlyLinearSequence(values) {
            if (!Array.isArray(values) || values.length < 8) {
              return false;
            }

            const nums = values.map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value));
            let linearDiffs = 0;
            for (let i = 1; i < nums.length; i++) {
              const diff = nums[i] - nums[i - 1];
              if (diff === 1 || diff === 3) {
                linearDiffs++;
              }
            }

            return linearDiffs >= nums.length - 2;
          }

          function pushCandidate(candidates, values, index) {
            const recent = values.slice(0, 24);
            if (recent.length < 4 || recent.length > 24) return;
            if (isMostlyLinearSequence(recent)) return;

            let score = recent.length * 8;
            if (recent.length >= 6 && recent.length <= 18) score += 70;
            if (index < 40) score += 35;
            candidates.push({ values: recent, score });
          }

          const lines = source
            .split(/\n+/)
            .map((line) => line.replace(/\s+/g, " ").trim())
            .filter(Boolean);

          const candidates = [];
          let run = [];
          let runStart = 0;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const upper = line.toUpperCase();
            const hasLetters = /[A-ZÀ-ž]/i.test(line);
            const hasLayoutWords = /ZERO|ORPHELINS|TIER|VOISINS|EVEN|ODD|TO|ST|ND|RD|RON|MIZA|MIZĂ|PARI|SOLD|LIMIT|PLAT/.test(upper);
            const numbers = extractNumbers(line);

            if (/^0\s+1\s+2\s+3\s+4\s+5\s+6\s+7\s+8\s+9\s+10/.test(line)) {
              break;
            }

            if (numbers.length === 1 && !hasLetters) {
              if (run.length === 0) runStart = i;
              run.push(numbers[0]);
              continue;
            }

            if (run.length >= 4) {
              pushCandidate(candidates, run, runStart);
            }
            run = [];

            if (numbers.length >= 4 && numbers.length <= 24 && !hasLayoutWords) {
              pushCandidate(candidates, numbers, i);
            }
          }

          if (run.length >= 4) {
            pushCandidate(candidates, run, runStart);
          }

          candidates.sort((a, b) => b.score - a.score);
          return candidates[0] ? candidates[0].values : [];
        }

        const selectors = [
          ".recent-numbers .number-cell span",
          "[data-role='recent-number']",
          "[data-role='recent-number'] span",
          ".recent-numbers-list span",
          ".roulette-history span",
          "[class*='history'] [class*='number']",
          "[class*='recent'] [class*='number']",
          "[class*='result'] [class*='number']",
          "[data-testid*='history'] span",
          "[data-testid*='result'] span"
        ];

        for (let i = 0; i < selectors.length; i++) {
          const nodes = querySelectorAllDeep(selectors[i]);
          if (!nodes || nodes.length === 0) continue;
          const nums = [];
          nodes.forEach((node) => {
            const parsed = extractNumbers(node.textContent);
            for (let j = 0; j < parsed.length; j++) nums.push(parsed[j]);
          });
          const recent = nums.slice(0, 20);
          if (recent.length >= 4) return recent;
        }

        const bodyTextRuns = readBodyTextRuns();
        if (bodyTextRuns.length >= 4) {
          return bodyTextRuns;
        }

        const visibleRows = readVisibleNumberRows();
        if (visibleRows.length >= 4) {
          return visibleRows;
        }

        const dense = querySelectorAllDeep("div, span, p, li, td, button, text, g");
        let best = [];
        let bestScore = -1;

        for (let i = 0; i < dense.length; i++) {
          const el = dense[i];
          if (!el || !el.textContent) continue;
          if (el.children && el.children.length > 40) continue;

          const raw = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (raw.length < 7 || raw.length > 150) continue;

          const parsed = extractNumbers(raw);
          if (parsed.length < 4 || parsed.length > 20) continue;

          const uniqueCount = new Set(parsed).size;
          if (uniqueCount < 4) continue;

          const classId = getElementIdentity(el);
          const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;

          let score = parsed.length;
          if (classId.includes("history") || classId.includes("recent") || classId.includes("result") || classId.includes("outcome") || classId.includes("winning")) score += 120;
          if (rect && rect.top >= 0 && rect.top < (window.innerHeight * 0.6)) score += 18;
          if (rect && rect.width > 200 && rect.height < 100) score += 15;

          if (score > bestScore) {
            bestScore = score;
            best = parsed.slice(0, 20);
          }
        }

        return {
          recentNumbers: best || [],
          dealerName: getScrapedDealerName()
        };
      }
    });

    const all = (injected || [])
      .map((entry) => entry.result && Array.isArray(entry.result.recentNumbers) ? entry.result : null)
      .filter(Boolean)
      .sort((a, b) => b.recentNumbers.length - a.recentNumbers.length);

    return all[0] || { recentNumbers: [], dealerName: "zra" };
  }

  async function findRouletteTabForPanel() {
    function isLikelyRouletteUrl(url) {
      const lower = String(url || "").toLowerCase();
      if (!lower || lower === "about:blank") {
        return false;
      }

      const hasHostHint =
        lower.includes("vladcazino.ro") ||
        lower.includes("evolution") ||
        lower.includes("evo-games.com") ||
        lower.includes("wirebankers.com") ||
        lower.includes("fortunejack.com") ||
        lower.includes("bc.game");

      const hasGameHint =
        lower.includes("roulette") ||
        lower.includes("table_id=") ||
        lower.includes("playforreal") ||
        lower.includes("/play/") ||
        lower.includes("live-casino") ||
        lower.includes("game/");

      return hasHostHint || hasGameHint;
    }

    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentActive = currentTabs && currentTabs[0];
    if (currentActive && currentActive.id && isLikelyRouletteUrl(currentActive.url)) {
      return currentActive;
    }

    const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const focusedActive = focusedTabs && focusedTabs[0];
    if (focusedActive && focusedActive.id && isLikelyRouletteUrl(focusedActive.url)) {
      return focusedActive;
    }

    const allTabs = await chrome.tabs.query({});
    const now = Date.now();
    const ranked = allTabs
      .filter((tab) => tab && tab.id && isLikelyRouletteUrl(tab.url))
      .sort((a, b) => {
        const score = (tab) => {
          let s = 0;
          if (tab.active) s += 200;
          if (tab.lastAccessed) {
            const ageMs = Math.max(0, now - tab.lastAccessed);
            s += Math.max(0, 100 - Math.floor(ageMs / 15000));
          }
          const lowerUrl = String(tab.url || "").toLowerCase();
          if (lowerUrl.includes("auto-lightning-roulette")) s += 90;
          if (lowerUrl.includes("bucharest-roulette")) s += 80;
          if (lowerUrl.includes("playforreal")) s += 40;
          return s;
        };
        return score(b) - score(a);
      });

    return ranked[0] || null;
  }

  async function scrapeExtendedHistoryFromActiveTab() {
    const targetTab = await findRouletteTabForPanel();
    if (!targetTab || !targetTab.id) {
      return { numbers: [], source: "no-tab", frames: [] };
    }

    const injected = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id, allFrames: true },
      func: async () => {
        function normalizeToken(token) {
          if (!token) return null;
          const trimmed = String(token).trim();
          if (!/^(0|[1-9][0-9]?)$/.test(trimmed)) return null;
          const n = parseInt(trimmed, 10);
          if (n < 0 || n > 36) return null;
          return String(n);
        }

        function extractNumbers(text) {
          if (!text) return [];
          const source = String(text).replace(/([0-9])[\u2009\u202f]([0-9])/g, "$1$2");
          const withoutVersions = source.replace(/\b\d+(?:[.:-]\d+){1,}\b/g, " ");
          const cleaned = withoutVersions.replace(/x\d+|\d+x/gi, " ");
          const matches = cleaned.match(/(?:^|\D)(0|[1-9][0-9]?)(?=\D|$)/g) || [];
          const out = [];
          for (let i = 0; i < matches.length; i++) {
            const token = matches[i].replace(/\D/g, "");
            const normalized = normalizeToken(token);
            if (normalized !== null) {
              out.push(normalized);
            }
          }
          return out;
        }

        function getSearchRoots() {
          const roots = [document];
          const seen = new Set(roots);
          for (let i = 0; i < roots.length; i++) {
            let nodes = [];
            try {
              nodes = roots[i].querySelectorAll ? roots[i].querySelectorAll("*") : [];
            } catch (_error) {
              nodes = [];
            }
            for (let j = 0; j < nodes.length; j++) {
              const shadow = nodes[j].shadowRoot;
              if (shadow && !seen.has(shadow)) {
                seen.add(shadow);
                roots.push(shadow);
              }
            }
          }
          return roots;
        }

        function querySelectorAllDeep(selector) {
          const out = [];
          getSearchRoots().forEach((root) => {
            try {
              root.querySelectorAll(selector).forEach((node) => out.push(node));
            } catch (_error) {
              // Ignore unsupported selectors in a root.
            }
          });
          return out;
        }

        function readNodeNumber(el) {
          if (!el || typeof el.getAttribute !== "function") {
            return null;
          }
          const fields = [
            el.getAttribute("data-number"),
            el.getAttribute("data-value"),
            el.getAttribute("data-result"),
            el.getAttribute("aria-label"),
            el.getAttribute("title"),
            el.textContent
          ];
          for (let i = 0; i < fields.length; i++) {
            const parsed = extractNumbers(fields[i]);
            if (parsed.length > 0) {
              return parsed[0];
            }
          }
          return null;
        }

        function collect(selector) {
          return querySelectorAllDeep(selector)
            .map(readNodeNumber)
            .filter((value) => value !== null);
        }

        function collectMany(selector) {
          const out = [];
          querySelectorAllDeep(selector).forEach((node) => {
            [
              node.getAttribute && node.getAttribute("data-number"),
              node.getAttribute && node.getAttribute("data-value"),
              node.getAttribute && node.getAttribute("data-result"),
              node.getAttribute && node.getAttribute("aria-label"),
              node.getAttribute && node.getAttribute("title"),
              node.textContent
            ].forEach((field) => {
              extractNumbers(field).forEach((value) => out.push(value));
            });
          });
          return out;
        }

        function collectNthChild(selectorBase, maxIndex) {
          const out = [];
          for (let i = maxIndex; i > 0; i--) {
            querySelectorAllDeep(`${selectorBase}:nth-child(${i})`).forEach((node) => {
              const value = readNodeNumber(node);
              if (value !== null) {
                out.push(value);
              }
            });
          }
          return out;
        }

        function orientStats(recent, stats) {
          const recentHead = recent.slice(0, 8);
          const firstScore = stats.slice(0, 8).filter((n) => recentHead.includes(n)).length;
          const lastScore = stats.slice(-8).filter((n) => recentHead.includes(n)).length;
          return lastScore > firstScore ? stats.slice().reverse() : stats.slice();
        }

        function trimSharedPrefix(recent, stats) {
          const maxOverlap = Math.min(recent.length, stats.length, 30);
          for (let size = maxOverlap; size > 0; size--) {
            if (recent.slice(0, size).join(",") === stats.slice(0, size).join(",")) {
              return stats.slice(size);
            }
          }
          return stats;
        }

        function removeRepeatedLeadingBlock(values) {
          const list = Array.isArray(values) ? values : [];
          const maxSize = Math.min(30, Math.floor(list.length / 2));
          for (let size = maxSize; size >= 4; size--) {
            if (list.slice(0, size).join(",") === list.slice(size, size * 2).join(",")) {
              return list.slice(size);
            }
          }
          return list;
        }

        function sleep(ms) {
          return new Promise((resolve) => setTimeout(resolve, ms));
        }

        function getElementIdentity(el) {
          if (!el) return "";
          return [
            el.tagName || "",
            el.id || "",
            el.className || "",
            el.getAttribute && el.getAttribute("data-role"),
            el.getAttribute && el.getAttribute("data-testid"),
            el.getAttribute && el.getAttribute("aria-label"),
            el.getAttribute && el.getAttribute("title")
          ].filter(Boolean).join(" ").toLowerCase();
        }

        function isMostlyLinearSequence(values) {
          if (!Array.isArray(values) || values.length < 10) {
            return false;
          }
          const nums = values.map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value));
          let linearDiffs = 0;
          for (let i = 1; i < nums.length; i++) {
            const diff = nums[i] - nums[i - 1];
            if (diff === 1 || diff === 3 || diff === -1 || diff === -3) {
              linearDiffs++;
            }
          }
          return linearDiffs >= nums.length - 3;
        }

        function pushHistoryCandidate(candidates, values, source, extraScore) {
          const list = listToPlainNumbers(values).slice(0, 600);
          if (list.length < 4) {
            return;
          }
          const sourceText = String(source || "");
          if (/ksplogger|featurescache|browserversion|fingerprint|sessionid|u_sclid|u_scsid|lastappuri|wheel_order|zenroulettestrategy/i.test(sourceText)) {
            return;
          }
          if (isMostlyLinearSequence(list)) {
            return;
          }
          const uniqueCount = new Set(list).size;
          if (uniqueCount < 4 || uniqueCount > 37) {
            return;
          }
          if ((list.length >= 100 && uniqueCount < 20) || (list.length >= 50 && uniqueCount < 15)) {
            return;
          }
          let score = list.length * 4 + uniqueCount;
          if (list.length >= 50) score += 250;
          if (list.length >= 100) score += 400;
          if (/history|recent|stat|result|outcome|winning|roulette/i.test(sourceText)) score += 120;
          if (/statistics-drawer|ultimele\s*(500|100)/i.test(sourceText)) score += 650;
          if (/recent-plus-statistics/i.test(sourceText)) score -= 220;
          score += extraScore || 0;
          candidates.push({
            source: sourceText || "unknown",
            count: list.length,
            score,
            values: list
          });
        }

        function listToPlainNumbers(values) {
          const out = [];
          (Array.isArray(values) ? values : []).forEach((value) => {
            if (value === undefined || value === null) {
              return;
            }
            const parsed = extractNumbers(String(value));
            if (parsed.length === 1) {
              out.push(parsed[0]);
            } else if (parsed.length > 1) {
              parsed.forEach((entry) => out.push(entry));
            }
          });
          return out;
        }

        function collectBodyTextCandidates(candidates) {
          getSearchRoots().forEach((root, rootIndex) => {
            const body = root.body || root.host || root;
            const source = body ? (body.innerText || body.textContent || "") : "";
            if (!source) {
              return;
            }

            const lines = source
              .split(/\n+/)
              .map((line) => line.replace(/\s+/g, " ").trim())
              .filter(Boolean);
            let run = [];
            let runStart = 0;

            function flushRun(index) {
              if (run.length >= 4) {
                pushHistoryCandidate(candidates, run, `text-run:${rootIndex}:${runStart}-${index}`, 45);
              }
              run = [];
            }

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const upper = line.toUpperCase();
              const hasLetters = /[A-ZÀ-ž]/i.test(line);
              const hasBadWords = /RON|MIZ[AEĂ]|PARI|SOLD|LIMIT|PLAT|DEPUN|BALANCE|FONDURI|CREDIT|CHAT|LOBBY|ZERO ORPHELINS|EVEN|ODD|TO 1|1 ST|2 ND|3 RD/.test(upper);
              const parsed = extractNumbers(line);

              if (/^0\s+1\s+2\s+3\s+4\s+5\s+6\s+7\s+8\s+9\s+10/.test(line)) {
                flushRun(i);
                continue;
              }

              if (parsed.length === 1 && !hasLetters && !hasBadWords) {
                if (run.length === 0) {
                  runStart = i;
                }
                run.push(parsed[0]);
                continue;
              }

              flushRun(i);

              if (parsed.length >= 4 && parsed.length <= 600 && !hasBadWords) {
                pushHistoryCandidate(candidates, parsed, `text-line:${rootIndex}:${i}`, 30);
              }
            }

            flushRun(lines.length);
          });
        }

        function collectContainerCandidates(candidates) {
          const selectors = [
            "[data-role*='history']",
            "[data-role*='recent']",
            "[data-role*='stat']",
            "[data-testid*='history']",
            "[data-testid*='recent']",
            "[data-testid*='stat']",
            "[class*='history']",
            "[class*='recent']",
            "[class*='statistics']",
            "[class*='results']"
          ];
          selectors.forEach((selector) => {
            querySelectorAllDeep(selector).forEach((node) => {
              const text = node && (node.innerText || node.textContent || "");
              if (!text || text.length > 12000) {
                return;
              }
              const upper = text.toUpperCase();
              if ((upper.match(/RON/g) || []).length > 5) {
                return;
              }
              pushHistoryCandidate(candidates, extractNumbers(text), `container:${selector}:${getElementIdentity(node)}`, 80);
            });
          });
        }

        function readHistoryNumberFromObject(item) {
          if (!item || typeof item !== "object") {
            return null;
          }
          const keys = [
            "number",
            "value",
            "result",
            "outcome",
            "winningNumber",
            "winNumber",
            "rolledNumber",
            "roundResult"
          ];
          for (let i = 0; i < keys.length; i++) {
            const value = item[keys[i]];
            const parsed = extractNumbers(value);
            if (parsed.length === 1) {
              return parsed[0];
            }
          }
          return null;
        }

        function scanValueForHistory(value, source, depth, candidates, budget) {
          if (!budget || budget.count > 1800 || depth > 5 || value === null || value === undefined) {
            return;
          }
          budget.count++;

          const valueType = typeof value;
          if (valueType === "string") {
            if (value.length < 24000) {
              pushHistoryCandidate(candidates, extractNumbers(value), source, 15);
            }
            return;
          }
          if (valueType !== "object") {
            return;
          }
          if (value === window || value === document || value.nodeType || value.window === value) {
            return;
          }

          if (Array.isArray(value)) {
            const direct = [];
            const objectValues = [];
            value.slice(0, 700).forEach((item) => {
              if (item === null || item === undefined) {
                return;
              }
              if (typeof item === "object") {
                const entry = readHistoryNumberFromObject(item);
                if (entry !== null) {
                  objectValues.push(entry);
                }
              } else {
                const parsed = extractNumbers(item);
                if (parsed.length === 1) {
                  direct.push(parsed[0]);
                }
              }
            });
            pushHistoryCandidate(candidates, direct, `${source}:array-direct`, 90);
            pushHistoryCandidate(candidates, objectValues, `${source}:array-objects`, 110);
          }

          const keyHint = /history|recent|stat|result|results|outcome|winning|roulette|last|road/i;
          let keys = [];
          try {
            keys = Object.keys(value).slice(0, 180);
          } catch (_error) {
            keys = [];
          }

          keys.forEach((key) => {
            const nextSource = `${source}.${key}`;
            const shouldScan = depth < 2 || keyHint.test(key) || keyHint.test(source);
            if (!shouldScan) {
              return;
            }
            try {
              scanValueForHistory(value[key], nextSource, depth + 1, candidates, budget);
            } catch (_error) {
              // Ignore inaccessible game internals.
            }
          });
        }

        function collectStorageCandidates(candidates) {
          const storageHistoryKey = /history|recent|stat|result|results|outcome|winning|roulette|road|spin|game/i;
          let stores = [];
          try {
            stores = [window.localStorage, window.sessionStorage];
          } catch (_error) {
            stores = [];
          }
          stores.forEach((store, storeIndex) => {
            if (!store) {
              return;
            }
            let length = 0;
            try {
              length = Math.min(store.length, 120);
            } catch (_error) {
              return;
            }
            for (let i = 0; i < length; i++) {
              let key = null;
              let raw = null;
              try {
                key = store.key(i);
                raw = key ? store.getItem(key) : null;
              } catch (_error) {
                continue;
              }
              if (!raw || raw.length > 120000) {
                continue;
              }
              const source = `${storeIndex === 0 ? "localStorage" : "sessionStorage"}:${key}`;
              if (!storageHistoryKey.test(key)) {
                continue;
              }
              pushHistoryCandidate(candidates, extractNumbers(raw), source, 90);
              if (/^[\[{]/.test(raw.trim())) {
                try {
                  scanValueForHistory(JSON.parse(raw), source, 0, candidates, { count: 0 });
                } catch (_error) {
                  // Not JSON.
                }
              }
            }
          });
        }

        function collectWindowCandidates(candidates) {
          const keyHint = /history|recent|stat|result|results|outcome|winning|roulette|evo|game|store|road/i;
          let keys = [];
          try {
            keys = Object.keys(window).filter((key) => keyHint.test(key)).slice(0, 90);
          } catch (_error) {
            keys = [];
          }
          keys.forEach((key) => {
            try {
              scanValueForHistory(window[key], `window.${key}`, 0, candidates, { count: 0 });
            } catch (_error) {
              // Ignore inaccessible global values.
            }
          });
        }

        function clickPossibleStatsPanelButton() {
          const positive = /statist|statistics|history|recent|results|result|last|hot|cold/i;
          const negative = /bet|chip|straight|split|corner|dozen|column|red|black|odd|even|deposit|fund|miz|pariu|double|undo|repeat|spin|sound|volume|fullscreen|chat|lobby|sal[aă]/i;
          const nodes = querySelectorAllDeep("button, [role='button'], [aria-label], [title], [data-role], [data-testid]");
          const candidates = [];
          nodes.forEach((node) => {
            const meta = getElementIdentity(node);
            const text = String(node.innerText || node.textContent || "").toLowerCase();
            const bundle = `${meta} ${text}`;
            if (!positive.test(bundle) || negative.test(bundle)) {
              return;
            }
            const rect = typeof node.getBoundingClientRect === "function" ? node.getBoundingClientRect() : null;
            let score = 10;
            if (/statist|statistics/.test(bundle)) score += 60;
            if (/history|recent|results/.test(bundle)) score += 35;
            if (rect && rect.width > 10 && rect.height > 10) score += 10;
            candidates.push({ node, score, meta: bundle.slice(0, 120) });
          });

          candidates.sort((a, b) => b.score - a.score);
          const best = candidates[0];
          if (!best || !best.node) {
            return "";
          }
          try {
            best.node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
            if (typeof best.node.click === "function") {
              best.node.click();
            }
            return best.meta;
          } catch (_error) {
            return "";
          }
        }

        function chooseBestCandidate(candidates, recent) {
          const recentHead = recent.slice(0, 8);
          candidates.forEach((candidate) => {
            const cleanedValues = removeRepeatedLeadingBlock(candidate.values);
            if (cleanedValues.length !== candidate.values.length) {
              candidate.values = cleanedValues;
              candidate.count = cleanedValues.length;
              candidate.source += ":deduped";
              candidate.score -= 120;
            }
            const firstScore = candidate.values.slice(0, 8).filter((n) => recentHead.includes(n)).length;
            const lastScore = candidate.values.slice(-8).filter((n) => recentHead.includes(n)).length;
            if (lastScore > firstScore) {
              candidate.values = candidate.values.slice().reverse();
              candidate.source += ":reversed";
              candidate.score += 25;
            }
            candidate.recentMatch = Math.max(firstScore, lastScore);
            candidate.score += candidate.recentMatch * 18;
          });
          candidates.sort((a, b) => b.score - a.score || b.count - a.count);
          return candidates[0] || { values: [], source: "none", score: 0 };
        }

        const recentDirect = collect("[data-role='recent-number'], [class*='recent'] [class*='number'], [data-testid*='recent'] span");
        const recentNth = collectNthChild("div[data-role='recent-number']", 40);
        const recent = recentNth.length > recentDirect.length ? recentNth : recentDirect;

        const statsDirect = collect("[data-role='statistics'], div[data-role='statistics'], [class*='statistics'] [class*='number']");
        const statsText = collectMany("[data-role='statistics'], div[data-role='statistics']");
        const statsNth = collectNthChild("div[data-role='statistics']", 600);
        const rawStats = [statsDirect, statsText, statsNth].sort((a, b) => b.length - a.length)[0] || [];
        const stats = trimSharedPrefix(recent, orientStats(recent, rawStats));
        const merged = recent.concat(stats).slice(0, 500);

        const candidates = [];
        pushHistoryCandidate(candidates, recent, "recent-visible", 40);
        pushHistoryCandidate(candidates, merged, "data-role-recent-plus-statistics", 180);
        pushHistoryCandidate(candidates, statsDirect, "statistics-direct", 80);
        pushHistoryCandidate(candidates, statsText, "statistics-text", 90);
        pushHistoryCandidate(candidates, statsNth, "statistics-nth-child", 120);

        const clickedStatsPanel = clickPossibleStatsPanelButton();
        if (clickedStatsPanel) {
          await sleep(650);
          const afterStatsDirect = collect("[data-role='statistics'], div[data-role='statistics'], [class*='statistics'] [class*='number']");
          const afterStatsText = collectMany("[data-role='statistics'], div[data-role='statistics']");
          const afterStatsNth = collectNthChild("div[data-role='statistics']", 600);
          pushHistoryCandidate(candidates, afterStatsDirect, "after-click-statistics-direct", 120);
          pushHistoryCandidate(candidates, afterStatsText, "after-click-statistics-text", 140);
          pushHistoryCandidate(candidates, afterStatsNth, "after-click-statistics-nth-child", 160);
        }

        collectContainerCandidates(candidates);
        collectBodyTextCandidates(candidates);
        collectStorageCandidates(candidates);
        collectWindowCandidates(candidates);

        const best = chooseBestCandidate(candidates, recent);
        const numbers = listToPlainNumbers(best.values).slice(0, 500);
        const topCandidates = candidates.slice(0, 8).map((candidate) => ({
          source: candidate.source,
          count: candidate.count,
          score: candidate.score,
          recentMatch: candidate.recentMatch || 0
        }));

        return {
          href: window.location.href,
          recentCount: recent.length,
          statisticsCount: rawStats.length,
          directStatisticsCount: statsDirect.length,
          textStatisticsCount: statsText.length,
          nthChildStatisticsCount: statsNth.length,
          clickedStatsPanel,
          bestSource: best.source,
          bestScore: best.score,
          topCandidates,
          numbers
        };
      }
    });

    const frames = (injected || [])
      .map((entry) => entry.result)
      .filter((result) => result && Array.isArray(result.numbers))
      .sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0) || b.numbers.length - a.numbers.length);

    const best = frames[0] || { numbers: [] };
    return {
      numbers: listToStrings(best.numbers).slice(0, 500),
      source: best.href || targetTab.url || "roulette-tab",
      frames
    };
  }

  function analyzePatternHistory(numbersNewestFirst) {
    const history = listToStrings(numbersNewestFirst)
      .map((n) => {
        const parsed = parseInt(n, 10);
        return !isNaN(parsed) && parsed >= 0 && parsed <= 36 ? String(parsed) : null;
      })
      .filter((n) => n !== null)
      .slice(0, 500);

    const patterns = {
      ZERO: { name: "Zero Rule", active: 0, hits: 0, winsNext4: 0, evaluatedNext4: 0, winsNext8: 0, evaluatedNext8: 0 },
      REP: { name: "Repeat Pattern", active: 0, hits: 0, winsNext4: 0, evaluatedNext4: 0, winsNext8: 0, evaluatedNext8: 0 },
      CNS: { name: "Consecutive Pattern", active: 0, hits: 0, winsNext4: 0, evaluatedNext4: 0, winsNext8: 0, evaluatedNext8: 0 },
      PREF: { name: "Preference Mapping", active: 0, hits: 0, winsNext4: 0, evaluatedNext4: 0, winsNext8: 0, evaluatedNext8: 0 }
    };
    const rows = [];
    const limit = Math.max(0, history.length - 4);
    const allEnabled = { zero: true, rep: true, cns: true, pref: true };

    function addPattern(row, code, targets, extra) {
      const targetList = uniquePreserveOrder(targets || []);
      const active = targetList.length > 0;
      const hasWindow4 = row.next4.length === 4;
      const hasWindow8 = row.next8.length === 8;
      const hitNext4 = active && hasWindow4 && row.next4.some((n) => targetList.includes(n));
      const hitNext8 = code === "ZERO" && active && hasWindow8 && row.next8.some((n) => targetList.includes(n));
      const hit = hitNext4;
      row.patterns[code] = {
        active,
        hit,
        hitNext4,
        hitNext8,
        targets: targetList,
        extra: extra || {}
      };
      if (active) {
        patterns[code].active += 1;
        if (hasWindow4) {
          patterns[code].evaluatedNext4 += 1;
        }
        if (code === "ZERO" && hasWindow8) {
          patterns[code].evaluatedNext8 += 1;
        }
      }
      if (hitNext4) {
        patterns[code].winsNext4 += 1;
        patterns[code].hits += 1;
      }
      if (hitNext8) {
        patterns[code].winsNext8 += 1;
      }
    }

    for (let outcomeIndex = 0; outcomeIndex < limit; outcomeIndex++) {
      const outcome = history[outcomeIndex];
      const context = history.slice(outcomeIndex + 1);
      if (context.length < 4) {
        continue;
      }

      const row = {
        round: outcomeIndex + 1,
        outcome,
        previousWinner: context[0],
        next4: history.slice(Math.max(0, outcomeIndex - 3), outcomeIndex + 1),
        next8: history.slice(Math.max(0, outcomeIndex - 7), outcomeIndex + 1),
        context: context.slice(0, 12),
        patterns: {}
      };

      const zeroTargets = strategyCore
        ? strategyCore.getZeroRuleJackpotNumbers(context, { enabledPatterns: allEnabled })
        : [];
      addPattern(row, "ZERO", zeroTargets);

      const repeatTargets = strategyCore
        ? strategyCore.getLightningPatternNumbers(context, { enabledPatterns: allEnabled })
        : [];
      addPattern(row, "REP", repeatTargets);

      const cnsState = strategyCore
        ? strategyCore.getLightningConsecutiveNumbers(context, { enabledPatterns: allEnabled })
        : { triggerSet: new Set(), neighborSet: new Set() };
      const cnsTargets = cnsState && cnsState.triggerSet && cnsState.triggerSet.size > 0
        ? getConsecutiveNeighbors(context[0])
        : [];
      addPattern(row, "CNS", cnsTargets, {
        triggers: cnsState && cnsState.triggerSet ? Array.from(cnsState.triggerSet).map(String) : []
      });

      addPattern(row, "PREF", getPreferenceTargetsForHistory(context));
      rows.push(row);
    }

    Object.keys(patterns).forEach((code) => {
      const item = patterns[code];
      item.hitRate = item.active > 0 ? Number(((item.hits / item.active) * 100).toFixed(1)) : 0;
      item.winRateNext4 = item.evaluatedNext4 > 0 ? Number(((item.winsNext4 / item.evaluatedNext4) * 100).toFixed(1)) : 0;
      item.winRateNext8 = item.evaluatedNext8 > 0 ? Number(((item.winsNext8 / item.evaluatedNext8) * 100).toFixed(1)) : 0;
    });

    return {
      generatedAt: new Date().toISOString(),
      numbersScanned: history.length,
      roundsAnalyzed: rows.length,
      newestFirst: history,
      patterns,
      rows
    };
  }

  function renderPatternReport(report) {
    const container = document.getElementById("zrr-pattern-report");
    const status = document.getElementById("zrr-pattern-report-status");
    const saveBtn = document.getElementById("zrr-save-pattern-report");
    if (!container) {
      return;
    }

    if (!report || report.roundsAnalyzed === 0) {
      container.innerHTML = '<div class="msg">Not enough table history found. Keep the live table open and try again after the statistics panel loads.</div>';
      if (status) status.innerText = "No data";
      if (saveBtn) saveBtn.disabled = true;
      return;
    }

    if (status) {
      status.innerText = `${report.numbersScanned} nums / ${report.roundsAnalyzed} rounds`;
    }
    if (saveBtn) {
      saveBtn.disabled = false;
    }

      const patternItems = Object.values(report.patterns);
      const totalAppearances = patternItems.reduce((sum, item) => sum + (item.active || 0), 0);
      const totalWinsNext4 = patternItems.reduce((sum, item) => sum + (item.winsNext4 || 0), 0);
      const totalEvalNext4 = patternItems.reduce((sum, item) => sum + (item.evaluatedNext4 || 0), 0);
      const totalWinsNext8Zero = (report.patterns.ZERO && report.patterns.ZERO.winsNext8) || 0;
      const totalEvalNext8Zero = (report.patterns.ZERO && report.patterns.ZERO.evaluatedNext8) || 0;
      const totalRateNext4 = totalEvalNext4 > 0 ? Number(((totalWinsNext4 / totalEvalNext4) * 100).toFixed(1)) : 0;
      const totalRateNext8Zero = totalEvalNext8Zero > 0 ? Number(((totalWinsNext8Zero / totalEvalNext8Zero) * 100).toFixed(1)) : 0;

      const totalsHtml = `
        <div class="hand-item" style="display:flex; align-items:center; justify-content:space-between; border:1px solid rgba(84,180,53,0.35);">
          <div>
            <div style="font-weight:900; color:var(--accent);">TOTAL · All Patterns</div>
            <div style="font-size:10px; color:var(--muted);">${totalAppearances} appearances · ${totalWinsNext4}/${totalEvalNext4} wins in next 4 (${totalRateNext4}%) · ZERO ${totalWinsNext8Zero}/${totalEvalNext8Zero} wins in next 8 (${totalRateNext8Zero}%)</div>
          </div>
          <div class="hand-result ${totalWinsNext4 > 0 ? "win" : "wait"}">${totalRateNext4}%</div>
        </div>
      `;

      const summaryHtml = Object.keys(report.patterns).map((code) => {
	      const item = report.patterns[code];
        const next4Text = `${item.winsNext4}/${item.evaluatedNext4} wins in next 4 (${item.winRateNext4}%)`;
        const next8Text = code === "ZERO"
          ? `${item.winsNext8}/${item.evaluatedNext8} wins in next 8 (${item.winRateNext8}%)`
          : "";
	      return `
	        <div class="hand-item" style="display:flex; align-items:center; justify-content:space-between;">
	          <div>
	            <div style="font-weight:800; color:var(--text-main);">${escapeHtml(code)} · ${escapeHtml(item.name)}</div>
              <div style="font-size:10px; color:var(--muted);">${item.active} appearances · ${next4Text}${next8Text ? ` · ${next8Text}` : ""}</div>
	          </div>
            <div class="hand-result ${item.winsNext4 > 0 ? "win" : "wait"}">${item.winRateNext4}%</div>
	        </div>
	      `;
	    }).join("");

      container.innerHTML = totalsHtml + summaryHtml;
	  }

  function downloadPatternReport(report) {
    if (!report) {
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonUrl = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    chrome.downloads.download({ url: jsonUrl, filename: `zra-pattern-report-${stamp}.json` }, () => {
      URL.revokeObjectURL(jsonUrl);
    });

    const header = [
      "Round",
      "Outcome",
      "PreviousWinner",
      "Next4",
      "Next8",
      "ZERO Active",
      "ZERO Win Next4",
      "ZERO Win Next8",
      "ZERO Targets",
      "REP Active",
      "REP Win Next4",
      "REP Targets",
      "CNS Active",
      "CNS Win Next4",
      "CNS Targets",
      "PREF Active",
      "PREF Win Next4",
      "PREF Targets",
      "Context"
    ];
    const csvRows = [header].concat(report.rows.map((row) => [
      row.round,
      row.outcome,
      row.previousWinner,
      row.next4.join(" "),
      row.next8.join(" "),
      row.patterns.ZERO.active ? "YES" : "NO",
      row.patterns.ZERO.hitNext4 ? "YES" : "NO",
      row.patterns.ZERO.hitNext8 ? "YES" : "NO",
      row.patterns.ZERO.targets.join(" "),
      row.patterns.REP.active ? "YES" : "NO",
      row.patterns.REP.hitNext4 ? "YES" : "NO",
      row.patterns.REP.targets.join(" "),
      row.patterns.CNS.active ? "YES" : "NO",
      row.patterns.CNS.hitNext4 ? "YES" : "NO",
      row.patterns.CNS.targets.join(" "),
      row.patterns.PREF.active ? "YES" : "NO",
      row.patterns.PREF.hitNext4 ? "YES" : "NO",
      row.patterns.PREF.targets.join(" "),
      row.context.join(" ")
    ]));
    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const csvUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    chrome.downloads.download({ url: csvUrl, filename: `zra-pattern-report-${stamp}.csv` }, () => {
      URL.revokeObjectURL(csvUrl);
    });
  }

  async function scanPatternReport() {
    const scanBtn = document.getElementById("zrr-scan-patterns");
    const status = document.getElementById("zrr-pattern-report-status");
    const reportBox = document.getElementById("zrr-pattern-report");
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.innerText = "Scanning...";
    }
    if (status) {
      status.innerText = "Scanning";
    }
    if (reportBox) {
      reportBox.innerHTML = '<div class="msg">Reading table history and testing patterns...</div>';
    }

    try {
      const scraped = await scrapeExtendedHistoryFromActiveTab();
      lastPatternReport = analyzePatternHistory(scraped.numbers);
      lastPatternReport.source = scraped.source;
      lastPatternReport.frameCounts = (scraped.frames || []).map((frame) => ({
        href: frame.href,
        recentCount: frame.recentCount,
        statisticsCount: frame.statisticsCount,
        directStatisticsCount: frame.directStatisticsCount,
        textStatisticsCount: frame.textStatisticsCount,
        nthChildStatisticsCount: frame.nthChildStatisticsCount,
        clickedStatsPanel: frame.clickedStatsPanel,
        bestSource: frame.bestSource,
        bestScore: frame.bestScore,
        topCandidates: frame.topCandidates,
        total: frame.numbers ? frame.numbers.length : 0
      }));
      renderPatternReport(lastPatternReport);
    } catch (error) {
      lastPatternReport = null;
      if (status) {
        status.innerText = "Error";
      }
      if (reportBox) {
        reportBox.innerHTML = `<div class="msg">Pattern scan failed: ${escapeHtml(error && error.message ? error.message : error)}</div>`;
      }
    } finally {
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerText = "Scan 500 Pattern Report";
      }
    }
  }

  async function pollLiveNumbersFallback() {
    if (!loggedIn) {
      return;
    }

    // If content-script updates are flowing, do not override with fallback snapshots.
    if (Date.now() - lastPrimaryDashboardAt < 3500) {
      return;
    }

    try {
      if (await updateFromStoredDashboardSnapshot()) {
        return;
      }

      const res = await scrapeRecentNumbersFromActiveTab();
      const recent = res.recentNumbers || [];
      const dealer = res.dealerName || "live";
      if (!recent || recent.length < 4) {
        return;
      }

      const next = recent.slice(0, 4);
      if (JSON.stringify(next) === JSON.stringify(lastLiveNumbers)) {
        return;
      }

      lastLiveNumbers = next;
      updateDashboard({
        recentNumbers: next,
        favoriteNumbers: cachedStrategy.favoriteNumbers,
        betFavorites: cachedStrategy.betFavorites,
        highStakeNumbers: cachedStrategy.highStakeNumbers,
        dealer: dealer
      });
    } catch (error) {
      console.debug("Live numbers fallback poll error", error);
    }
  }

  function startLiveNumbersPolling() {
    if (liveNumbersPollTimer) {
      clearInterval(liveNumbersPollTimer);
    }

    pollLiveNumbersFallback();
    liveNumbersPollTimer = setInterval(() => {
      pollLiveNumbersFallback();
    }, 700);
  }

  // Login handler
  async function loginZRA() {
    if (DEV_BYPASS_AUTH) {
      await checkAuth();
      chrome.runtime.sendMessage({ type: "update-dashboard" });
      switchTab("dashboard");
      return;
    }

    const login = document.getElementById("zrr-email").value.trim();
    const password = document.getElementById("zrr-password").value;
    const loginBtn = document.getElementById("zrr-login-btn");
    const errorBox = document.getElementById("zrr-login-error");

    if (!login || !password) {
      errorBox.innerText = "Please enter your username or email and password.";
      return;
    }

    loginBtn.innerText = "Connecting...";
    loginBtn.disabled = true;
    errorBox.innerText = "";

    try {
      const res = await api({ action: "auth", login, password });

      if (res.success) {
        const accountEmail = normalizeEmail(res.email || "");
        await chrome.storage.local.set({ 
          authenticated: true,
          email: accountEmail,
          membership: res.membership || 'member'
        });
        if (licenseEmailInput) {
          licenseEmailInput.value = accountEmail;
        }
        const accessGranted = await checkAuth();
        switchTab(accessGranted ? "dashboard" : "account");
      } else {
        errorBox.innerText = res.msg || "Login failed. Invalid username, email, or password.";
      }
    } catch (e) {
      console.error("Login error:", e);
      errorBox.innerText = "Connection error. Please try again.";
    } finally {
      loginBtn.innerText = "Sign In";
      loginBtn.disabled = false;
    }
  }

  // Logout handler
  async function logoutZRA() {
    if (DEV_BYPASS_AUTH) {
      return;
    }

    await chrome.storage.local.set({ authenticated: false });
    chrome.runtime.sendMessage({ type: "reset-auth" });
    chrome.runtime.sendMessage({ type: "logout" });
    loggedIn = false;
    playData = [];
    allSessions = 0;
    winSessions = 0;
    jackpotSessions = 0;
    waitSessions = 0;
    sessionActive = false;
    if (recordingActive) {
      stopSessionRecording();
    }
    
    // Clear elements
    clearPlayInformation();
    updateSessionStatsUi();
    updateSessionButtons();
    setHeaderState("idle", {
      badge: "Idle",
      helper: "tap start",
      note: "idle"
    });
    document.getElementById("zrr-dealer-name").innerText = "Waiting...";
    document.getElementById("zrr-email").value = "";
    document.getElementById("zrr-password").value = "";

    await checkAuth();
    switchTab("account");
  }

  // Verify auth state and update locks
  async function checkAuth() {
    const state = await chrome.storage.local.get(["authenticated", "email", "membership"]);
    const accountEmail = normalizeEmail(state.email || "");
    const authOk = DEV_BYPASS_AUTH ? true : !!state.authenticated;
    const licenseState = await refreshLicenseUiFromStorage(accountEmail || (licenseEmailInput ? licenseEmailInput.value : ""));
    const hasValidLicense = !!licenseState.valid;
    const accessGranted = DEV_BYPASS_AUTH ? true : (authOk && hasValidLicense);

    if (DEV_BYPASS_AUTH) {
      memberEmail.innerText = accountEmail || "dev@local";
      membershipType.innerText = hasValidLicense ? "Development + 24h License" : "Development Mode";
      loginContainer.style.display = 'none';
      memberContainer.style.display = 'flex';
      if (licenseContainer) licenseContainer.style.display = 'flex';
      if (promoBanner) promoBanner.style.display = 'none';
    } else if (authOk) {
      memberEmail.innerText = state.email || "active@zenroulette.com";
      membershipType.innerText = formatMembershipLabel(state.membership);
      loginContainer.style.display = 'none';
      memberContainer.style.display = 'flex';
      if (licenseContainer) licenseContainer.style.display = 'flex';
      if (promoBanner) promoBanner.style.display = 'none';
    } else {
      loginContainer.style.display = 'flex';
      memberContainer.style.display = 'none';
      if (licenseContainer) licenseContainer.style.display = 'none';
      if (promoBanner) promoBanner.style.display = 'flex';
      syncLicenseEmailFromAuth();
    }

    if (accessGranted) {
      loggedIn = true;
      dashboardLocked.style.display = 'none';
      dashboardUnlocked.style.display = 'flex';
      if (lightningLocked) lightningLocked.style.display = 'none';
      if (lightningUnlocked) lightningUnlocked.style.display = 'flex';
      sessionLocked.style.display = 'none';
      sessionUnlocked.style.display = 'flex';
      if (licenseState.license && licenseState.license.expiresAt) {
        setLicenseStatus(`License active until ${formatExpiry(licenseState.license.expiresAt)}.`, false);
        startLicenseCountdown(licenseState.license.expiresAt);
      }
      startLiveNumbersPolling();
      chrome.runtime.sendMessage({ type: "update-dashboard" });
    } else {
      loggedIn = false;
      sessionActive = false;
      if (liveNumbersPollTimer) {
        clearInterval(liveNumbersPollTimer);
        liveNumbersPollTimer = null;
      }
      chrome.runtime.sendMessage({ type: "logout" });
      dashboardLocked.style.display = 'flex';
      dashboardUnlocked.style.display = 'none';
      if (lightningLocked) lightningLocked.style.display = 'flex';
      if (lightningUnlocked) lightningUnlocked.style.display = 'none';
      sessionLocked.style.display = 'flex';
      sessionUnlocked.style.display = 'none';

      if (!hasValidLicense) {
        setLicenseStatus("License missing or expired. Buy a daily licence or request one from the administrator.", true);
        clearLicenseCountdown();
      }
    }
    updateSessionButtons();
    return accessGranted;
  }

  // Message listener
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'update-dashboard-ui') {
      if (loggedIn) {
        const recent = Array.isArray(msg.recentNumbers) ? msg.recentNumbers : [];
        if (recent.length >= 4) {
          lastPrimaryDashboardAt = Date.now();
          lastStableDashboardAt = Date.now();
        } else if (currentDashboardState.winner && (Date.now() - lastStableDashboardAt < 12000)) {
          return;
        }
        updateDashboard(msg);
      }
    } else if (msg.type === 'logout') {
      logoutZRA();
    }
  });

  // Gemini Assistant Listeners
  // Layout Management Listeners
  const exportLayoutBtn = document.getElementById("zrr-layout-export-btn");
  const importLayoutBtn = document.getElementById("zrr-layout-import-btn");
  const importLayoutFile = document.getElementById("zrr-layout-import-file");
  const resetLayoutBtn = document.getElementById("zrr-layout-reset-btn");

  if (exportLayoutBtn) {
    exportLayoutBtn.addEventListener("click", () => {
      chrome.storage.local.get(["dashboardLayoutOrder", "lightningLayoutOrder"], (res) => {
        const config = {
          dashboardLayoutOrder: res.dashboardLayoutOrder || [],
          lightningLayoutOrder: res.lightningLayoutOrder || []
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "zra_layout_config.json");
        dlAnchorElem.click();
      });
    });
  }

  if (importLayoutBtn && importLayoutFile) {
    importLayoutBtn.addEventListener("click", () => importLayoutFile.click());
    importLayoutFile.addEventListener("change", (e) => {
      const fileReader = new FileReader();
      fileReader.onload = function(event) {
        try {
          const parsed = JSON.parse(event.target.result);
          if (Array.isArray(parsed)) {
            // Backward compatibility
            chrome.storage.local.set({ dashboardLayoutOrder: parsed }, () => {
              alert("Layout configuration imported successfully. Rebuilding...");
              initLayout();
            });
          } else if (parsed && typeof parsed === "object") {
            const updates = {};
            if (parsed.dashboardLayoutOrder) updates.dashboardLayoutOrder = parsed.dashboardLayoutOrder;
            if (parsed.lightningLayoutOrder) updates.lightningLayoutOrder = parsed.lightningLayoutOrder;
            chrome.storage.local.set(updates, () => {
              alert("Layout configuration imported successfully. Rebuilding...");
              initLayout();
            });
          } else {
            alert("Invalid layout file format.");
          }
        } catch (err) {
          alert("Error parsing layout file.");
        }
      };
      if (e.target.files && e.target.files[0]) {
        fileReader.readAsText(e.target.files[0]);
      }
    });
  }

  if (resetLayoutBtn) {
    resetLayoutBtn.addEventListener("click", () => {
      if (confirm("Reset layout to default? This will remove all custom order and cloned cards.")) {
        chrome.storage.local.remove(["dashboardLayoutOrder", "lightningLayoutOrder"], () => {
          location.reload();
        });
      }
    });
  }

  // Attach DOM Listeners
  dashboardTab.addEventListener("click", () => switchTab("dashboard"));
  if (lightningTab) {
    lightningTab.addEventListener("click", () => switchTab("lightning"));
  }
  sessionTab.addEventListener("click", () => switchTab("session"));
  accountTab.addEventListener("click", () => switchTab("account"));

  const mathBudget = document.getElementById("zrr-math-budget");
  const mathProfitPercent = document.getElementById("zrr-math-profit-percent");
  const mathUnit = document.getElementById("zrr-math-unit");
  const mathMinSpins = document.getElementById("zrr-math-min-spins");

  if (mathBudget) {
    mathBudget.addEventListener("input", () => {
      hasUserModifiedBudget = true;
      calculateStrategyMath();
    });
  }
  if (mathProfitPercent) {
    mathProfitPercent.addEventListener("input", calculateStrategyMath);
  }
  if (mathUnit) {
    mathUnit.addEventListener("change", calculateStrategyMath);
  }
  if (mathMinSpins) {
    mathMinSpins.addEventListener("input", calculateStrategyMath);
  }

  const mathBudgetLt = document.getElementById("zrr-math-budget-lt");
  const mathProfitPercentLt = document.getElementById("zrr-math-profit-percent-lt");
  const mathUnitLt = document.getElementById("zrr-math-unit-lt");
  const mathMinSpinsLt = document.getElementById("zrr-math-min-spins-lt");
  const mathMultiplierLt = document.getElementById("zrr-math-multiplier-lt");

  if (mathBudgetLt) {
    mathBudgetLt.addEventListener("input", () => {
      hasUserModifiedBudget = true;
      calculateStrategyMath();
    });
  }
  if (mathProfitPercentLt) {
    mathProfitPercentLt.addEventListener("input", calculateStrategyMath);
  }
  if (mathUnitLt) {
    mathUnitLt.addEventListener("change", calculateStrategyMath);
  }
  if (mathMinSpinsLt) {
    mathMinSpinsLt.addEventListener("input", calculateStrategyMath);
  }
  if (mathMultiplierLt) {
    mathMultiplierLt.addEventListener("change", calculateStrategyMath);
  }

  // Active Patterns Toggles
  const toggleZero = document.getElementById("zrr-toggle-zero");
  const toggleRep = document.getElementById("zrr-toggle-rep");
  const toggleCns = document.getElementById("zrr-toggle-cns");
  const togglePref = document.getElementById("zrr-toggle-pref");

  function syncToggleStates() {
    enabledPatternsLt.zero = toggleZero ? toggleZero.checked : true;
    enabledPatternsLt.rep = toggleRep ? toggleRep.checked : true;
    enabledPatternsLt.cns = toggleCns ? toggleCns.checked : true;
    enabledPatternsLt.pref = togglePref ? togglePref.checked : true;

    // Toggle custom preference mapping settings card visibility
    const customPrefCard = document.getElementById("zrr-custom-pref-card");
    if (customPrefCard) {
      customPrefCard.style.display = enabledPatternsLt.pref ? "flex" : "none";
    }

    chrome.storage.local.set({ enabledPatternsLt });
  }

  window.toggleCardCollapse = function (cardElement) {
    if (!cardElement) return;
    cardElement.classList.toggle("collapsed");
    saveCollapseStates();
  };

  function saveCollapseStates() {
    const strategyCardDealer = document.getElementById("zrr-strategy-card");
    const strategyCard = document.getElementById("zrr-strategy-card-lt");
    const mathCard = document.getElementById("zrr-math-card-lt");
    const settingsCard = document.getElementById("zrr-settings-card-lt");
    const customPrefCard = document.getElementById("zrr-custom-pref-card");

    const states = {
      strategyDealer: strategyCardDealer ? strategyCardDealer.classList.contains("collapsed") : false,
      strategy: strategyCard ? strategyCard.classList.contains("collapsed") : false,
      math: mathCard ? mathCard.classList.contains("collapsed") : false,
      settings: settingsCard ? settingsCard.classList.contains("collapsed") : false,
      customPref: customPrefCard ? customPrefCard.classList.contains("collapsed") : false
    };
    chrome.storage.local.set({ collapseStates: states });
  }

  function toggleCollapseClass(id, isCollapsed) {
    const el = document.getElementById(id);
    if (el) {
      if (isCollapsed) {
        el.classList.add("collapsed");
      } else {
        el.classList.remove("collapsed");
      }
    }
  }

  function populatePrefDropdownAndInputs() {
    const gridEl = document.getElementById("zrr-pref-grid");
    const displayBadge = document.getElementById("zrr-pref-selected-display");
    const inputs = document.querySelectorAll(".zrr-pref-target-input");
    if (!gridEl || !displayBadge || inputs.length === 0) return;

    let selectedTrigger = "0";

    // Helper to style an input dynamically like a roulette chip
    function updateInputStyle(input, val) {
      if (val !== "") {
        const color = getColorFromNumber(val);
        input.style.borderStyle = "solid";
        input.style.opacity = "1.0";
        if (color === "red") {
          input.style.backgroundColor = "#e0232a";
          input.style.borderColor = "rgba(255, 255, 255, 0.35)";
          input.style.color = "#ffffff";
        } else if (color === "black") {
          input.style.backgroundColor = "#333333";
          input.style.borderColor = "rgba(255, 255, 255, 0.35)";
          input.style.color = "#ffffff";
        } else if (color === "green") {
          input.style.backgroundColor = "#2b741b";
          input.style.borderColor = "rgba(255, 255, 255, 0.35)";
          input.style.color = "#ffffff";
        }
      } else {
        input.style.borderStyle = "dashed";
        input.style.opacity = "0.55";
        input.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
        input.style.borderColor = "rgba(255, 255, 255, 0.25)";
        input.style.color = "var(--text-main)";
      }
    }

    // Re-render target inputs and visual indicators
    function refreshInputs() {
      // 1. Update selection display badge
      displayBadge.textContent = selectedTrigger;
      displayBadge.className = "number-badge " + getColorFromNumber(selectedTrigger);

      // 2. Load target values
      const targets = customPrefMappingLt[selectedTrigger] !== undefined
        ? customPrefMappingLt[selectedTrigger]
        : (defaultPrefMappingLt[selectedTrigger] || []);
      inputs.forEach((input, index) => {
        const val = targets[index] !== undefined ? targets[index] : "";
        input.value = val;
        updateInputStyle(input, val);
      });
    }

    // Populate the 37 grid items
    gridEl.innerHTML = "";
    for (let i = 0; i <= 36; i++) {
      const numStr = String(i);
      const circle = document.createElement("div");
      circle.className = "pref-grid-item number-badge " + getColorFromNumber(numStr);
      circle.textContent = numStr;
      circle.dataset.number = numStr;
      
      if (numStr === selectedTrigger) {
        circle.classList.add("selected");
      }

      circle.addEventListener("click", () => {
        // Deselect previous
        const prevSelected = gridEl.querySelector(".pref-grid-item.selected");
        if (prevSelected) {
          prevSelected.classList.remove("selected");
        }
        // Select current
        circle.classList.add("selected");
        selectedTrigger = numStr;
        refreshInputs();
      });

      gridEl.appendChild(circle);
    }

    // Initial population of inputs
    refreshInputs();

    // Listen for inputs changes
    inputs.forEach((input) => {
      input.addEventListener("input", () => {
        let val = input.value.trim();
        if (val !== "") {
          const num = parseInt(val, 10);
          if (isNaN(num) || num < 0 || num > 36) {
            input.value = "";
            val = "";
          } else {
            input.value = String(num);
            val = String(num);
          }
        }

        // Style this target input dynamically
        updateInputStyle(input, val);

        // Collect targets
        const currentTargets = [];
        inputs.forEach((inp) => {
          const v = inp.value.trim();
          if (v !== "") {
            currentTargets.push(v);
          }
        });

        if (currentTargets.length > 0) {
          customPrefMappingLt[selectedTrigger] = currentTargets;
        } else {
          delete customPrefMappingLt[selectedTrigger];
        }

        chrome.storage.local.set({ customPrefMappingLt: customPrefMappingLt }, () => {
          if (cachedRecentNumbers && cachedRecentNumbers.length > 0) {
            updateDashboard({
              recentNumbers: cachedRecentNumbers,
              favoriteNumbers: cachedStrategy.favoriteNumbers,
              betFavorites: cachedStrategy.betFavorites,
              highStakeNumbers: cachedStrategy.highStakeNumbers,
              dealer: document.getElementById("zrr-dealer-name") ? document.getElementById("zrr-dealer-name").innerText : "live"
            });
          }
        });
      });
    });
  }

  function handleToggleChange() {
    syncToggleStates();
    if (cachedRecentNumbers && cachedRecentNumbers.length > 0) {
      updateDashboard({
        recentNumbers: cachedRecentNumbers,
        favoriteNumbers: cachedStrategy.favoriteNumbers,
        betFavorites: cachedStrategy.betFavorites,
        highStakeNumbers: cachedStrategy.highStakeNumbers,
        dealer: document.getElementById("zrr-dealer-name") ? document.getElementById("zrr-dealer-name").innerText : "live"
      });
    }
  }

  if (toggleZero) toggleZero.addEventListener("change", handleToggleChange);
  if (toggleRep) toggleRep.addEventListener("change", handleToggleChange);
  if (toggleCns) toggleCns.addEventListener("change", handleToggleChange);
  if (togglePref) togglePref.addEventListener("change", handleToggleChange);

  // Import/Export Custom Preference Mapping Configuration
  const exportBtn = document.getElementById("zrr-pref-export-btn");
  const importBtn = document.getElementById("zrr-pref-import-btn");
  const importFileInput = document.getElementById("zrr-pref-import-file");

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      chrome.storage.local.get(["customPrefMappingLt", "enabledPatternsLt"], (res) => {
        const configData = {
          version: "2.0",
          exportedAt: new Date().toISOString(),
          customPrefMappingLt: res.customPrefMappingLt || {},
          enabledPatternsLt: res.enabledPatternsLt || {}
        };
        const blob = new Blob([JSON.stringify(configData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `zra_config_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    });
  }

  if (importBtn && importFileInput) {
    importBtn.addEventListener("click", () => {
      importFileInput.click();
    });

    importFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (evt) {
        try {
          const config = JSON.parse(evt.target.result);
          if (!config || typeof config !== "object") {
            alert("Error: Invalid configuration file structure.");
            return;
          }

          // Restore preference mapping
          if (config.customPrefMappingLt && typeof config.customPrefMappingLt === "object") {
            const cleanMap = {};
            Object.keys(config.customPrefMappingLt).forEach((key) => {
              const trigger = parseInt(key, 10);
              if (!isNaN(trigger) && trigger >= 0 && trigger <= 36) {
                const targets = config.customPrefMappingLt[key];
                if (Array.isArray(targets)) {
                  const cleanTargets = targets
                    .map((t) => String(t).trim())
                    .filter((t) => {
                      const val = parseInt(t, 10);
                      return !isNaN(val) && val >= 0 && val <= 36;
                    });
                  if (cleanTargets.length > 0) {
                    cleanMap[String(trigger)] = cleanTargets;
                  }
                }
              }
            });

            customPrefMappingLt = cleanMap;
          }

          // Restore pattern toggle settings if present
          if (config.enabledPatternsLt && typeof config.enabledPatternsLt === "object") {
            enabledPatternsLt = Object.assign(enabledPatternsLt, config.enabledPatternsLt);
          }

          // Save to storage
          chrome.storage.local.set({
            customPrefMappingLt: customPrefMappingLt,
            enabledPatternsLt: enabledPatternsLt
          }, () => {
            // Refresh toggle switches in UI
            if (toggleZero) toggleZero.checked = !!enabledPatternsLt.zero;
            if (toggleRep) toggleRep.checked = !!enabledPatternsLt.rep;
            if (toggleCns) toggleCns.checked = !!enabledPatternsLt.cns;
            if (togglePref) togglePref.checked = !!enabledPatternsLt.pref;

            const customPrefCard = document.getElementById("zrr-custom-pref-card");
            if (customPrefCard) {
              customPrefCard.style.display = enabledPatternsLt.pref ? "flex" : "none";
            }

            // Refresh input chips
            populatePrefDropdownAndInputs();

            // Refresh strategy recommendations
            if (cachedRecentNumbers && cachedRecentNumbers.length > 0) {
              updateDashboard({
                recentNumbers: cachedRecentNumbers,
                favoriteNumbers: cachedStrategy.favoriteNumbers,
                betFavorites: cachedStrategy.betFavorites,
                highStakeNumbers: cachedStrategy.highStakeNumbers,
                dealer: document.getElementById("zrr-dealer-name") ? document.getElementById("zrr-dealer-name").innerText : "live"
              });
            }

            alert("Configuration imported successfully!");
          });
        } catch (err) {
          alert("Error: Failed to parse configuration JSON file.");
        }
        // Reset file input value so same file can be uploaded again
        importFileInput.value = "";
      };
      reader.readAsText(file);
    });
  }

  document.querySelectorAll(".go-to-login-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab("account"));
  });

  document.getElementById("zrr-login-btn").addEventListener("click", loginZRA);
  document.getElementById("zrr-logout-btn").addEventListener("click", logoutZRA);
  if (licenseEmailInput) {
    licenseEmailInput.addEventListener("input", () => {
      const normalized = normalizeEmail(licenseEmailInput.value);
      if (normalized !== licenseEmailInput.value) {
        licenseEmailInput.value = normalized;
      }
    });
  }
  if (licenseCodeInput) {
    licenseCodeInput.addEventListener("input", () => {
      licenseCodeInput.value = String(licenseCodeInput.value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    });
  }
  const buyLicenseBtn = document.getElementById("zrr-license-buy-btn");
  const requestLicenseBtn = document.getElementById("zrr-license-request-btn");
  const activateLicenseBtn = document.getElementById("zrr-license-activate-btn");
  if (buyLicenseBtn) {
    buyLicenseBtn.addEventListener("click", openDailyLicenseCheckout);
  }
  if (requestLicenseBtn) {
    requestLicenseBtn.addEventListener("click", requestLicenseCode);
  }
  if (activateLicenseBtn) {
    activateLicenseBtn.addEventListener("click", activateLicenseCode);
  }
  document.getElementById("zrr-signup-btn").addEventListener("click", (e) => {
    e.preventDefault();
    window.open('https://zenroulette.com/register/');
  });
  const promoRegBtn = document.getElementById("zrr-promo-register-btn");
  if (promoRegBtn) {
    promoRegBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.open('https://zenroulette.com/register/');
    });
  }
  const promoForumBtn = document.getElementById("zrr-promo-forum-btn");
  if (promoForumBtn) {
    promoForumBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.open('https://zenroulette.com/forum/introduce-yourself/#zr-community-board');
    });
  }
  document.getElementById("zrr-save-stats").addEventListener("click", saveStatus);
  document.getElementById("zrr-reset-stats").addEventListener("click", resetStatus);
  document.getElementById("zrr-start-session").addEventListener("click", startSession);
  document.getElementById("zrr-end-session").addEventListener("click", endSession);
  document.getElementById("zrr-record-session").addEventListener("click", toggleSessionRecording);
  const scanPatternsBtn = document.getElementById("zrr-scan-patterns");
  const savePatternReportBtn = document.getElementById("zrr-save-pattern-report");
  if (scanPatternsBtn) {
    scanPatternsBtn.addEventListener("click", scanPatternReport);
  }
  if (savePatternReportBtn) {
    savePatternReportBtn.addEventListener("click", () => downloadPatternReport(lastPatternReport));
  }

  updateSessionButtons();
  updateRequestButtonState();
  updateSessionStatsUi();
  setHeaderState("idle", {
    badge: "Idle",
    helper: "tap start",
    note: "idle"
  });

  // Click to Reconnect event listeners are bound dynamically inside bindModuleEvents



  function applyPreviewDummyData() {
    if (!IS_PREVIEW_MODE) {
      return;
    }

    const demoMessage = {
      recentNumbers: ["13", "13", "12", "0", "30", "10", "8", "18", "7", "9", "27", "21"],
      favoriteNumbers: ["13", "8", "30", "10", "23", "11", "2", "22"],
      betFavorites: ["13", "12", "0", "30"],
      highStakeNumbers: [
        { number: "13", score: 92 },
        { number: "8", score: 86 },
        { number: "30", score: 81 },
        { number: "23", score: 74 }
      ],
      dealer: "Evolution Auto Roulette",
      tableType: "LIGHTNING",
      multiplierHits: 14,
      balance: 1523.45
    };

    updateDashboard(demoMessage);

    allSessions = 28;
    winSessions = 17;
    jackpotSessions = 4;
    waitSessions = 3;
    multiplierHitCount = 14;
    sessionActive = true;
    updateSessionButtons();
    updateSessionStatsUi();

    const playsContainer = document.getElementById("zrr-play-information");
    if (playsContainer) {
      playsContainer.innerHTML = `
        <div class="hand-item"><span class="hand-winner">Prev 30 > Win 13</span><span class="hand-result victory">victory</span></div>
        <div class="hand-item"><span class="hand-winner">Prev 12 > Win 8</span><span class="hand-result win">win</span></div>
        <div class="hand-item"><span class="hand-winner">Prev 0 > Win 21</span><span class="hand-result wait">wait</span></div>
        <div class="hand-item"><span class="hand-winner">Prev 23 > Win 4</span><span class="hand-result loss">loss</span></div>
      `;
    }

    const reportStatus = document.getElementById("zrr-pattern-report-status");
    if (reportStatus) {
      reportStatus.innerText = "Scanned (demo)";
    }

    const savePatternBtn = document.getElementById("zrr-save-pattern-report");
    if (savePatternBtn) {
      savePatternBtn.disabled = false;
    }

    const reportContainer = document.getElementById("zrr-pattern-report");
    if (reportContainer) {
      reportContainer.innerHTML = `
        <div class="hand-item"><span class="hand-winner">ZERO targets 3/26</span><span class="hand-result win">hit</span></div>
        <div class="hand-item"><span class="hand-winner">REP on 13</span><span class="hand-result victory">hot</span></div>
        <div class="hand-item"><span class="hand-winner">CNS 8-9 trigger</span><span class="hand-result gold">active</span></div>
      `;
    }

    if (licenseEmailInput) {
      licenseEmailInput.value = "demo@zenroulette.com";
    }
    if (licenseCodeInput) {
      licenseCodeInput.value = "ZRA24-DEMO-CODE";
    }
    if (licenseExpiryValue) {
      licenseExpiryValue.innerText = "Tomorrow 14:00";
    }
    if (licenseCountdownValue) {
      licenseCountdownValue.innerText = "23:47:12";
    }
    setLicenseStatus("Preview mode: showing dummy data only.", false);

    setHeaderState("victory", {
      badge: "Jackpot",
      helper: "demo mode",
      note: "visual test"
    });
  }

  const dealerPersona = `
You are the ZenRoulette Assistant, an AI persona designed by founder Adrian Aparaschivei that bridges real-time predictive telemetry data with mindfulness and Zen practices.
Roulette is not an enemy to control—it is a space for discipline, rhythm, and self-awareness. You help players eliminate emotional guesswork, panic, and volatility at the table.

Our pricing plans and ecosystem:
1. ZENRoulette Assistant DAILY License: €10.00 as a One-Time payment for a 1-day (24 hours) license. This eliminates emotional guesswork with live spin pattern tracking, 100-spin trend analysis, and automated zone targeting.
2. ZenRoulette 21 Days Challenge Daily: €97.00 for each day, for 21 installments. A blueprint to build absolute master self-discipline.
3. ZenRoulette INNER CIRCLE TRIP: €7,777.00 for Lifetime inner circle access.
4. ZENRoulette TRIBE: Join us for free membership.

The ZenRoulette Protocol:
- Selecting a Zone: Pinpointing high-probability wheel sectors.
- Trigger Play: Executing precise, controlled 4-spin trials.
- Adapting and Focusing: Pausing, interpreting feedback, and refusing to chase losses.
- Strategic Betting: Capitalizing on verified trends with exact sizing.
- Mindset: Find (Observe data patterns cleanly) -> Imagine (Visualize execution calmly) -> Act (Place structured play decisively) -> Detach (Separate peace of mind entirely from the physical outcome of the spin).

Style Guidelines:
- Never sell empty hype or fake mathematical certainties.
- Keep paragraphs tightly broken down into 3-5 lines.
- Use regular ellipses (...) to signal organic transitions in thoughts.
- Naturally layer primary terms like "roulette prediction software" and "mindful roulette strategies".
- Meet frustration with profound empathy and de-escalate emotional tilt.
`;

  const lightningPersona = `
You are the ZenRoulette Lightning Assistant, an AI persona bridging live predictive lightning data with volatility detachment.
Lightning Roulette is a high-speed, high-variance battleground of random multipliers (up to 500x). Multipliers are a gift of the flow, but chasing them blindly brings ruin. Detach from the spikes and follow strict coverage math.

Our pricing plans and ecosystem:
1. ZENRoulette Assistant DAILY License: €10.00 as a One-Time payment for a 1-day (24 hours) license.
2. ZenRoulette 21 Days Challenge Daily: €97.00 for each day, for 21 installments.
3. ZenRoulette INNER CIRCLE TRIP: €7,777.00 for Lifetime inner circle access.
4. ZENRoulette TRIBE: Join us for free membership.

The Lightning Protocol:
- Coverage Sizing: Target standard numbers, golden overlaps, and jackpot hits.
- Survival Spins: Maintain a budget for a minimum of 20 survival spins to weather cold streaks.
- Volatility Detachment: Observe 500x hits calmly without FOMO or greed.
- Mindset: Find (Observe data patterns cleanly) -> Imagine (Visualize execution calmly) -> Act (Place structured play decisively) -> Detach (Separate peace of mind entirely from the physical outcome of the spin).

Style Guidelines:
- Never sell empty hype or fake mathematical certainties.
- Keep paragraphs tightly broken down into 3-5 lines.
- Use regular ellipses (...) to signal organic transitions in thoughts.
- Meet frustration with profound empathy and de-escalate emotional tilt.
`;

  function handleChatSubmission(card, text) {
    const history = card.querySelector(".zrr-gemini-chat-history");
    if (!history) return;

    // Remove standby message
    const standbyMsg = history.querySelector(".system-msg");
    if (standbyMsg) standbyMsg.remove();

    // Append User Bubble
    const userBubble = document.createElement("div");
    userBubble.style.cssText = "align-self: flex-end; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 6px; padding: 6px 8px; max-width: 85%; word-break: break-word; color: var(--text-main); margin-bottom: 4px; border-bottom-right-radius: 1px;";
    userBubble.innerText = text;
    history.appendChild(userBubble);
    history.scrollTop = history.scrollHeight;

    // Append Typing Indicator
    const agentBubble = document.createElement("div");
    agentBubble.className = "agent-typing";
    agentBubble.style.cssText = "align-self: flex-start; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; color: var(--text-secondary); font-style: italic; max-width: 85%; margin-bottom: 4px; border-bottom-left-radius: 1px;";
    agentBubble.innerText = "Zen Assistant is contemplating...";
    history.appendChild(agentBubble);
    history.scrollTop = history.scrollHeight;

    // Prepare context payload
    const recent = currentDashboardState.recentNumbers || [];
    const winner = currentDashboardState.winner;
    const dealerName = currentDashboardState.dealer;
    const mode = currentDashboardState.strategyMode;
    const decision = currentDashboardState.decision;
    const standardNumbers = currentDashboardState.standardNumbers || [];
    const goldenNumbers = currentDashboardState.goldenNumbers || [];
    const jackpotNumbers = currentDashboardState.jackpotNumbers || [];

    const budgetInput = document.querySelector(".zrr-math-budget");
    const targetProfitInput = document.querySelector(".zrr-math-profit-percent");
    const currentBalance = budgetInput ? budgetInput.value : "1000";
    const targetProfit = targetProfitInput ? targetProfitInput.value : "30";

    const payload = {
      winner: winner,
      recentSpins: recent.slice(0, 12),
      dealer: dealerName,
      strategyMode: mode,
      decision: decision,
      standardNumbers: standardNumbers,
      goldenNumbers: goldenNumbers,
      jackpotNumbers: jackpotNumbers,
      currentBalance: currentBalance + " RON",
      targetProfitPercent: targetProfit + "%"
    };

    const sessionStatusContext = sessionActive 
      ? "The user has started an active ZenRoulette logging session." 
      : "CRITICAL: The user has NOT started a ZenRoulette logging session yet. You MUST explicitly mention to the user in your response that they need to start a session to track stats and predictions properly (tell them to click the 'Start Session' button on the Session tab).";

    const isLightning = card.id.includes("-lt");
    const systemInstructionText = isLightning ? lightningPersona : dealerPersona;

    const promptText = `
      User Question: "${text}"

      Live telemetry status context:
      ${JSON.stringify(payload, null, 2)}
      
      Session Status:
      ${sessionStatusContext}

      Provide a helpful, strategic, and calm response to the user's question, incorporating telemetry context if relevant.
    `;

    const appendReply = (reply) => {
      agentBubble.remove();
      const replyBubble = document.createElement("div");
      replyBubble.style.cssText = "align-self: flex-start; background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 6px; padding: 6px 8px; max-width: 85%; word-break: break-word; color: var(--text-main); margin-bottom: 4px; border-top-left-radius: 1px; line-height: 1.45;";
      
      // Typewriter effect
      replyBubble.innerText = "";
      history.appendChild(replyBubble);
      history.scrollTop = history.scrollHeight;
      
      let i = 0;
      const interval = setInterval(() => {
        if (i < reply.length) {
          replyBubble.innerText += reply.charAt(i);
          i++;
          history.scrollTop = history.scrollHeight;
        } else {
          clearInterval(interval);
        }
      }, 12);
    };

    if (geminiApiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          systemInstruction: { parts: [{ text: systemInstructionText }] },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ],
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
        }),
        signal: controller.signal
      })
      .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error("HTTP error " + response.status);
        return response.json();
      })
      .then(data => {
        let replyText = "";
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
          replyText = data.candidates[0].content.parts[0].text;
        } else {
          replyText = "The assistant remains silent, contemplating in peace...";
        }
        appendReply(replyText);
      })
      .catch(err => {
        clearTimeout(timeoutId);
        console.error("Gemini API call failed:", err);
        appendReply("I am offline, meditating in silence... Please verify your API Key and network connection.");
      });
    } else if (geminiConnectedGoogle) {
      // Mock Responses when Google Connected (Demo Mode)
      setTimeout(() => {
        const query = text.toLowerCase();
        let reply = "";

        if (!sessionActive) {
          reply = "The wheel is spinning, but your session is not... Please go to the 'Session' tab and click 'Start Session' first so I can analyze the live data streams for you...";
        } else if (query.includes("session")) {
          reply = "Your Zen session is currently active... We are tracking your live balance and spins. Keep your mind calm and stick to your 30% profit target...";
        } else if (query.includes("price") || query.includes("cost") || query.includes("buy") || query.includes("license") || query.includes("offer") || query.includes("plan")) {
          reply = "Here are our active plans to accelerate your strategy:\n\n" +
                  "• ZENRoulette Assistant DAILY: €10.00 as a one-time payment for 1 day...\n" +
                  "• ZenRoulette 21 Days Challenge: €97.00 daily for 21 installments...\n" +
                  "• ZenRoulette INNER CIRCLE TRIP: €7,777.00 for lifetime access...\n" +
                  "• ZENRoulette TRIBE: Join us for free...";
        } else if (isLightning && (query.includes("lightning") || query.includes("multiplier") || query.includes("bet") || query.includes("exit"))) {
          reply = "In Lightning Roulette, volatility is your teacher... Ensure coverage of Standard cover, Golden overlaps, and Jackpot targets. Ensure you have a budget for at least 20 survival spins to navigate the streaks...";
        } else if (!isLightning && (query.includes("dealer") || query.includes("strategy") || query.includes("pattern") || query.includes("predict"))) {
          reply = "Dealer strategy relies on signatures and zone selections... Follow the protocol: Find the pattern, Imagine the play, Act decisively, and Detach from the outcome...";
        } else {
          reply = "I hear your question... To unlock my full real-time intelligence and receive personalized answers to your specific queries, please paste your Gemini API Key in the config panel above...";
        }

        appendReply(reply);
      }, 1000);
    } else {
      setTimeout(() => {
        appendReply("Please activate the assistant and enter your Gemini API key (or connect with Google) in the settings panel above to begin chatting...");
      }, 500);
    }
  }

  function updateGeminiUIState() {
    document.querySelectorAll(".zrr-gemini-toggle-input").forEach(el => {
      el.checked = geminiEnabled;
    });

    document.querySelectorAll(".agent-status-dot").forEach(dot => {
      if (geminiEnabled) {
        dot.classList.add("active");
        dot.style.background = "#a855f7";
      } else {
        dot.classList.remove("active");
        dot.style.background = "#ef4444";
      }
    });

    const centerChip = document.getElementById("wheel-center-chip");
    if (centerChip) {
      if (geminiEnabled) {
        centerChip.classList.add("agent-active");
      } else {
        centerChip.classList.remove("agent-active");
      }
    }
    const centerChipLt = document.getElementById("wheel-center-chip-lt");
    if (centerChipLt) {
      if (geminiEnabled) {
        centerChipLt.classList.add("agent-active");
      } else {
        centerChipLt.classList.remove("agent-active");
      }
    }

    document.querySelectorAll(".zrr-gemini-config-panel").forEach(panel => {
      if (geminiEnabled && (geminiApiKey || geminiConnectedGoogle)) {
        panel.style.display = "none";
      } else {
        panel.style.display = "flex";
      }
    });

    document.querySelectorAll(".zrr-gemini-key-input").forEach(input => {
      input.value = geminiApiKey;
    });

    document.querySelectorAll(".zrr-gemini-model-badge").forEach(badge => {
      if (geminiEnabled) {
        if (geminiApiKey) {
          badge.innerText = "Gemini 2.5 Flash";
          badge.style.color = "#a855f7";
        } else if (geminiConnectedGoogle) {
          badge.innerText = "Google Connected";
          badge.style.color = "#a855f7";
        } else {
          badge.innerText = "Offline Mode";
          badge.style.color = "var(--muted)";
        }
      } else {
        badge.innerText = "Offline";
        badge.style.color = "var(--muted)";
      }
    });

    document.querySelectorAll(".zrr-gemini-text-element").forEach(txtEl => {
      if (!geminiEnabled) {
        txtEl.innerText = "Assistant inactive. Toggle active to receive Zen commentaries.";
        txtEl.style.color = "var(--text-main)";
      } else if (!geminiApiKey && !geminiConnectedGoogle) {
        txtEl.innerText = "AI assistant is active in offline mode. Enter an API key or Connect with Google for live AI commentaries.";
        txtEl.style.color = "var(--text-secondary)";
      } else {
        if (txtEl.innerText.includes("inactive") || txtEl.innerText.includes("offline mode")) {
          txtEl.innerText = "Zen Assistant active. Waiting for new live spin...";
          txtEl.style.color = "var(--text-main)";
        }
      }
    });

    document.querySelectorAll(".zrr-gemini-chat-input").forEach(input => {
      input.disabled = !geminiEnabled || (!geminiApiKey && !geminiConnectedGoogle);
      if (input.disabled) {
        input.placeholder = "Activate and connect AI Assistant...";
      } else {
        input.placeholder = "Type your question here...";
      }
    });

    document.querySelectorAll(".zrr-gemini-chat-send-btn").forEach(btn => {
      btn.disabled = !geminiEnabled || (!geminiApiKey && !geminiConnectedGoogle);
      btn.style.opacity = btn.disabled ? "0.5" : "1.0";
    });
  }

  // Gemini Assistant Listeners
  const templates = {};
  const templatesLt = {};

  function initLayout() {
    const container = document.getElementById("dashboardCardsContainer");
    const containerLt = document.getElementById("lightningUnlocked");
    if (!container) return;

    // Save initial templates
    ["zrr-wheel-card", "zrr-strategy-card", "zrr-exit-card", "zrr-gemini-card"].forEach(id => {
      const el = document.getElementById(id);
      if (el && !templates[id]) {
        templates[id] = el.cloneNode(true);
      }
    });

    if (containerLt) {
      ["zrr-wheel-card-lt", "zrr-strategy-card-lt", "zrr-math-card-lt", "zrr-settings-card-lt", "zrr-custom-pref-card", "zrr-gemini-card-lt"].forEach(id => {
        const el = document.getElementById(id);
        if (el && !templatesLt[id]) {
          templatesLt[id] = el.cloneNode(true);
        }
      });
    }

    chrome.storage.local.get([
      "enabledPatternsLt", 
      "collapseStates", 
      "customPrefMappingLt", 
      "geminiApiKey", 
      "geminiEnabled", 
      "geminiConnectedGoogle",
      "dashboardLayoutOrder",
      "lightningLayoutOrder"
    ], (res) => {
      const order = res.dashboardLayoutOrder;
      const allowedIds = ["zrr-wheel-card", "zrr-strategy-card", "zrr-exit-card", "zrr-gemini-card"];
      if (order && Array.isArray(order) && order.length > 0) {
        container.innerHTML = "";
        const addedIds = new Set();
        order.forEach(item => {
          if (!allowedIds.includes(item.id)) return; // skip clones
          if (addedIds.has(item.id)) return; // skip duplicates
          const template = templates[item.templateId];
          if (template) {
            const clone = template.cloneNode(true);
            clone.id = item.id;
            if (item.isCollapsed) {
              clone.classList.add("collapsed");
            } else {
              clone.classList.remove("collapsed");
            }
            container.appendChild(clone);
            bindModuleEvents(clone);
            addedIds.add(item.id);
          }
        });
        
        // Append any missing standard cards
        allowedIds.forEach(id => {
          if (!addedIds.has(id)) {
            const template = templates[id];
            if (template) {
              const clone = template.cloneNode(true);
              clone.id = id;
              container.appendChild(clone);
              bindModuleEvents(clone);
            }
          }
        });
      } else {
        const cards = container.querySelectorAll(".draggable-card");
        cards.forEach(card => {
          bindModuleEvents(card);
        });
      }

      // Restore Lightning Tab Layout
      const orderLt = res.lightningLayoutOrder;
      const allowedIdsLt = ["zrr-wheel-card-lt", "zrr-strategy-card-lt", "zrr-math-card-lt", "zrr-settings-card-lt", "zrr-custom-pref-card", "zrr-gemini-card-lt"];
      if (containerLt) {
        if (orderLt && Array.isArray(orderLt) && orderLt.length > 0) {
          containerLt.innerHTML = "";
          const addedIdsLt = new Set();
          orderLt.forEach(item => {
            if (!allowedIdsLt.includes(item.id)) return;
            if (addedIdsLt.has(item.id)) return; // skip duplicates
            const template = templatesLt[item.templateId];
            if (template) {
              const clone = template.cloneNode(true);
              clone.id = item.id;
              if (item.isCollapsed) {
                clone.classList.add("collapsed");
              } else {
                clone.classList.remove("collapsed");
              }
              containerLt.appendChild(clone);
              bindModuleEvents(clone);
              addedIdsLt.add(item.id);
            }
          });
          
          // Append any missing Lightning cards
          allowedIdsLt.forEach(id => {
            if (!addedIdsLt.has(id)) {
              const template = templatesLt[id];
              if (template) {
                const clone = template.cloneNode(true);
                clone.id = id;
                containerLt.appendChild(clone);
                bindModuleEvents(clone);
              }
            }
          });
        } else {
          const cardsLt = containerLt.querySelectorAll(".draggable-card");
          cardsLt.forEach(card => {
            bindModuleEvents(card);
          });
        }
      }

      initDragAndDrop();

      if (res && res.enabledPatternsLt) {
        enabledPatternsLt = Object.assign(enabledPatternsLt, res.enabledPatternsLt);
      }
      if (toggleZero) toggleZero.checked = !!enabledPatternsLt.zero;
      if (toggleRep) toggleRep.checked = !!enabledPatternsLt.rep;
      if (toggleCns) toggleCns.checked = !!enabledPatternsLt.cns;
      if (togglePref) togglePref.checked = !!enabledPatternsLt.pref;

      const customPrefCard = document.getElementById("zrr-custom-pref-card");
      if (customPrefCard) {
        customPrefCard.style.display = enabledPatternsLt.pref ? "flex" : "none";
      }

      if (res && res.collapseStates && (!orderLt || orderLt.length === 0)) {
        const states = res.collapseStates;
        toggleCollapseClass("zrr-strategy-card-lt", states.strategy);
        toggleCollapseClass("zrr-math-card-lt", states.math);
        toggleCollapseClass("zrr-settings-card-lt", states.settings);
        toggleCollapseClass("zrr-custom-pref-card", states.customPref);
      }

      if (res && res.customPrefMappingLt) {
        customPrefMappingLt = res.customPrefMappingLt;
      } else {
        customPrefMappingLt = Object.assign({}, defaultPrefMappingLt);
        chrome.storage.local.set({ customPrefMappingLt: customPrefMappingLt });
      }

      populatePrefDropdownAndInputs();

      if (res) {
        geminiApiKey = res.geminiApiKey || "";
        geminiEnabled = !!res.geminiEnabled;
        geminiConnectedGoogle = !!res.geminiConnectedGoogle;
        updateGeminiUIState();
      }

      checkAuth().then(() => {
        drawRouletteWheel();
        if (IS_PREVIEW_MODE) {
          setTimeout(() => {
            applyPreviewDummyData();
          }, 120);
        }
      }).catch((error) => {
        console.error("ZRA panel initialization failed:", error);
      });
    });
  }

  function bindModuleEvents(card) {
    const header = card.querySelector(".card-header");
    const content = card.querySelector(".card-content");
    
    if (header && content && !card.dataset.eventsBound) {
      header.addEventListener("click", (e) => {
        if (e.target.classList.contains("card-control-btn") || e.target.closest(".switch") || e.target.closest("input, select, button, a")) {
          return;
        }
        window.toggleCardCollapse(card);
        if (card.parentNode && card.parentNode.id === "lightningUnlocked") {
          saveLightningCardOrder();
        } else {
          saveCardOrder();
        }
      });
    }

    const upBtn = card.querySelector(".move-up");
    const downBtn = card.querySelector(".move-down");

    if (upBtn && !card.dataset.eventsBound) {
      upBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const prev = card.previousElementSibling;
        if (prev && prev.classList.contains("draggable-card")) {
          card.parentNode.insertBefore(card, prev);
          if (card.parentNode && card.parentNode.id === "lightningUnlocked") {
            saveLightningCardOrder();
          } else {
            saveCardOrder();
          }
        }
      });
    }

    if (downBtn && !card.dataset.eventsBound) {
      downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = card.nextElementSibling;
        if (next && next.classList.contains("draggable-card")) {
          card.parentNode.insertBefore(next, card);
          if (card.parentNode && card.parentNode.id === "lightningUnlocked") {
            saveLightningCardOrder();
          } else {
            saveCardOrder();
          }
        }
      });
    }

    const chatInput = card.querySelector(".zrr-gemini-chat-input");
    const sendBtn = card.querySelector(".zrr-gemini-chat-send-btn");

    if (sendBtn && chatInput && !card.dataset.eventsBound) {
      const submitChat = () => {
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = "";
        handleChatSubmission(card, text);
      };

      sendBtn.addEventListener("click", submitChat);
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          submitChat();
        }
      });
    }

    // Exit Math sync listeners
    const budgetInput = card.querySelector(".zrr-math-budget");
    const profitInput = card.querySelector(".zrr-math-profit-percent");
    const unitSelect = card.querySelector(".zrr-math-unit");
    const spinsInput = card.querySelector(".zrr-math-min-spins");

    if (budgetInput && !card.dataset.eventsBound) {
      budgetInput.addEventListener("input", () => {
        hasUserModifiedBudget = true;
        document.querySelectorAll(".zrr-math-budget").forEach(el => {
          if (el !== budgetInput) el.value = budgetInput.value;
        });
        calculateStrategyMath();
      });
    }
    if (profitInput && !card.dataset.eventsBound) {
      profitInput.addEventListener("input", () => {
        document.querySelectorAll(".zrr-math-profit-percent").forEach(el => {
          if (el !== profitInput) el.value = profitInput.value;
        });
        calculateStrategyMath();
      });
    }
    if (unitSelect && !card.dataset.eventsBound) {
      unitSelect.addEventListener("change", () => {
        document.querySelectorAll(".zrr-math-unit").forEach(el => {
          if (el !== unitSelect) el.value = unitSelect.value;
        });
        calculateStrategyMath();
      });
    }
    if (spinsInput && !card.dataset.eventsBound) {
      spinsInput.addEventListener("input", () => {
        document.querySelectorAll(".zrr-math-min-spins").forEach(el => {
          if (el !== spinsInput) el.value = spinsInput.value;
        });
        calculateStrategyMath();
      });
    }

    // Gemini card listeners
    const toggleInput = card.querySelector(".zrr-gemini-toggle-input");
    const keyInput = card.querySelector(".zrr-gemini-key-input");
    const saveBtn = card.querySelector(".zrr-gemini-save-btn-input");
    const googleBtn = card.querySelector(".zrr-gemini-google-btn-input");

    if (toggleInput && !card.dataset.eventsBound) {
      toggleInput.addEventListener("change", () => {
        geminiEnabled = toggleInput.checked;
        document.querySelectorAll(".zrr-gemini-toggle-input").forEach(el => {
          el.checked = geminiEnabled;
        });
        chrome.storage.local.set({ geminiEnabled: geminiEnabled }, () => {
          updateGeminiUIState();
          redrawActiveWheel();
        });
      });
    }

    if (saveBtn && !card.dataset.eventsBound) {
      saveBtn.addEventListener("click", () => {
        if (keyInput) {
          geminiApiKey = keyInput.value.trim();
          geminiEnabled = true;
          chrome.storage.local.set({ geminiApiKey: geminiApiKey, geminiEnabled: true }, () => {
            updateGeminiUIState();
            redrawActiveWheel();
            alert("Gemini API Key saved and assistant activated successfully.");
          });
        }
      });
    }

    if (googleBtn && !card.dataset.eventsBound) {
      googleBtn.addEventListener("click", () => {
        geminiConnectedGoogle = true;
        geminiEnabled = true;
        chrome.storage.local.set({ geminiConnectedGoogle: geminiConnectedGoogle, geminiEnabled: true }, () => {
          updateGeminiUIState();
          redrawActiveWheel();
          alert("Connected with Google and assistant activated successfully.");
        });
      });
    }

    const recAlert = card.querySelector(".zrr-recommendation");
    if (recAlert && !card.dataset.eventsBound) {
      recAlert.addEventListener("click", () => {
        if (recAlert.classList.contains("clickable")) {
          recAlert.classList.add("refreshing");
          chrome.runtime.sendMessage({ type: "update-dashboard" });
          setTimeout(() => {
            recAlert.classList.remove("refreshing");
          }, 900);
        }
      });
    }

    const recAlertLt = card.querySelector(".zrr-recommendation-lt");
    if (recAlertLt && !card.dataset.eventsBound) {
      recAlertLt.addEventListener("click", () => {
        if (recAlertLt.classList.contains("clickable")) {
          recAlertLt.classList.add("refreshing");
          chrome.runtime.sendMessage({ type: "update-dashboard" });
          setTimeout(() => {
            recAlertLt.classList.remove("refreshing");
          }, 900);
        }
      });
    }

    // Wheel canvas manual bet click
    const wheelCanvas = card.querySelector("#canvas");
    if (wheelCanvas && !card.dataset.eventsBound) {
      wheelCanvas.style.cursor = "pointer";
      wheelCanvas.addEventListener("click", (event) => {
        const clickedNumber = getNumberFromWheelClick(event);
        if (clickedNumber) {
          sendManualBet(clickedNumber);
        }
      });
    }

    const wheelCanvasLt = card.querySelector("#canvas-lt");
    if (wheelCanvasLt && !card.dataset.eventsBound) {
      wheelCanvasLt.style.cursor = "pointer";
      wheelCanvasLt.addEventListener("click", (event) => {
        const clickedNumber = getNumberFromWheelClick(event);
        if (clickedNumber) {
          sendManualBet(clickedNumber);
        }
      });
    }

    // Jackpot numbers click
    const jackpotContainer = card.querySelector("#zrr-jackpot-four-numbers");
    if (jackpotContainer && !card.dataset.eventsBound) {
      jackpotContainer.addEventListener("click", (event) => {
        const badge = event.target.closest(".number-badge[data-number]");
        if (badge) {
          sendManualBet(badge.dataset.number);
        }
      });
    }

    const jackpotContainerLt = card.querySelector("#zrr-jackpot-four-numbers-lt");
    if (jackpotContainerLt && !card.dataset.eventsBound) {
      jackpotContainerLt.addEventListener("click", (event) => {
        const badge = event.target.closest(".number-badge[data-number]");
        if (badge) {
          sendManualBet(badge.dataset.number);
        }
      });
    }

    // Strategy recommendation numbers click
    const strategyContainer = card.querySelector("#zrr-bet-numbers");
    if (strategyContainer && !card.dataset.eventsBound) {
      strategyContainer.addEventListener("click", (event) => {
        const badge = event.target.closest(".number-badge[data-number]");
        if (badge) {
          sendManualBet(badge.dataset.number);
        }
      });
    }

    const strategyContainerLt = card.querySelector("#zrr-bet-numbers-lt");
    if (strategyContainerLt && !card.dataset.eventsBound) {
      strategyContainerLt.addEventListener("click", (event) => {
        const badge = event.target.closest(".number-badge[data-number]");
        if (badge) {
          sendManualBet(badge.dataset.number);
        }
      });
    }

    // Golden ring numbers click
    const goldContainer = card.querySelector("#zrr-gold-numbers");
    if (goldContainer && !card.dataset.eventsBound) {
      goldContainer.addEventListener("click", (event) => {
        const badge = event.target.closest(".number-badge[data-number]");
        if (badge) {
          sendManualBet(badge.dataset.number, 1);
        }
      });
    }

    const goldContainerLt = card.querySelector("#zrr-gold-numbers-lt");
    if (goldContainerLt && !card.dataset.eventsBound) {
      goldContainerLt.addEventListener("click", (event) => {
        const badge = event.target.closest(".number-badge[data-number]");
        if (badge) {
          sendManualBet(badge.dataset.number, 1);
        }
      });
    }

    card.dataset.eventsBound = "true";
  }

  function saveLightningCardOrder() {
    const container = document.getElementById("lightningUnlocked");
    if (!container) return;
    
    const cards = container.querySelectorAll(".draggable-card");
    const orderData = [];
    const savedIds = new Set();
    cards.forEach(card => {
      if (savedIds.has(card.id)) return;
      savedIds.add(card.id);
      orderData.push({
        id: card.id,
        isCollapsed: card.classList.contains("collapsed"),
        templateId: card.id.split("-clone-")[0]
      });
    });
    
    chrome.storage.local.set({ lightningLayoutOrder: orderData });
  }

  function saveCardOrder() {
    const container = document.getElementById("dashboardCardsContainer");
    if (!container) return;
    
    const cards = container.querySelectorAll(".draggable-card");
    const orderData = [];
    const savedIds = new Set();
    cards.forEach(card => {
      if (savedIds.has(card.id)) return;
      savedIds.add(card.id);
      orderData.push({
        id: card.id,
        isCollapsed: card.classList.contains("collapsed"),
        templateId: card.id.split("-clone-")[0]
      });
    });
    
    chrome.storage.local.set({ dashboardLayoutOrder: orderData });
  }

  let draggingElement = null;

  function initDragAndDrop() {
    ["dashboardCardsContainer", "lightningUnlocked"].forEach(containerId => {
      const container = document.getElementById(containerId);
      if (!container) return;

      const cards = container.querySelectorAll(".draggable-card");
      cards.forEach(card => {
        const header = card.querySelector(".card-header");
        if (header) {
          header.setAttribute("draggable", "true");
          if (!header.dataset.dragBound) {
            header.addEventListener("dragstart", (e) => {
              draggingElement = card;
              card.classList.add("dragging");
              e.dataTransfer.effectAllowed = "move";
            });

            header.addEventListener("dragend", () => {
              draggingElement = null;
              card.classList.remove("dragging");
              cards.forEach(c => c.classList.remove("drag-over"));
              if (containerId === "lightningUnlocked") {
                saveLightningCardOrder();
              } else {
                saveCardOrder();
              }
            });
            header.dataset.dragBound = "true";
          }
        }

        if (!card.dataset.dropBound) {
          card.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (draggingElement && card !== draggingElement && draggingElement.parentNode === container) {
              card.classList.add("drag-over");
            }
          });

          card.addEventListener("dragleave", () => {
            card.classList.remove("drag-over");
          });

          card.addEventListener("drop", (e) => {
            e.preventDefault();
            card.classList.remove("drag-over");
            
            if (draggingElement && card !== draggingElement && draggingElement.parentNode === container) {
              const allCards = Array.from(container.querySelectorAll(".draggable-card"));
              const draggingIdx = allCards.indexOf(draggingElement);
              const targetIdx = allCards.indexOf(card);
              
              if (draggingIdx < targetIdx) {
                container.insertBefore(draggingElement, card.nextSibling);
              } else {
                container.insertBefore(draggingElement, card);
              }
              
              if (containerId === "lightningUnlocked") {
                saveLightningCardOrder();
              } else {
                saveCardOrder();
              }
            }
          });
          card.dataset.dropBound = "true";
        }
      });
    });
  }

  function initializePanel() {
    if (panelInitialized) {
      return;
    }
    panelInitialized = true;
    initLayout();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePanel, { once: true });
  } else {
    initializePanel();
  }
})();
