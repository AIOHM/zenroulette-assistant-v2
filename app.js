function isRelevantRouletteFrame() {
  const href = window.location.href || "";
  const host = window.location.hostname || "";
  const referrer = document.referrer || "";

  // 1. Block third-party tracking, ads, and analytics iframes
  const blockedHosts = [
    "doubleclick.net",
    "snapchat.com",
    "facebook.com",
    "facebook.net",
    "google-analytics.com",
    "googletagmanager.com",
    "liveperson.net",
    "lpsnmedia.net",
    "hotjar.com",
    "sentry.io",
    "adnxs.com",
    "casalemedia.com",
    "rubiconproject.com",
    "pubmatic.com",
    "openx.net",
    "criteo.com",
    "outbrain.com",
    "taboola.com",
    "optimizely.com",
    "crazyegg.com"
  ];
  if (blockedHosts.some((b) => host.includes(b))) {
    return false;
  }

  // 2. Block the main portal domain and its sub-iframes completely
  const isMainPortal = host === "vladcazino.ro" || host === "www.vladcazino.ro" || 
                       host === "fortunejack.com" || host === "www.fortunejack.com" || 
                       host === "bc.game" || host === "www.bc.game";
  if (isMainPortal) {
    return false;
  }

  const lowerHref = href.toLowerCase();
  const lowerReferrer = referrer.toLowerCase();
  const isOpaqueAboutFrame = lowerHref === "about:blank" || lowerHref === "about:srcdoc";

  const knownHostHints = [
    "vladcazino.ro",
    "evolution",
    "evo-games.com",
    "wirebankers.com",
    "live.wirebankers.com",
    "fortunejack.com",
    "bc.game"
  ];

  const ancestorHints = (() => {
    try {
      const origins = window.location.ancestorOrigins;
      if (!origins || typeof origins.length !== "number") {
        return "";
      }
      const parts = [];
      for (let i = 0; i < origins.length; i++) {
        parts.push(String(origins[i] || "").toLowerCase());
      }
      return parts.join(" ");
    } catch (_error) {
      return "";
    }
  })();

  const hierarchyHints = (() => {
    const parts = [];
    try {
      if (window.top && window.top.location) {
        parts.push(String(window.top.location.hostname || "").toLowerCase());
        parts.push(String(window.top.location.href || "").toLowerCase());
      }
    } catch (_error) {
      // Cross-origin access can fail.
    }

    try {
      if (window.parent && window.parent.location) {
        parts.push(String(window.parent.location.hostname || "").toLowerCase());
        parts.push(String(window.parent.location.href || "").toLowerCase());
      }
    } catch (_error) {
      // Cross-origin access can fail.
    }

    return parts.join(" ");
  })();

  if (!href) {
    return false;
  }

  const allowedHost = knownHostHints.some((hint) => host.includes(hint));
  const allowedAncestor = knownHostHints.some(
    (hint) => ancestorHints.includes(hint) || hierarchyHints.includes(hint) || lowerReferrer.includes(hint)
  );

  if (!allowedHost && !allowedAncestor && !isOpaqueAboutFrame) {
    return false;
  }

  // Some casino/provider updates remove "roulette" from iframe URLs.
  // Keep known hosts and relevant nested frames active.
  const hasRouletteHint =
    lowerHref.includes("roulette") ||
    lowerHref.includes("table_id=") ||
    lowerHref.includes("playforreal") ||
    lowerHref.includes("/play/") ||
    lowerHref.includes("live-casino") ||
    lowerHref.includes("game/") ||
    lowerReferrer.includes("roulette") ||
    lowerReferrer.includes("playforreal") ||
    lowerReferrer.includes("/play/");

  // Provider games often run in about:blank/about:srcdoc iframes without useful URL hints.
  // Keep only frames that either inherit known host context or expose roulette-specific UI text.
  if (isOpaqueAboutFrame) {
    if (window.top !== window) {
      return true;
    }

    if (allowedAncestor || hasRouletteHint) {
      return true;
    }

    const bodyText = (() => {
      try {
        const body = document.body || document.documentElement;
        const raw = body ? (body.innerText || body.textContent || "") : "";
        return String(raw).toLowerCase();
      } catch (_error) {
        return "";
      }
    })();

    const hasRouletteWords =
      bodyText.includes("roulette") ||
      bodyText.includes("voisins") ||
      bodyText.includes("orphelins") ||
      bodyText.includes("tiers") ||
      bodyText.includes("zero");

    const numberTokens = bodyText.match(/(?:^|\D)(0|[1-9][0-9]?)(?=\D|$)/g) || [];
    const hasNumberStrip = numberTokens.length >= 8;

    return hasRouletteWords && hasNumberStrip;
  }

  if (hasRouletteHint) {
    return true;
  }

  return allowedHost || allowedAncestor;
}

function hasRuntimeAccess() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (_error) {
    return false;
  }
}

function safeSendRuntimeMessage(payload, callback) {
  if (!hasRuntimeAccess()) {
    return;
  }

  try {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (typeof callback === "function") {
        callback(response);
      }
    });
  } catch (_error) {
    // Extension was reloaded or context is gone; ignore silently.
  }
}

