// ✅ background.js for ZRA v2.0 with safe API calls, token caching, and logging

if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error("Error setting side panel behavior:", error);
  });
}

// Keep this false in packaged builds. Local preview mode is handled by top.js.
const DEV_BYPASS_AUTH = false;
const PUBLIC_API_ACTIONS = new Set([
  "auth",
  "license_request",
  "license_activate",
  "license_status"
]);
let lastRouletteTabId = null;
const API_ENDPOINTS = [
  "https://zenroulette.com/api/index.php",
  "https://www.zenroulette.com/api/index.php",
  "https://zenroulette.com.local/api/index.php"
];
let cachedApiEndpoint = API_ENDPOINTS[0];

function openDashboardFallback() {
  const url = chrome.runtime.getURL("popup.html");
  if (chrome.windows && chrome.windows.create) {
    chrome.windows.create({
      url,
      type: "popup",
      width: 470,
      height: 760,
      focused: true
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error opening dashboard window:", chrome.runtime.lastError.message);
      }
    });
    return;
  }

  chrome.tabs.create({ url }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error opening dashboard tab:", chrome.runtime.lastError.message);
    }
  });
}

function isRelevantRouletteUrl(url) {
  const lowerUrl = String(url || "").toLowerCase();
  if (!lowerUrl || lowerUrl === "about:blank") {
    return false;
  }

  return (
    lowerUrl.includes("roulette") ||
    lowerUrl.includes("table_id=") ||
    lowerUrl.includes("playforreal") ||
    lowerUrl.includes("/play/") ||
    lowerUrl.includes("vladcazino.ro/play/")
  );
}

async function findTargetRouletteTabId() {
  if (lastRouletteTabId) {
    try {
      const existing = await chrome.tabs.get(lastRouletteTabId);
      if (existing && existing.url && isRelevantRouletteUrl(existing.url)) {
        return existing.id;
      }
    } catch (_error) {
      lastRouletteTabId = null;
    }
  }

  const activeCurrentWindow = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = activeCurrentWindow && activeCurrentWindow[0];
  if (activeTab && activeTab.id && isRelevantRouletteUrl(activeTab.url)) {
    lastRouletteTabId = activeTab.id;
    return activeTab.id;
  }

  const activeFocusedWindow = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const focusedTab = activeFocusedWindow && activeFocusedWindow[0];
  if (focusedTab && focusedTab.id && isRelevantRouletteUrl(focusedTab.url)) {
    lastRouletteTabId = focusedTab.id;
    return focusedTab.id;
  }

  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  const ranked = tabs
    .filter((tab) => tab && tab.id && isRelevantRouletteUrl(tab.url))
    .sort((a, b) => {
      const score = (tab) => {
        let s = 0;
        if (tab.active) s += 200;
        if (tab.lastAccessed) {
          const ageMs = Math.max(0, now - tab.lastAccessed);
          const recencyScore = Math.max(0, 100 - Math.floor(ageMs / 15000));
          s += recencyScore;
        }
        const lowerUrl = String(tab.url || "").toLowerCase();
        if (lowerUrl.includes("bucharest-roulette")) s += 80;
        if (lowerUrl.includes("playforreal")) s += 40;
        return s;
      };

      return score(b) - score(a);
    });

  if (ranked.length > 0) {
    lastRouletteTabId = ranked[0].id;
    return ranked[0].id;
  }

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    if (tab && tab.id && isRelevantRouletteUrl(tab.url)) {
      lastRouletteTabId = tab.id;
      return tab.id;
    }
  }

  return null;
}

async function ensureContentScriptInjected(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["strategy-core.js", "app.js"]
    });
  } catch (error) {
    console.warn("Unable to inject ZRA content script:", error && error.message ? error.message : error);
  }
}

async function handleUpdateDashboard(request, sendResponse) {
  try {
    if (request.type !== "logout") {
      const state = await chrome.storage.local.get([
        "authenticated",
        "zrrLicense",
        "zrrInstallationId"
      ]);
      const license = state.zrrLicense;
      const expiresAt = Date.parse((license && license.expiresAt) || "");
      const licensed =
        !!state.authenticated &&
        !!license &&
        license.deviceId === state.zrrInstallationId &&
        Number.isFinite(expiresAt) &&
        expiresAt > Date.now();
      if (!licensed) {
        return;
      }
    }

    const targetTabId = await findTargetRouletteTabId();
    if (targetTabId) {
      await ensureContentScriptInjected(targetTabId);
      chrome.webNavigation.getAllFrames({ tabId: targetTabId }, (frames) => {
        if (chrome.runtime.lastError || !frames || frames.length === 0) {
          chrome.tabs.sendMessage(targetTabId, request, (res) => {
            if (chrome.runtime.lastError) {
              console.warn("SendMessage fallback failed:", chrome.runtime.lastError.message);
            }
          });
          return;
        }
        frames.forEach((frame) => {
          chrome.tabs.sendMessage(targetTabId, request, { frameId: frame.frameId }, (res) => {
            if (chrome.runtime.lastError) {
              // Safe fallback for uninjected frames
            }
          });
        });
      });
    }
  } catch (e) {
    console.error("handleUpdateDashboard error:", e);
  }
}

function broadcastToPanel(request) {
  chrome.runtime.sendMessage({ ...request, __panelRelay: true }, () => {
    if (chrome.runtime.lastError) {
      console.warn("Broadcast to panel failed:", chrome.runtime.lastError.message);
    }
  });
}