if (!isRelevantRouletteFrame()) {
  // Do not activate on ad/analytics/about:blank frames.
} else {
  const ZRA_INSTANCE_KEY = "__zraContentScriptInstance";
  if (window[ZRA_INSTANCE_KEY] && typeof window[ZRA_INSTANCE_KEY].cleanup === "function") {
    try {
      window[ZRA_INSTANCE_KEY].cleanup();
    } catch (_error) {
      // A stale content-script context can remain after extension reload.
    }
  }

  console.log("ZRA content script injected:", window.location.href);

  // Note: main-world event wrapper intercepts are now handled via a dedicated Manifest V3 world: MAIN script (main-world.js)
  // to fully bypass strict Content Security Policies (CSP) blocking inline scripts.

const WHEEL_ORDER = [
  "0", "32", "15", "19", "4", "21", "2", "25", "17", "34", "6", "27", "13", "36", "11", "30", "8", "23", "10", "5", "24", "16", "33", "1", "20", "14", "31", "9", "22", "18", "29", "7", "28", "12", "35", "3", "26"
];

const ZRA_STRATEGY_CORE = null;
const zraStandardJackpotEngine = null;

let betNumbers = [];
let betFavorites = [];
let highStakeNumbers = [];
let loopCount = 0;
let auto = true;
let lastWinner = null;
let lastDashboardSentAt = 0;
let observedElement = null;
let mutationObserver = null;
let pollTimer = null;
let observeRetryTimer = null;

// API Strategy Engines state variables
let persistentJackpots = [];
let lastWinnerForJackpots = null;
let persistentJackpotsLt = [];
let lastWinnerForJackpotsLt = null;
let lastCnsHitWinnerLt = null;
let lastObservedTableType = "UNKNOWN";
let patternOrderLt = ["ZERO", "PREF", "CNS", "REP"];

const defaultPrefMappingLt = {
  "0": ["10"], "1": ["3"], "2": ["11"], "3": ["1", "21"], "4": ["10"], "5": ["8"], "6": ["36"],
  "7": ["17", "27"], "8": ["18", "28"], "9": ["23"], "10": ["4", "0", "20", "30"], "11": ["2", "8", "13"],
  "12": ["36"], "13": ["31", "22"], "14": ["1", "9"], "15": ["1"], "16": ["23", "32"], "17": ["7", "27"],
  "18": ["8", "28", "7", "9"], "19": ["9", "29"], "20": ["10", "30", "4", "0"], "21": ["27", "31", "12"],
  "22": ["13"], "23": ["32"], "24": ["22", "36"], "25": ["29"], "26": ["34", "3", "0", "19"],
  "27": ["21", "35"], "28": ["8", "18", "7", "9"], "29": ["9", "19"], "30": ["8", "11", "22", "20"],
  "31": ["13"], "32": ["23"], "33": ["6"], "34": ["25", "26", "27", "13"], "35": ["27", "32", "19"],
  "36": ["24"]
};
let heuristicCache = null;
let roundHistory = [];
let lastDashboardDebugKey = null;
let multiplierHitCount = 0;
let lastMultiplierEvent = null;
let lastMultiplierCountedRoundKey = null;
const MULTIPLIER_VALUES = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
const MULTIPLIER_CARD_TTL_MS = 45000;
const multiplierCardCache = new Map();

function normalizeToken(token) {
  if (!token) {
    return null;
  }

  const trimmed = String(token).trim();
  if (!trimmed) {
    return null;
  }

  if (!/^(0|[1-9][0-9]?)$/.test(trimmed)) {
    return null;
  }

  const value = parseInt(trimmed, 10);
  if (value < 0 || value > 36) {
    return null;
  }

  return String(value);
}

function getElementTextWithSpaces(el) {
  if (!el) {
    return "";
  }
  if (el.nodeType === 3) {
    return el.textContent || "";
  }
  if (!el.childNodes || el.childNodes.length === 0) {
    return el.textContent || "";
  }
  let text = "";
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === 3) {
      text += " " + child.textContent + " ";
    } else if (child.nodeType === 1) {
      text += " " + getElementTextWithSpaces(child) + " ";
    }
  }
  return text.replace(/\s+/g, " ").trim();
}

function extractNumbersFromText(text) {
  if (!text) {
    return [];
  }

  const source = String(text).replace(/([0-9])[\u2009\u202f]([0-9])/g, "$1$2");
  const cleaned = source
    // Replace multipliers like 100x, 50x, 100x26, 50x6 with a space
    .replace(/\b\d+\s*(?:x|ori)(?:\b|(?=\d))/gi, " ")
    // Keep number when multiplier/label markers are attached.
    .replace(/\b(?:x|ori)\s*(\d{1,2})\b/gi, "$1 ")
    .replace(/\b(\d{1,2})\s*(?:x|ori)\b/gi, "$1 ");
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

function uniquePreserveOrder(values, limit) {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
      if (limit && out.length >= limit) {
        break;
      }
    }
  }
  return out;
}

function getClassText(el) {
  if (!el || !el.className) {
    return "";
  }

  if (typeof el.className === "string") {
    return el.className;
  }

  if (el.className && typeof el.className.baseVal === "string") {
    return el.className.baseVal;
  }

  return String(el.className || "");
}

function getElementIdentity(el) {
  if (!el || typeof el.getAttribute !== "function") {
    return "";
  }

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
      // Ignore selectors unsupported by a particular root.
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

function logDashboardNumbers(recentNumbers) {
  const key = Array.isArray(recentNumbers) ? recentNumbers.slice(0, 12).join(",") : "";
  if (key === lastDashboardDebugKey) {
    return;
  }

  lastDashboardDebugKey = key;
  console.log("ZRA recent numbers:", Array.isArray(recentNumbers) ? recentNumbers : []);
}

function readNumbersFromSelector(selector, minCount) {
  const nodes = querySelectorAllDeep(selector);
  if (!nodes || nodes.length === 0) {
    return [];
  }

  const flat = [];
  nodes.forEach((node) => {
    const nums = extractNumbersFromText(getElementTextWithSpaces(node));
    for (let i = 0; i < nums.length; i++) {
      flat.push(nums[i]);
    }
  });

  const list = flat.slice(0, 24);
  if (list.length >= minCount) {
    return list;
  }

  return [];
}

function readRecentFromDenseRows() {
  const candidates = querySelectorAllDeep("div, span, p, li, td, button, text, g");
  let best = null;
  let bestScore = -1;

  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    const raw = getElementTextWithSpaces(el);
    if (!raw) {
      continue;
    }

    // Skip heavy containers to avoid parsing entire page text.
    if (el.children && el.children.length > 40) {
      continue;
    }

    if (raw.length < 7 || raw.length > 150) {
      continue;
    }

    const parsed = extractNumbersFromText(raw);
    if (parsed.length < 4 || parsed.length > 20) {
      continue;
    }

    const uniqueCount = new Set(parsed).size;
    if (uniqueCount < 4) {
      continue;
    }

    const classId = getElementIdentity(el);
    const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;

    let score = parsed.length;
    if (classId.includes("history") || classId.includes("recent") || classId.includes("result") || classId.includes("outcome") || classId.includes("winning")) {
      score += 120;
    }
    if (rect && rect.top >= 0 && rect.top < (window.innerHeight * 0.55)) {
      score += 18;
    }
    if (rect && rect.width > 250 && rect.height < 90) {
      score += 15;
    }

    if (score > bestScore) {
      bestScore = score;
      best = parsed;
    }
  }

  return best ? best.slice(0, 20) : [];
}

function readRecentFromBodyTextRuns() {
  const body = document.body || document.documentElement;
  const source = body ? (body.innerText || body.textContent || "") : "";
  if (!source) {
    return [];
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

  function pushCandidate(candidates, values, index) {
    const recent = values.slice(0, 24);
    if (recent.length < 4 || recent.length > 24) {
      return;
    }
    if (isMostlyLinearSequence(recent)) {
      return;
    }

    let score = recent.length * 8;
    if (recent.length >= 6 && recent.length <= 18) {
      score += 70;
    }
    if (index < 40) {
      score += 35;
    }
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
    const numbers = extractNumbersFromText(line);

    if (/^0\s+1\s+2\s+3\s+4\s+5\s+6\s+7\s+8\s+9\s+10/.test(line)) {
      break;
    }

    if (numbers.length === 1 && !hasLetters) {
      if (run.length === 0) {
        runStart = i;
      }
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

function readRecentFromVisibleNumberRows() {
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
      const parsed = extractNumbersFromText(raw);
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

function findRecentNumbersContainer() {
  const numberNodes = [];
  const allNodes = getAllElementsDeep();
  for (let i = 0; i < allNodes.length; i++) {
    const nums = extractNumbersFromText(getElementTextWithSpaces(allNodes[i]));
    if (nums.length === 1) {
      numberNodes.push(allNodes[i]);
    }
  }

  if (numberNodes.length === 0) {
    return null;
  }

  const parentScore = new Map();
  numberNodes.forEach((leaf) => {
    let p = leaf.parentElement;
    if (!p && typeof leaf.getRootNode === "function") {
      const root = leaf.getRootNode();
      p = root && root.host ? root.host : null;
    }
    while (p && p !== document.body) {
      if (!parentScore.has(p)) {
        parentScore.set(p, 0);
      }
      parentScore.set(p, parentScore.get(p) + 1);
      p = p.parentElement || (typeof p.getRootNode === "function" && p.getRootNode().host ? p.getRootNode().host : null);
    }
  });

  let bestParent = null;
  let bestScore = -1;
  parentScore.forEach((score, parent) => {
    if (score < 4 || score > 120) {
      return;
    }

    const name = getElementIdentity(parent);
    let bonus = 0;
    if (name.includes("history") || name.includes("recent") || name.includes("result") || name.includes("outcome") || name.includes("stat")) {
      bonus += 100;
    }
    if (name.includes("roulette")) {
      bonus += 20;
    }

    const finalScore = score + bonus;
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestParent = parent;
    }
  });

  if (!bestParent) {
    return null;
  }

  const list = readNumbersFromSelector("*", 0);
  const localList = [];
  const localNodes = [bestParent].concat(Array.from(bestParent.querySelectorAll ? bestParent.querySelectorAll("*") : []));
  localNodes.forEach((el) => {
    const nums = extractNumbersFromText(getElementTextWithSpaces(el));
    for (let i = 0; i < nums.length; i++) {
      localList.push(nums[i]);
    }
  });

  const merged = (localList.length > 0 ? localList : list).slice(0, 24);
  if (merged.length < 5) {
    return null;
  }

  return {
    element: bestParent,
    numbers: merged
  };
}

function getRecentNumbers() {
  const containerSelectors = [
    ".recent-numbers",
    ".roulette-history",
    ".recent-numbers-list",
    "[data-role='recent-numbers']",
    "[data-testid*='history']"
  ];

  for (let i = 0; i < containerSelectors.length; i++) {
    const nodes = querySelectorAllDeep(containerSelectors[i]);
    for (let j = 0; j < nodes.length; j++) {
      if (nodes[j]) {
        const values = extractNumbersFromText(getElementTextWithSpaces(nodes[j])).slice(0, 24);
        if (values.length >= 4) {
          return values;
        }
      }
    }
  }

  const selectorCandidates = [
    ".recent-numbers .number-cell span",
    "[data-role='recent-number']",
    "[data-role='recent-number'] span",
    ".recent-numbers-list span",
    ".roulette-history span",
    "[class*='history'] [class*='number']",
    "[class*='recent'] [class*='number']",
    "[class*='result'] [class*='number']",
    "[class*='statistics'] [class*='number']",
    "[data-testid*='history'] span",
    "[data-testid*='result'] span",
    "[data-testid*='history-item']",
    "[class*='history'] [class*='cell']",
    "[class*='history'] div"
  ];

  for (let i = 0; i < selectorCandidates.length; i++) {
    const values = readNumbersFromSelector(selectorCandidates[i], 4);
    if (values.length >= 4) {
      return values;
    }
  }

  const fallbackContainer = querySelectorAllDeep(".recent-numbers, .roulette-history, [class*='history'], [class*='recent'], [class*='result']")[0];
  if (fallbackContainer) {
    const values = extractNumbersFromText(getElementTextWithSpaces(fallbackContainer)).slice(0, 24);
    if (values.length >= 4) {
      return values;
    }
  }

  const bodyTextRunValues = readRecentFromBodyTextRuns();
  if (bodyTextRunValues.length >= 4) {
    return bodyTextRunValues;
  }

  const visibleRowValues = readRecentFromVisibleNumberRows();
  if (visibleRowValues.length >= 4) {
    return visibleRowValues;
  }

  const denseRowValues = readRecentFromDenseRows();
  if (denseRowValues.length >= 4) {
    return denseRowValues;
  }

  if (!heuristicCache || !heuristicCache.element || !document.body.contains(heuristicCache.element)) {
    heuristicCache = findRecentNumbersContainer();
  }

  if (heuristicCache && heuristicCache.numbers && heuristicCache.numbers.length >= 4) {
    return heuristicCache.numbers;
  }

  return [];
}

function getFavoriteNumbers(recentNumbers) {
  const explicit = getTableHotNumbers(false);
  if (explicit.length >= 3) {
    return uniquePreserveOrder(explicit, 5);
  }

  const source = Array.isArray(recentNumbers) ? recentNumbers.slice(0, 20) : [];
  const freq = {};
  source.forEach((n) => {
    freq[n] = (freq[n] || 0) + 1;
  });

  return Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, 5);
}

function getTableHotNumbers(requireFive) {
  const mustHaveFive = requireFive === true;
  const selectorCandidates = [
    ".zrr-favorites",
    "[data-role='hot-numbers']",
    "[class*='hot-number']",
    "[class*='hot']",
    "[class*='favorite']",
    "[class*='statistics']"
  ];

  const positiveHints = ["hot", "favorite", "favourite", "stat", "top", "best"];
  const negativeHints = ["recent", "history", "result", "winning", "cold", "last"];
  const candidates = [];

  function scoreCandidate(el, numbers) {
    const meta = ((el.className || "") + " " + (el.id || "") + " " + (el.getAttribute("data-role") || "")).toLowerCase();
    const ownText = getElementTextWithSpaces(el).toLowerCase();
    let score = numbers.length;

    for (let i = 0; i < positiveHints.length; i++) {
      if (meta.includes(positiveHints[i]) || ownText.includes(positiveHints[i])) {
        score += 20;
      }
    }

    for (let i = 0; i < negativeHints.length; i++) {
      if (meta.includes(negativeHints[i]) || ownText.includes(negativeHints[i])) {
        score -= 16;
      }
    }

    const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
    if (rect && rect.width > 120 && rect.height > 16 && rect.height < 320) {
      score += 8;
    }

    return score;
  }

  function getMetaBundle(el) {
    const nodes = [
      el,
      el ? el.parentElement : null,
      el ? el.previousElementSibling : null,
      el ? el.nextElementSibling : null,
      el && el.parentElement ? el.parentElement.previousElementSibling : null,
      el && el.parentElement ? el.parentElement.nextElementSibling : null
    ].filter(Boolean);

    return nodes.map((node) => {
      const identity = getElementIdentity(node);
      const text = getElementTextWithSpaces(node).toLowerCase().slice(0, 120);
      return `${identity} ${text}`;
    }).join(" ");
  }

  // Pass 1: direct semantic containers.
  for (let i = 0; i < selectorCandidates.length; i++) {
    const nodes = document.querySelectorAll(selectorCandidates[i]);
    for (let j = 0; j < nodes.length; j++) {
      const node = nodes[j];
      const parsed = uniquePreserveOrder(extractNumbersFromText(getElementTextWithSpaces(node)), 12);
      if (parsed.length === 0) {
        continue;
      }

      candidates.push({
        numbers: parsed,
        score: scoreCandidate(node, parsed)
      });
    }
  }

  // Pass 2: table/list rows containing hot/favorite labels.
  const rowNodes = document.querySelectorAll("tr, li, div, section");
  for (let i = 0; i < rowNodes.length; i++) {
    const node = rowNodes[i];
    const nodeText = getElementTextWithSpaces(node);
    if (!node || !nodeText || (node.children && node.children.length > 24)) {
      continue;
    }

    const rowText = nodeText.toLowerCase();
    if (!rowText.includes("hot") && !rowText.includes("favorite") && !rowText.includes("favourite")) {
      continue;
    }

    const parsed = uniquePreserveOrder(extractNumbersFromText(nodeText), 12);
    if (parsed.length < 3 || parsed.length > 10) {
      continue;
    }

    candidates.push({
      numbers: parsed,
      score: scoreCandidate(node, parsed) + 12
    });
  }

  // Pass 3: icon-only hot sidebars (fire/snow lists) with stacked single-number chips.
  const sidebarNodes = document.querySelectorAll("div, section, aside");
  for (let i = 0; i < sidebarNodes.length; i++) {
    const node = sidebarNodes[i];
    if (!node || !node.children || node.children.length < 3 || node.children.length > 10) {
      continue;
    }

    const rect = typeof node.getBoundingClientRect === "function" ? node.getBoundingClientRect() : null;
    if (!rect || rect.width < 24 || rect.width > 110 || rect.height < 90 || rect.height > 380) {
      continue;
    }

    const childValues = [];
    for (let j = 0; j < node.children.length; j++) {
      const child = node.children[j];
      const parsed = uniquePreserveOrder(extractNumbersFromText(getElementTextWithSpaces(child)), 2);
      if (parsed.length === 1) {
        childValues.push(parsed[0]);
      }
    }

    const values = uniquePreserveOrder(childValues, 8);
    if (values.length < 3 || values.length > 6) {
      continue;
    }

    const meta = getMetaBundle(node);
    let score = values.length * 14;
    if (/hot|fire|flame|burn/.test(meta)) score += 90;
    if (/cold|snow|ice/.test(meta)) score -= 120;
    if (rect.left >= 0 && rect.left < window.innerWidth * 0.35) score += 24;
    if (rect.left > window.innerWidth * 0.6) score -= 18;
    if (rect.top >= 0 && rect.top < window.innerHeight * 0.5) score += 10;

    candidates.push({ numbers: values, score });
  }

  if (candidates.length === 0) {
    return [];
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = uniquePreserveOrder(candidates[0].numbers, 5);
  if (mustHaveFive && best.length < 5) {
    return [];
  }

  return best;
}

function get3Neighborhood(number) {
  const idx = WHEEL_ORDER.indexOf(String(number));
  if (idx === -1) {
    return [];
  }

  const out = [];
  for (let i = 1; i <= 3; i++) {
    out.push(WHEEL_ORDER[(idx + i) % WHEEL_ORDER.length]);
    out.push(WHEEL_ORDER[(idx - i + WHEEL_ORDER.length) % WHEEL_ORDER.length]);
  }
  return uniquePreserveOrder(out);
}

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

function refreshMultiplierCardCache() {
  const now = Date.now();
  const source = ((document.body && (document.body.innerText || document.body.textContent)) || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (source) {
    const patterns = [
      /(?:^|\D)(0|[1-9][0-9]?)\D{0,8}(50|100|150|200|250|300|350|400|450|500)\s*[x×](?=\D|$)/gi,
      /(?:^|\D)(50|100|150|200|250|300|350|400|450|500)\s*[x×]\D{0,8}(0|[1-9][0-9]?)(?=\D|$)/gi,
      /(?:^|\D)(0|[1-9][0-9]?)\s*[x×]\s*(50|100|150|200|250|300|350|400|450|500)(?=\D|$)/gi
    ];

    patterns.forEach((regex, index) => {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(source)) !== null) {
        const number = index === 1 ? match[2] : match[1];
        const multiplier = index === 1 ? match[1] : match[2];
        const numVal = parseInt(number, 10);
        const mulVal = parseInt(multiplier, 10);
        if (Number.isNaN(numVal) || numVal < 0 || numVal > 36) {
          continue;
        }
        if (!MULTIPLIER_VALUES.includes(mulVal)) {
          continue;
        }

        const key = String(numVal);
        const existing = multiplierCardCache.get(key);
        if (!existing || mulVal > existing.value) {
          multiplierCardCache.set(key, { value: mulVal, seenAt: now });
        } else {
          existing.seenAt = now;
        }
      }
    });
  }

  Array.from(multiplierCardCache.keys()).forEach((key) => {
    const entry = multiplierCardCache.get(key);
    if (!entry || (now - entry.seenAt > MULTIPLIER_CARD_TTL_MS)) {
      multiplierCardCache.delete(key);
    }
  });
}

function detectWinnerMultiplier(currentWinner) {
  if (!currentWinner) {
    return null;
  }

  const winner = String(currentWinner);
  refreshMultiplierCardCache();

  const cached = multiplierCardCache.get(winner);
  if (cached && (Date.now() - cached.seenAt <= MULTIPLIER_CARD_TTL_MS)) {
    return cached.value;
  }

  const candidates = [];
  const roots = getSearchRoots();
  const selectors = [
    ".recent-numbers",
    ".roulette-history",
    ".recent-numbers-list",
    "[data-role='recent-numbers']",
    "[data-testid*='history']",
    "[class*='history']",
    "[class*='recent']",
    "[class*='result']"
  ];

  selectors.forEach((selector) => {
    roots.forEach((root) => {
      try {
        root.querySelectorAll(selector).forEach((node) => {
          const txt = (node.textContent || "").replace(/\s+/g, " ").trim();
          if (txt) {
            candidates.push(txt);
          }
        });
      } catch (_error) {
        // Ignore unsupported selectors per root.
      }
    });
  });

  const bodyText = ((document.body && (document.body.innerText || document.body.textContent)) || "")
    .replace(/\s+/g, " ")
    .trim();
  if (bodyText) {
    candidates.push(bodyText.slice(0, 4000));
  }

  const uniqCandidates = uniquePreserveOrder(candidates, 24);
  for (let i = 0; i < uniqCandidates.length; i++) {
    const text = uniqCandidates[i];

    // Cases like: 19 x100, 19 100x, x100 19, 100x 19
    const directPatterns = [
      new RegExp(`\\b${winner}\\b\\s*[x×]\\s*(50|100|150|200|250|300|350|400|450|500)\\b`, "i"),
      new RegExp(`\\b${winner}\\b\\s*(50|100|150|200|250|300|350|400|450|500)\\s*[x×]\\b`, "i"),
      new RegExp(`\\b[x×]\\s*(50|100|150|200|250|300|350|400|450|500)\\b\\D{0,80}\\b${winner}\\b`, "i"),
      new RegExp(`\\b(50|100|150|200|250|300|350|400|450|500)\\s*[x×]\\b\\D{0,80}\\b${winner}\\b`, "i")
    ];

    for (let j = 0; j < directPatterns.length; j++) {
      const m = text.match(directPatterns[j]);
      if (m && m[1]) {
        const value = parseInt(m[1], 10);
        if (MULTIPLIER_VALUES.includes(value)) {
          return value;
        }
      }
    }
  }

  return null;
}

function buildRoundKey(recentNumbers) {
  if (!Array.isArray(recentNumbers) || recentNumbers.length === 0) {
    return null;
  }
  return recentNumbers.slice(0, 4).join(",");
}

function registerRoundWinnerMultiplier(recentNumbers) {
  if (!Array.isArray(recentNumbers) || recentNumbers.length === 0) {
    return null;
  }

  const currentWinner = recentNumbers[0];
  if (!currentWinner) {
    return null;
  }

  const roundKey = buildRoundKey(recentNumbers);
  if (roundKey && roundKey === lastMultiplierCountedRoundKey) {
    return null;
  }

  const winnerMultiplier = detectWinnerMultiplier(currentWinner);
  if (winnerMultiplier === null) {
    return null;
  }

  multiplierHitCount += 1;
  lastMultiplierEvent = {
    winner: String(currentWinner),
    value: winnerMultiplier,
    at: Date.now()
  };
  if (roundKey) {
    lastMultiplierCountedRoundKey = roundKey;
  }

  return winnerMultiplier;
}

function detectTableType() {
  const source = [
    window.location.href || "",
    document.title || "",
    (document.body && (document.body.innerText || document.body.textContent) || "").slice(0, 1200)
  ].join(" ").toLowerCase();

  if (/lightning/.test(source)) {
    return "LIGHTNING";
  }
  if (/french/.test(source)) {
    return "DEALER_FRENCH";
  }
  return "DEALER";
}

function getNeighborhood(number, size) {
  const safeSize = Math.max(1, Math.min(6, parseInt(size, 10) || 3));
  const idx = WHEEL_ORDER.indexOf(String(number));
  if (idx === -1) {
    return [];
  }

  const out = [];
  for (let i = 1; i <= safeSize; i++) {
    out.push(WHEEL_ORDER[(idx + i) % WHEEL_ORDER.length]);
    out.push(WHEEL_ORDER[(idx - i + WHEEL_ORDER.length) % WHEEL_ORDER.length]);
  }

  return uniquePreserveOrder(out);
}

function seedRoundHistory(recentNumbers) {
  if (roundHistory.length > 0 || !Array.isArray(recentNumbers) || recentNumbers.length === 0) {
    return;
  }

  roundHistory = recentNumbers.slice(0, 100).map((n) => String(n));
}

function pushRoundWinnerToHistory(winner) {
  if (!winner) {
    return;
  }

  roundHistory.unshift(String(winner));
  if (roundHistory.length > 100) {
    roundHistory = roundHistory.slice(0, 100);
  }
}

function getHotNumbersFromLast100(limit) {
  const max = limit || 12;
  if (!Array.isArray(roundHistory) || roundHistory.length === 0) {
    return [];
  }

  const counts = {};
  roundHistory.forEach((n) => {
    const key = String(n);
    counts[key] = (counts[key] || 0) + 1;
  });

  const ranked = Object.keys(counts).sort((a, b) => {
    if (counts[b] !== counts[a]) {
      return counts[b] - counts[a];
    }
    return roundHistory.indexOf(a) - roundHistory.indexOf(b);
  });

  return ranked.slice(0, max);
}

function getOverlapScoresFromLast4(recentNumbers) {
  const last4 = (recentNumbers || []).slice(0, 4).map((n) => String(n));
  if (last4.length < 4) {
    return {};
  }

  const overlapCounts = {};
  last4.forEach((anchor) => {
    const zone = [String(anchor)].concat(get3Neighborhood(anchor));
    zone.forEach((n) => {
      const key = String(n);
      overlapCounts[key] = (overlapCounts[key] || 0) + 1;
    });
  });

  return overlapCounts;
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

function buildJackpotNumbersFromRules(recentNumbers) {
  return highStakeNumbers || [];
}

function buildLocalRecommendation(recentNumbers, favoriteNumbers) {
  return {
    betFavorites: betFavorites || [],
    betNumbers: betNumbers || [],
    highStakeNumbers: highStakeNumbers || []
  };
}

function highlightBetNumbers(highlight) {
  let maxBaseScore = 0;
  (highStakeNumbers || []).forEach(item => {
    let score = 0;
    if (item && typeof item === "object" && item.score !== undefined) {
      score = item.score;
    }
    if (score > maxBaseScore) {
      maxBaseScore = score;
    }
  });

  const shouldHighlight = highlight && maxBaseScore >= 50;

  const recent = getRecentNumbers();
  const last4 = (recent || []).slice(0, 4).map((n) => String(n));
  const currentWinner = last4[0];
  
  let goldenRingOnly = [];
  if (last4.length >= 4) {
    const overlapCounts = getOverlapScoresFromLast4(last4);
    goldenRingOnly = Object.keys(overlapCounts)
      .filter((n) => (overlapCounts[String(n)] || 0) > 1 && String(n) !== String(currentWinner));
  }

  const jackpotList = (highStakeNumbers || []).map((jp) => {
    if (jp && typeof jp === "object" && jp.number !== undefined) {
      return String(jp.number);
    }
    return String(jp);
  });

  const ALL_NUMBERS = Array.from({ length: 37 }, (_, i) => String(i));

  ALL_NUMBERS.forEach((value) => {
    const selectors = [
      `[data-bet-spot-id='${value}']`,
      `[data-number='${value}']`,
      `[data-spot='${value}']`,
      `[data-value='${value}']`,
      `[data-cell='${value}']`,
      `[aria-label*='${value}']`
    ];

    const isRecommended = Array.isArray(betNumbers) && betNumbers.includes(String(value));
    const isJackpot = jackpotList.includes(String(value));
    const isGold = goldenRingOnly.includes(String(value));

    selectors.forEach((sel) => {
      const elements = document.querySelectorAll(sel);
      elements.forEach((el) => {
        if (!el) {
          return;
        }

        const tag = el.tagName.toLowerCase();
        if (tag === "svg" || tag === "path" || tag === "rect") {
          if (shouldHighlight) {
            if (isRecommended) {
              if (isJackpot) {
                el.style.fill = "rgba(51, 153, 255, 0.7)";
              } else if (isGold) {
                el.style.fill = "rgba(255, 216, 77, 0.65)";
              } else {
                el.style.fill = "rgba(84, 180, 53, 0.5)";
              }
            } else {
              el.style.fill = "rgba(0, 0, 0, 0.85)";
            }
          } else {
            el.style.fill = "";
          }
        } else {
          if (shouldHighlight) {
            if (isRecommended) {
              if (isJackpot) {
                el.style.outline = "2.5px solid #3399ff";
                el.style.backgroundColor = "rgba(51, 153, 255, 0.35)";
              } else if (isGold) {
                el.style.outline = "2px solid #ffd84d";
                el.style.backgroundColor = "rgba(255, 216, 77, 0.3)";
              } else {
                el.style.outline = "2px solid rgba(84, 180, 53, 0.6)";
                el.style.backgroundColor = "rgba(84, 180, 53, 0.25)";
              }
            } else {
              el.style.outline = "none";
              el.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
            }
          } else {
            el.style.outline = "";
            el.style.backgroundColor = "";
          }
        }
      });
    });
  });
}

function getScrapedBalance() {
  const selectors = [
    ".balance-value",
    ".balance-amount",
    "[data-automation-id='balance-value']",
    "[data-role='balance-value']",
    ".balance-amount__value",
    ".currency-value",
    ".user-balance",
    ".sold-value",
    ".balance",
    ".sold"
  ];
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const txt = el.textContent.trim();
      const num = parseBalanceText(txt);
      if (num !== null) return num;
    }
  }

  const allElements = document.querySelectorAll("span, div, p");
  for (const el of allElements) {
    if (el.children.length === 0) {
      const txt = el.textContent.trim();
      if (/sold|balance|balans/i.test(txt)) {
        const num = parseBalanceText(txt);
        if (num !== null) return num;
      }
    }
  }

  for (const el of allElements) {
    if (el.children.length === 0) {
      const txt = el.textContent.trim();
      if (/(\d+([.,]\d{2})?\s*(?:RON|lei|EUR|USD|GBP|€|\$))/i.test(txt)) {
        const num = parseBalanceText(txt);
        if (num !== null) return num;
      }
    }
  }

  return null;
}

function parseBalanceText(text) {
  if (!text) return null;
  let cleaned = text.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  if (/,(\d{2})$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/\.(\d{2})$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  } else {
    const dotCount = (cleaned.match(/\./g) || []).length;
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (dotCount > 0 && commaCount === 0) {
      if (dotCount === 1 && !/\.\d{3}$/.test(cleaned)) {
        // Keep dot
      } else {
        cleaned = cleaned.replace(/\./g, '');
      }
    } else if (commaCount > 0 && dotCount === 0) {
      if (commaCount === 1 && !/,\d{3}$/.test(cleaned)) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (dotCount > 0 && commaCount > 0) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function sendDashboardUi(recentNumbers, favoriteNumbers, lightning = null) {
  const now = Date.now();
  if (now - lastDashboardSentAt < 120) {
    return;
  }
  lastDashboardSentAt = now;

  const payload = {
    type: "update-dashboard-ui",
    recentNumbers,
    favoriteNumbers,
    betFavorites,
    betNumbers,
    highStakeNumbers,
    lightning,
    dealer: getScrapedDealerName(),
    tableType: detectTableType(),
    multiplierHits: multiplierHitCount,
    lastMultiplierEvent,
    balance: getScrapedBalance()
  };

  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        zraLatestDashboard: {
          ...payload,
          updatedAt: now
        }
      });
    }
  } catch (_error) {
    // Storage is a backup path only; runtime messages remain the primary path.
  }

  safeSendRuntimeMessage(payload);
}

function getWon(currentWinner) {
  if (!Array.isArray(betNumbers) || !currentWinner) {
    return false;
  }
  return betNumbers.includes(currentWinner);
}

function updatePlay(currentWinner) {
  const winnerMultiplier = detectWinnerMultiplier(currentWinner);

  const playData = {
    type: "update-play",
    playTime: new Date().toLocaleTimeString(),
    playRound: ++loopCount,
    dealer: getScrapedDealerName(),
    tableType: detectTableType(),
    betOn: betNumbers,
    winner: currentWinner || "",
    win: getWon(currentWinner),
    favorite: highStakeNumbers.some((jp) => (jp && typeof jp === "object" ? jp.number : jp) === currentWinner),
    winnerMultiplier: winnerMultiplier,
    multiplierHits: multiplierHitCount
  };

  safeSendRuntimeMessage(playData);
  highlightBetNumbers(false);
}

async function updateDashboardInstant() {
  const recentNumbers = getRecentNumbers();
  logDashboardNumbers(recentNumbers);
  const favoriteNumbers = getFavoriteNumbers(recentNumbers);
  seedRoundHistory(recentNumbers);

  if (recentNumbers.length === 0) {
    return;
  }

  const currentTable = detectTableType();
  if (currentTable !== lastObservedTableType) {
    lastObservedTableType = currentTable;
    persistentJackpots = [];
    lastWinnerForJackpots = null;
    persistentJackpotsLt = [];
    lastWinnerForJackpotsLt = null;
    lastCnsHitWinnerLt = null;
  }

  let enabledPatternsLt = { zero: true, rep: true, cns: true, pref: true };
  let customPrefMappingLt = {};
  try {
    const res = await chrome.storage.local.get(["enabledPatternsLt", "customPrefMappingLt", "patternOrderLt"]);
    if (res.enabledPatternsLt) enabledPatternsLt = res.enabledPatternsLt;
    if (res.customPrefMappingLt) customPrefMappingLt = res.customPrefMappingLt;
    if (res.patternOrderLt) patternOrderLt = res.patternOrderLt;
  } catch (_e) {}

  const lastNum = String(recentNumbers[0]);
  const preferenceNumbers = enabledPatternsLt.pref
    ? (customPrefMappingLt[lastNum] !== undefined ? customPrefMappingLt[lastNum] : (defaultPrefMappingLt[lastNum] || []))
    : [];

  const engineState = {
    persistentJackpots,
    lastWinnerForJackpots,
    persistentJackpotsLt,
    lastWinnerForJackpotsLt,
    lastCnsHitWinnerLt
  };

  safeSendRuntimeMessage({
    type: "api",
    data: {
      action: "zrr",
      recentNumbers: recentNumbers.join(","),
      favoriteNumbers: favoriteNumbers.join(","),
      preferenceNumbers: preferenceNumbers.join(","),
      enabledPatterns: JSON.stringify(enabledPatternsLt),
      engineState: JSON.stringify(engineState),
      wheelOrder: WHEEL_ORDER.join(","),
      patternOrder: JSON.stringify(patternOrderLt)
    }
  }, (msg) => {
    if (!msg || msg.success !== true) {
      betFavorites = [];
      betNumbers = [];
      highStakeNumbers = [];
      highlightBetNumbers(false);
      sendDashboardUi(recentNumbers, favoriteNumbers);
      return;
    }

    if (msg.engineState) {
      persistentJackpots = msg.engineState.persistentJackpots || [];
      lastWinnerForJackpots = msg.engineState.lastWinnerForJackpots;
      persistentJackpotsLt = msg.engineState.persistentJackpotsLt || [];
      lastWinnerForJackpotsLt = msg.engineState.lastWinnerForJackpotsLt;
      lastCnsHitWinnerLt = msg.engineState.lastCnsHitWinnerLt;
    }

    if (msg.standard) {
      betFavorites = msg.standard.betFavorites || [];
      betNumbers = msg.standard.betNumbers || [];
      highStakeNumbers = msg.standard.highStakeNumbers || [];
    }

    highlightBetNumbers(true);
    sendDashboardUi(recentNumbers, favoriteNumbers, msg.lightning || null);
  });
}

function applyManualBet(number, neighborhoodSize) {
  if (!number) {
    return;
  }

  console.log("ZRA: applyManualBet triggered for number:", number, "neighborhoodSize:", neighborhoodSize);

  const selected = String(number);
  const around = getNeighborhood(selected, neighborhoodSize);

  betFavorites = [selected];
  betNumbers = uniquePreserveOrder([selected].concat(around));
  const recentNumbers = getRecentNumbers();
  seedRoundHistory(recentNumbers);
  highStakeNumbers = buildJackpotNumbersFromRules(recentNumbers);

  highlightBetNumbers(true);

  const favoriteNumbers = getFavoriteNumbers(recentNumbers);
  sendDashboardUi(recentNumbers, favoriteNumbers);

  // Click elements on the actual table sequentially with a 200ms delay to mimic human speed
  const allNumbersToClick = [selected].concat(around);
  console.log("ZRA: Sequential clicks scheduled for numbers:", allNumbersToClick);
  allNumbersToClick.forEach((val, idx) => {
    setTimeout(() => {
      clickBetSpot(val);
    }, idx * 200);
  });
}

function isElementInsideNonBettingArea(el) {
  let p = el;
  while (p && p !== document.body) {
    const id = (p.id || "").toLowerCase();
    const cls = getClassText(p).toLowerCase();
    const testid = (p.getAttribute ? p.getAttribute("data-testid") || "" : "").toLowerCase();
    
    if (id.includes("history") || id.includes("stat") || id.includes("report")) {
      return true;
    }
    if (cls.includes("history") || cls.includes("stat") || cls.includes("report")) {
      return true;
    }
    if (testid.includes("history") || testid.includes("stat") || testid.includes("report")) {
      return true;
    }
    p = p.parentElement;
  }
  return false;
}

function getClickableElementAt(el) {
  if (!el) return null;
  const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
  if (!rect || rect.width === 0 || rect.height === 0) return el;
  
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  let doc = el.ownerDocument || document;
  let target = doc.elementFromPoint(x, y);
  
  while (target && target.shadowRoot && typeof target.shadowRoot.elementFromPoint === "function") {
    const nextTarget = target.shadowRoot.elementFromPoint(x, y);
    if (!nextTarget || nextTarget === target) break;
    target = nextTarget;
  }
  
  return target || el;
}

function dispatchClickEvents(target, options) {
  try {
    // Helper to create and configure custom events (injecting isTrusted bypass and element offset properties)
    const createEvent = (Constructor, type, opts) => {
      const ev = new Constructor(type, opts);
      ev.__zraTrusted = true;
      
      const rect = target.getBoundingClientRect();
      const offsetX = Math.round(opts.clientX - rect.left);
      const offsetY = Math.round(opts.clientY - rect.top);
      
      Object.defineProperty(ev, 'offsetX', { value: offsetX, configurable: true, enumerable: true });
      Object.defineProperty(ev, 'offsetY', { value: offsetY, configurable: true, enumerable: true });
      Object.defineProperty(ev, 'layerX', { value: offsetX, configurable: true, enumerable: true });
      Object.defineProperty(ev, 'layerY', { value: offsetY, configurable: true, enumerable: true });
      
      return ev;
    };

    // Helper to dispatch touch events if touch is supported or as fallback
    const dispatchTouch = (type, opts) => {
      try {
        if (typeof Touch === "function" && typeof TouchEvent === "function") {
          const touch = new Touch({
            identifier: 1,
            target: target,
            clientX: opts.clientX,
            clientY: opts.clientY,
            screenX: opts.screenX,
            screenY: opts.screenY,
            pageX: opts.pageX,
            pageY: opts.pageY
          });
          const ev = new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            touches: [touch],
            targetTouches: [touch],
            changedTouches: [touch]
          });
          ev.__zraTrusted = true;
          target.dispatchEvent(ev);
        }
      } catch (_) {}
    };

    // Set temporary DOM attribute to flag these synchronous events as trusted to the main-world patch
    document.documentElement.setAttribute('data-zra-trusted', 'true');

    try {
      // 1. Hover sequence
      target.dispatchEvent(createEvent(PointerEvent, "pointerover", options));
      target.dispatchEvent(createEvent(PointerEvent, "pointerenter", options));
      target.dispatchEvent(createEvent(PointerEvent, "pointermove", options));

      // 2. Press down
      target.dispatchEvent(createEvent(PointerEvent, "pointerdown", options));
      target.dispatchEvent(createEvent(MouseEvent, "mousedown", options));
      dispatchTouch("touchstart", options);
    } finally {
      // Clean up synchronous trusted flag
      document.documentElement.removeAttribute('data-zra-trusted');
    }

    // 3. Delay of 50ms before releasing to simulate real click duration
    setTimeout(() => {
      // Re-apply trusted flag for the async release events
      document.documentElement.setAttribute('data-zra-trusted', 'true');
      try {
        const upOptions = Object.assign({}, options, { buttons: 0 });
        target.dispatchEvent(createEvent(PointerEvent, "pointerup", upOptions));
        target.dispatchEvent(createEvent(MouseEvent, "mouseup", upOptions));
        dispatchTouch("touchend", upOptions);
        
        // Dispatch both PointerEvent and MouseEvent clicks to maximize compatibility with the game's listeners
        target.dispatchEvent(createEvent(PointerEvent, "click", upOptions));
        target.dispatchEvent(createEvent(MouseEvent, "click", upOptions));
      } finally {
        // Clean up async trusted flag
        document.documentElement.removeAttribute('data-zra-trusted');
      }
    }, 50);
  } catch (err) {
    console.error("ZRA: Error dispatching click events:", err);
  }
}