function handleSaveStats(playData) {
  try {
    const rows = Array.isArray(playData) ? playData : [];
    const csvEscape = (value) => `"${String(value === undefined || value === null ? "" : value).replace(/"/g, '""')}"`;
    const listText = (value) => Array.isArray(value) ? value.join(" ") : String(value || "");
    const objectText = (value) => value && typeof value === "object" ? JSON.stringify(value) : "";
    const headers = [
      "Time",
      "Logged At",
      "Dealer",
      "Round",
      "Mode",
      "Decision",
      "Previous Winner",
      "Winner",
      "Result",
      "Win?",
      "JP Hit?",
      "Gold Hit?",
      "Bet Count",
      "Bet On",
      "Candidate Numbers",
      "Standard Numbers",
      "Golden Numbers",
      "Jackpot Numbers",
      "Pattern Numbers",
      "Active Patterns",
      "Pattern Targets",
      "Recent Before",
      "Math Counts",
      "Recommendation At"
    ];

    const csvRows = [headers].concat(rows.map((row) => [
      row.playTime,
      row.loggedAt,
      row.dealer,
      row.playRound,
      row.strategyMode,
      row.decision,
      row.previousWinner,
      row.winner,
      row.resultType,
      row.win ? "YES" : "NO",
      row.favorite ? "YES" : "NO",
      row.golden ? "YES" : "NO",
      Array.isArray(row.betOn) ? row.betOn.length : 0,
      listText(row.betOn),
      listText(row.candidateNumbers),
      listText(row.standardNumbers),
      listText(row.goldenNumbers),
      listText(row.jackpotNumbers),
      listText(row.patternNumbers),
      listText(row.activePatterns),
      objectText(row.patternTargets),
      listText(row.recentNumbersBefore),
      objectText(row.mathCounts),
      row.recommendationAt
    ]));

    const csvContent = csvRows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const csvUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    chrome.downloads.download({ url: csvUrl, filename: `zra_stats_${timestamp}.csv` });

    const jsonUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rows, null, 2));
    chrome.downloads.download({ url: jsonUrl, filename: `zra_stats_${timestamp}.json` });
  } catch (e) {
    console.error("handleSaveStats error:", e);
  }
}

function buildParams(data) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      value.forEach(val => params.append(`${key}[]`, val));
      params.append(key, value.join(','));
    } else {
      params.append(key, value);
    }
  }
  return params.toString();
}

async function handleApi(data, sendResponse) {
  try {
    if (DEV_BYPASS_AUTH && data.action === 'auth') {
      sendResponse({ success: true, token: "dev-bypass-token", membership: "dev" });
      return true;
    }

    const isPublicAction = PUBLIC_API_ACTIONS.has(data.action);
    if (!DEV_BYPASS_AUTH && !isPublicAction) {
      const state = await chrome.storage.local.get(["authenticated", "securityToken"]);
      if (!state.authenticated || !state.securityToken) {
        sendResponse({ success: false, error: "Not authenticated" });
        return true;
      }
      data.token = state.securityToken;
    } else if (data.action !== 'auth') {
      const state = await chrome.storage.local.get(["securityToken"]);
      if (state.securityToken) {
        data.token = state.securityToken;
      }
    }

    console.log("API Request:", data.action || "unknown");

    const requestBody = buildParams(data);
    const orderedEndpoints = [cachedApiEndpoint].concat(
      API_ENDPOINTS.filter((url) => url !== cachedApiEndpoint)
    );

    let response = null;
    let lastFetchError = null;

    for (let i = 0; i < orderedEndpoints.length; i++) {
      const endpoint = orderedEndpoints[i];
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: requestBody
        });

        cachedApiEndpoint = endpoint;
        break;
      } catch (fetchError) {
        lastFetchError = fetchError;
      }
    }

    if (!response) {
      throw (lastFetchError || new Error("Failed to fetch API endpoint"));
    }

    let text = await response.text();
    if (!text || text.trim() === "") {
      sendResponse({ success: false, error: "Empty server response" });
      return true;
    }

    let msg = {};
    try {
      msg = JSON.parse(text);
    } catch (jsonErr) {
      console.error("JSON parse error:", jsonErr.message);
      sendResponse({ success: false, error: "Invalid JSON returned from server" });
      return true;
    }

    if (!DEV_BYPASS_AUTH && data.action === 'auth') {
      if (msg.success && msg.token) {
        chrome.storage.local.set({ authenticated: true, securityToken: msg.token });
      }
    } else if (!DEV_BYPASS_AUTH && !isPublicAction) {
      if (msg.token) {
        chrome.storage.local.set({ securityToken: msg.token });
      } else {
        chrome.storage.local.remove("securityToken");
        chrome.storage.local.set({ authenticated: false });
      }
    }

    sendResponse(msg);
  } catch (e) {
    console.error("handleApi error:", e);
    sendResponse({ success: false, error: e.message });
  }
  return true;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.__panelRelay) {
    return false;
  }

  if (["update-dashboard", "logout", "manual-bet"].includes(request.type)) {
    handleUpdateDashboard(request, sendResponse);
    return false;
  } else if (request.type === "update-dashboard-ui" || request.type === "update-play") {
    if (sender && sender.tab && sender.tab.id) {
      lastRouletteTabId = sender.tab.id;
    }
    broadcastToPanel(request);
    return false;
  } else if (request.type === "save-stats") {
    handleSaveStats(request.playData);
    return false;
  } else if (request.type === "api") {
    return handleApi(request.data, sendResponse);
  } else if (request.type === "reset-auth") {
    if (!DEV_BYPASS_AUTH) {
      chrome.storage.local.set({ authenticated: false, securityToken: null });
    }
    return false;
  }
  return false;
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId: tab.id });
    } else {
      console.warn("Side panel API not available, falling back to popup");
      openDashboardFallback();
    }
  } catch (error) {
    console.error("Error opening side panel:", error);
    openDashboardFallback();
  }
});