function dispatchRealClick(el) {
  if (!el) return;
  
  const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
  if (!rect) return;
  
  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);

  // Safety check: do not click if coordinates are <= 5 to prevent hitting the lobby home exit button
  if (x <= 5 || y <= 5 || x > window.innerWidth || y > window.innerHeight) {
    console.warn("ZRA: Refusing to click at out-of-bounds or near-zero coordinates to protect lobby/close button:", x, y);
    return;
  }

  // Find topmost element actually at these coordinates to handle invisible event overlays
  let clickTarget = getClickableElementAt(el) || el;

  // Protect click context: if clickTarget is an SVG decoration (like chips, multipliers, lines) rather than
  // the rect element itself or a layout div, override it back to the original rect element to ensure bet registration.
  if (clickTarget !== el) {
    const targetTag = clickTarget.tagName.toLowerCase();
    const isOverlayDiv = targetTag === "div";
    if (!isOverlayDiv) {
      console.log("ZRA: Overriding clickTarget back to original element to prevent decorative SVG interception:", clickTarget.tagName);
      clickTarget = el;
    }
  }

  console.log("ZRA: clickBetSpot dispatching click at coordinates:", x, y, "on original element:", el.tagName, el.className, "and clickTarget:", clickTarget.tagName, clickTarget.className);

  const pageX = x + window.scrollX;
  const pageY = y + window.scrollY;

  const eventOptions = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    detail: 1,
    clientX: x,
    clientY: y,
    pageX: pageX,
    pageY: pageY,
    screenX: Math.round((window.screenLeft || window.screenX || 0) + x),
    screenY: Math.round((window.screenTop || window.screenY || 0) + y),
    button: 0,
    buttons: 1,
    which: 1,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse"
  };

  // Double-deliver click events to both the hit-test target (for overlays) and original element (for direct listeners)
  dispatchClickEvents(clickTarget, eventOptions);
  if (clickTarget !== el) {
    dispatchClickEvents(el, eventOptions);
  }
}

function clickBetSpot(value) {
  console.log("ZRA: clickBetSpot searching for number:", value);
  const specificSelectors = [
    `[data-bet-spot-id='Straight Up ${value}']`,
    `[data-bet-spot-id='straight up ${value}']`,
    `[aria-label='Straight Up ${value}']`,
    `[aria-label='straight up ${value}']`,
    `[aria-label='Straight up ${value}']`,
    `[data-bet-spot-id='${value}']`
  ];
  
  let clicked = false;
  
  // Try specific selectors first
  for (const sel of specificSelectors) {
    const matchingElements = querySelectorAllDeep(sel);
    const visibleElement = matchingElements.find(el => {
      const r = el.getBoundingClientRect();
      if (!r || r.width === 0 || r.height === 0) return false;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return cx > 5 && cy > 5 && cx < window.innerWidth && cy < window.innerHeight && !isElementInsideNonBettingArea(el);
    });
    if (visibleElement) {
      console.log("ZRA: clickBetSpot matched specific selector:", sel, "element:", visibleElement);
      dispatchRealClick(visibleElement);
      clicked = true;
      break;
    }
  }
  
  // Try fallback general selectors if not clicked
  if (!clicked) {
    const fallbackSelectors = [
      `[data-number='${value}']`,
      `[data-spot='${value}']`,
      `[data-value='${value}']`,
      `[data-cell='${value}']`,
      `[aria-label*='${value}']`
    ];
    for (const sel of fallbackSelectors) {
      const matchingElements = querySelectorAllDeep(sel);
      const visibleElement = matchingElements.find(el => {
        const r = el.getBoundingClientRect();
        if (!r || r.width === 0 || r.height === 0) return false;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        return cx > 5 && cy > 5 && cx < window.innerWidth && cy < window.innerHeight && !isElementInsideNonBettingArea(el);
      });
      if (visibleElement) {
        console.log("ZRA: clickBetSpot matched fallback selector:", sel, "element:", visibleElement);
        dispatchRealClick(visibleElement);
        clicked = true;
        break;
      }
    }
  }
  
  // Fallback to searching all elements with aria-label containing straight up and the exact number
  if (!clicked) {
    const elements = querySelectorAllDeep("[aria-label]");
    const regex = new RegExp(`\\b${value}\\b`);
    const visibleEl = elements.find(el => {
      const r = el.getBoundingClientRect();
      if (!r || r.width === 0 || r.height === 0) return false;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx <= 5 || cy <= 5 || cx >= window.innerWidth || cy >= window.innerHeight || isElementInsideNonBettingArea(el)) return false;
      const label = (el.getAttribute("aria-label") || "").toLowerCase();
      return label.includes("straight up") && regex.test(label);
    });
    if (visibleEl) {
      console.log("ZRA: clickBetSpot matched regex straight up label:", visibleEl.getAttribute("aria-label"), "element:", visibleEl);
      dispatchRealClick(visibleEl);
      clicked = true;
    }
  }

  if (!clicked) {
    console.warn("ZRA: clickBetSpot failed to find any clickable elements for number:", value);
  }
}

function onPossibleSpinChange() {
  if (!auto) {
    return;
  }

  const recent = getRecentNumbers();
  if (recent.length === 0) {
    return;
  }

  const currentWinner = recent[0];
  if (!currentWinner) {
    return;
  }

  // Multiplier badge can appear shortly after winner changes; keep checking and register once per round.
  registerRoundWinnerMultiplier(recent);

  if (currentWinner !== lastWinner) {
    const previousWinner = lastWinner;
    lastWinner = currentWinner;
    pushRoundWinnerToHistory(currentWinner);

    if (previousWinner !== null) {
      updatePlay(currentWinner);
    }

    updateDashboardInstant();
  }
}

function startPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  pollTimer = setInterval(() => {
    onPossibleSpinChange();
  }, 400);
}

function stopObservers() {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  if (observeRetryTimer) {
    clearTimeout(observeRetryTimer);
    observeRetryTimer = null;
  }

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  observedElement = null;
}

function findObserveTarget() {
  const selectorTarget = document.querySelector(".recent-numbers, [data-role='recent-number'], .recent-numbers-list, .roulette-history, [class*='history'], [class*='recent'], [class*='result']");
  if (selectorTarget) {
    return selectorTarget;
  }

  if (!heuristicCache || !heuristicCache.element || !document.body.contains(heuristicCache.element)) {
    heuristicCache = findRecentNumbersContainer();
  }

  return heuristicCache ? heuristicCache.element : null;
}

function observe() {
  const target = findObserveTarget();
  startPolling();

  if (!target) {
    updateDashboardInstant();
    observeRetryTimer = setTimeout(observe, 1200);
    return;
  }

  observedElement = target;

  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  mutationObserver = new MutationObserver(() => {
    onPossibleSpinChange();
  });

  mutationObserver.observe(observedElement, { childList: true, subtree: true, characterData: true });

  const recent = getRecentNumbers();
  if (recent.length > 0) {
    lastWinner = recent[0];
    seedRoundHistory(recent);
    updateDashboardInstant();
  }
}

function handleRuntimeMessage(request) {
  if (request.type === "toggle") {
    auto = !auto;
  }

  if (request.type === "update-dashboard") {
    startLicensedObservation();
  }

  if (request.type === "logout") {
    auto = false;
    lastWinner = null;
    stopObservers();
  }

  if (request.type === "manual-bet") {
    applyManualBet(request.number, request.neighborhoodSize);
  }

  if (request.type === "update-pattern-order") {
    patternOrderLt = request.order;
    updateDashboardInstant();
  }

  if (request.type === "update-pattern-settings") {
    enabledPatternsLt = request.enabledPatternsLt;
    updateDashboardInstant();
  }
}

async function hasLocalLicenseAccess() {
  try {
    const state = await chrome.storage.local.get([
      "authenticated",
      "zrrLicense",
      "zrrInstallationId"
    ]);
    const license = state && state.zrrLicense;
    const expiresAt = Date.parse((license && license.expiresAt) || "");
    return (
      !!state.authenticated &&
      !!license &&
      license.deviceId === state.zrrInstallationId &&
      Number.isFinite(expiresAt) &&
      expiresAt > Date.now()
    );
  } catch (_error) {
    return false;
  }
}

async function startLicensedObservation() {
  if (!(await hasLocalLicenseAccess())) {
    auto = false;
    stopObservers();
    return;
  }
  auto = true;
  stopObservers();
  observe();
  updateDashboardInstant();
}

window[ZRA_INSTANCE_KEY] = {
  cleanup() {
    auto = false;
    lastWinner = null;
    stopObservers();
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  }
};

startLicensedObservation();
chrome.runtime.onMessage.addListener(handleRuntimeMessage);
}
