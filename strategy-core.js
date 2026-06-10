(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ZenRouletteStrategy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const WHEEL_ORDER = [
    "0", "32", "15", "19", "4", "21", "2", "25", "17", "34", "6", "27", "13", "36", "11", "30", "8", "23", "10", "5", "24", "16", "33", "1", "20", "14", "31", "9", "22", "18", "29", "7", "28", "12", "35", "3", "26"
  ];

  const DEFAULT_PATTERNS = { zero: true, rep: true, cns: true, pref: true };

  function normalizeList(values) {
    return Array.isArray(values) ? values.map((n) => String(n)) : [];
  }

  function uniquePreserveOrder(values, limit) {
    const seen = new Set();
    const out = [];
    normalizeList(values).forEach((value) => {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
      out.push(value);
    });
    return limit ? out.slice(0, limit) : out;
  }

  function getWheelOrder(wheelOrder) {
    return Array.isArray(wheelOrder) && wheelOrder.length > 0
      ? wheelOrder.map((n) => String(n))
      : WHEEL_ORDER;
  }

  function get3Neighborhood(number, wheelOrder) {
    const order = getWheelOrder(wheelOrder);
    const idx = order.indexOf(String(number));
    if (idx === -1) {
      return [];
    }

    const out = [];
    for (let i = 1; i <= 3; i++) {
      out.push(order[(idx + i) % order.length]);
      out.push(order[(idx - i + order.length) % order.length]);
    }
    return uniquePreserveOrder(out);
  }

  function buildZoneFromAnchors(anchors, wheelOrder) {
    const counts = {};
    const ordered = [];

    normalizeList(anchors).forEach((anchor) => {
      const zone = [String(anchor)].concat(get3Neighborhood(anchor, wheelOrder));
      zone.forEach((n) => {
        const key = String(n);
        counts[key] = (counts[key] || 0) + 1;
        if (!ordered.includes(key)) {
          ordered.push(key);
        }
      });
    });

    const overlapOrdered = ordered.filter((n) => counts[String(n)] > 1);
    return {
      zoneNumbers: ordered,
      overlapOrdered,
      overlapSet: new Set(overlapOrdered)
    };
  }

  function isJackpotActiveInGolden(jpNumber, goldenRings, wheelOrder) {
    const order = getWheelOrder(wheelOrder);
    const rings = normalizeList(goldenRings);
    const target = String(jpNumber);
    if (rings.includes(target)) {
      return true;
    }

    const idx = order.indexOf(target);
    if (idx === -1) {
      return false;
    }

    const leftNeighbor = order[(idx - 1 + order.length) % order.length];
    const rightNeighbor = order[(idx + 1) % order.length];
    return rings.includes(leftNeighbor) || rings.includes(rightNeighbor);
  }

  function calculateJackpotScore(numStr, recentNumbers, favoriteNumbers, wheelOrder) {
    const order = getWheelOrder(wheelOrder);
    const last4 = normalizeList(recentNumbers).slice(0, 4);
    const currentWinner = last4[0];
    const target = String(numStr);

    if (target === currentWinner) {
      return 0;
    }

    let score = 0;
    let overlapCount = 0;
    const neighborhoodWeight = [12, 10, 8, 6];

    last4.forEach((anchor, index) => {
      const neighborhood = get3Neighborhood(anchor, order);
      if (neighborhood.includes(target) || anchor === target) {
        overlapCount += neighborhoodWeight[index] || 6;
      }
    });
    score += Math.min(35, overlapCount);

    let neighborScore = 0;
    const neighborWeights = [25, 15, 10, 5];
    last4.forEach((anchor, index) => {
      const idx = order.indexOf(anchor);
      if (idx === -1) {
        return;
      }
      const leftNeighbor = order[(idx - 1 + order.length) % order.length];
      const rightNeighbor = order[(idx + 1) % order.length];
      if (target === leftNeighbor || target === rightNeighbor) {
        neighborScore = Math.max(neighborScore, neighborWeights[index]);
      }
    });
    score += neighborScore;

    const favs = normalizeList(favoriteNumbers);
    const favIndex = favs.indexOf(target);
    if (favIndex !== -1) {
      if (favIndex === 0) score += 20;
      else if (favIndex === 1) score += 18;
      else if (favIndex === 2) score += 16;
      else if (favIndex <= 4) score += 14;
      else score += 10;
    }

    let hitScore = 0;
    normalizeList(recentNumbers).slice(0, 12).forEach((value, index) => {
      if (index === 0 || value !== target) {
        return;
      }
      if (index === 1) hitScore = Math.max(hitScore, 20);
      else if (index === 2) hitScore = Math.max(hitScore, 15);
      else if (index === 3) hitScore = Math.max(hitScore, 10);
      else hitScore = Math.max(hitScore, 5);
    });
    score += hitScore;

    return Math.min(100, score);
  }

  function createStandardJackpotEngine(options) {
    const settings = options || {};
    const order = getWheelOrder(settings.wheelOrder);
    let persistentJackpots = [];
    let lastWinnerForJackpots = null;

    function build(input) {
      const data = Array.isArray(input) ? { recentNumbers: input } : (input || {});
      const recentNumbers = normalizeList(data.recentNumbers);
      const favoriteNumbers = normalizeList(data.favoriteNumbers);
      const last4 = recentNumbers.slice(0, 4);
      if (last4.length < 4) {
        return [];
      }

      const currentWinner = data.currentWinner ? String(data.currentWinner) : last4[0];
      const goldenRings = data.goldenRings
        ? normalizeList(data.goldenRings)
        : buildZoneFromAnchors(last4, order).overlapOrdered.filter((n) => n !== currentWinner);

      if (currentWinner !== lastWinnerForJackpots) {
        lastWinnerForJackpots = currentWinner;
        persistentJackpots.forEach((jp) => {
          jp.remainingRounds -= 1;
        });
        persistentJackpots = persistentJackpots.filter((jp) => jp.remainingRounds > 0);
      }

      persistentJackpots.forEach((jp) => {
        if (isJackpotActiveInGolden(jp.number, goldenRings, order)) {
          jp.remainingRounds = 4;
        }
      });

      const scoredCandidates = [];
      order.forEach((numStr) => {
        if (numStr === currentWinner) {
          return;
        }

        const baseScore = calculateJackpotScore(numStr, recentNumbers, favoriteNumbers, order);
        const existing = persistentJackpots.find((jp) => jp.number === numStr);
        const persistenceBonus = existing && existing.remainingRounds > 0 ? 20 : 0;

        scoredCandidates.push({
          number: numStr,
          baseScore,
          totalScore: baseScore + persistenceBonus,
          isPersistent: !!existing
        });
      });

      scoredCandidates.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
        return order.indexOf(a.number) - order.indexOf(b.number);
      });

      persistentJackpots = scoredCandidates.slice(0, 4).map((candidate) => {
        const existing = persistentJackpots.find((jp) => jp.number === candidate.number);
        return {
          number: candidate.number,
          remainingRounds: existing ? existing.remainingRounds : 4,
          score: candidate.baseScore
        };
      });

      return persistentJackpots.slice(0, 4);
    }

    return {
      build,
      reset: function () {
        persistentJackpots = [];
        lastWinnerForJackpots = null;
      },
      getState: function () {
        return {
          persistentJackpots: persistentJackpots.map((jp) => Object.assign({}, jp)),
          lastWinnerForJackpots
        };
      }
    };
  }

  function getConsecutiveNeighbors(n) {
    const num = parseInt(n, 10);
    if (Number.isNaN(num) || num === 0) {
      return [];
    }

    let prev = num - 1;
    let next = num + 1;
    if (prev < 1) prev = 36;
    if (next > 36) next = 1;
    return [String(prev), String(next)];
  }

  function areConsecutive(a, b) {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (Number.isNaN(numA) || Number.isNaN(numB) || numA === 0 || numB === 0) {
      return false;
    }
    const diff = Math.abs(numA - numB);
    return diff === 1 || (numA === 1 && numB === 36) || (numA === 36 && numB === 1);
  }

  function hasAdjacentConsecutivePair(values) {
    const list = normalizeList(values);
    for (let i = 0; i < list.length - 1; i++) {
      if (areConsecutive(list[i], list[i + 1])) {
        return true;
      }
    }
    return false;
  }

  function getLightningConsecutiveNumbers(recentNumbers, options) {
    const settings = options || {};
    const enabled = Object.assign({}, DEFAULT_PATTERNS, settings.enabledPatterns || {});
    const recent = normalizeList(recentNumbers);
    if (!enabled.cns || recent.length < 2) {
      return { triggerSet: new Set(), neighborSet: new Set() };
    }

    const lastCnsHitWinner = settings.lastCnsHitWinner;
    if (lastCnsHitWinner !== null && lastCnsHitWinner !== undefined) {
      const hitIdx = recent.indexOf(String(lastCnsHitWinner));
      if (hitIdx !== -1) {
        const postHitSpins = recent.slice(0, hitIdx);
        if (!hasAdjacentConsecutivePair(postHitSpins.slice(0, 4))) {
          return { triggerSet: new Set(), neighborSet: new Set() };
        }
      }
    }

    const last5 = recent.slice(0, 5);
    const triggerSet = new Set();
    const neighborSet = new Set();

    for (let i = 0; i < last5.length - 1; i++) {
      if (!areConsecutive(last5[i], last5[i + 1])) {
        continue;
      }

      triggerSet.add(last5[i]);
      triggerSet.add(last5[i + 1]);
      getConsecutiveNeighbors(last5[i]).forEach((neighbor) => neighborSet.add(neighbor));
      getConsecutiveNeighbors(last5[i + 1]).forEach((neighbor) => neighborSet.add(neighbor));
    }

    return { triggerSet, neighborSet };
  }

  function getRepeatPatternStateFromHistory(recentNumbers) {
    const recent = normalizeList(recentNumbers);
    if (recent.length < 3) {
      return false;
    }

    // Recent is newest-first. REP is active only if a trigger happened in the
    // last 8 rounds: current round repeats one of the previous 2 rounds.
    const window = recent.slice(0, 10);
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

  function getLightningPatternNumbers(recentNumbers, options) {
    const enabled = Object.assign({}, DEFAULT_PATTERNS, (options || {}).enabledPatterns || {});
    const recent = normalizeList(recentNumbers);
    if (!enabled.rep || recent.length < 2 || !getRepeatPatternStateFromHistory(recent)) {
      return [];
    }

    const first = recent[0];
    const second = recent[1];
    if (first === second && recent.length >= 3) {
      return [first, recent[2]];
    }
    return [first, second];
  }

  function getZeroRuleJackpotNumbers(recentNumbers, options) {
    const enabled = Object.assign({}, DEFAULT_PATTERNS, (options || {}).enabledPatterns || {});
    const recent = normalizeList(recentNumbers);
    if (!enabled.zero || recent.length < 2) {
      return [];
    }

    const zeroRuleSet = new Set();
    for (let i = 0; i < Math.min(recent.length, 8); i++) {
      if (recent[i] !== "0" || i + 1 >= recent.length) {
        continue;
      }
      const prev = recent[i + 1];
      const neighbors = getConsecutiveNeighbors(prev);
      const spunAfterZero = new Set(recent.slice(0, i));
      const hasHit = neighbors.some((n) => spunAfterZero.has(n));
      if (!hasHit) {
        neighbors.forEach((neighbor) => zeroRuleSet.add(neighbor));
      }
    }
    return Array.from(zeroRuleSet);
  }

  function createLightningJackpotEngine(options) {
    const settings = options || {};
    const order = getWheelOrder(settings.wheelOrder);
    let enabledPatterns = Object.assign({}, DEFAULT_PATTERNS, settings.enabledPatterns || {});
    let persistentJackpots = [];
    let lastWinnerForJackpots = null;
    let lastCnsHitWinner = null;

    function build(input) {
      const data = Array.isArray(input) ? { recentNumbers: input } : (input || {});
      const recentNumbers = normalizeList(data.recentNumbers);
      const currentWinner = data.currentWinner ? String(data.currentWinner) : recentNumbers[0];
      const enabled = Object.assign({}, enabledPatterns, data.enabledPatterns || {});

      if (recentNumbers.length < 4) {
        return [];
      }

      const patternRecommendRepeats = getLightningPatternNumbers(recentNumbers, { enabledPatterns: enabled }).map(String);

      if (currentWinner && currentWinner !== lastWinnerForJackpots) {
        lastWinnerForJackpots = currentWinner;

        const isCnsHit = persistentJackpots.some((jp) => jp.source === "CNS" && jp.number === currentWinner);
        if (isCnsHit) {
          lastCnsHitWinner = currentWinner;
          persistentJackpots = persistentJackpots.filter((jp) => jp.source !== "CNS");
        }

        persistentJackpots.forEach((jp) => {
          jp.remainingRounds -= 1;
        });
        persistentJackpots = persistentJackpots.filter((jp) => jp.remainingRounds > 0);

        const consec = getLightningConsecutiveNumbers(recentNumbers, {
          enabledPatterns: enabled,
          lastCnsHitWinner
        });
        if (consec.triggerSet.size > 0) {
          lastCnsHitWinner = null;
          getConsecutiveNeighbors(currentWinner).forEach((numStr) => {
            if (numStr === currentWinner) {
              return;
            }
            const existing = persistentJackpots.find((jp) => jp.number === numStr && jp.source === "CNS");
            if (existing) {
              existing.remainingRounds = 2;
            } else {
              persistentJackpots.push({
                number: numStr,
                remainingRounds: 2,
                source: "CNS",
                score: 100
              });
            }
          });
        }
      }

      patternRecommendRepeats.forEach((numStr) => {
        const existing = persistentJackpots.find((jp) => jp.number === numStr && jp.source === "REP");
        if (existing) {
          existing.remainingRounds = 4;
        } else {
          persistentJackpots.push({
            number: numStr,
            remainingRounds: 4,
            source: "REP",
            score: 100
          });
        }
      });

      persistentJackpots.sort((a, b) => {
        if (b.remainingRounds !== a.remainingRounds) {
          return b.remainingRounds - a.remainingRounds;
        }
        return order.indexOf(a.number) - order.indexOf(b.number);
      });

      return persistentJackpots.slice(0, 4);
    }

    return {
      build,
      setEnabledPatterns: function (nextPatterns) {
        enabledPatterns = Object.assign({}, enabledPatterns, nextPatterns || {});
      },
      reset: function () {
        persistentJackpots = [];
        lastWinnerForJackpots = null;
        lastCnsHitWinner = null;
      },
      getState: function () {
        return {
          persistentJackpots: persistentJackpots.map((jp) => Object.assign({}, jp)),
          lastWinnerForJackpots,
          lastCnsHitWinner
        };
      }
    };
  }

  function buildLightningRecommendation(input) {
    const data = input || {};
    const recentNumbers = normalizeList(data.recentNumbers);
    const enabledPatterns = Object.assign({}, DEFAULT_PATTERNS, data.enabledPatterns || {});
    const engine = data.engine || createLightningJackpotEngine({
      enabledPatterns,
      wheelOrder: data.wheelOrder
    });
    const currentWinner = data.currentWinner ? String(data.currentWinner) : recentNumbers[0];
    const baseJps = engine.build({
      recentNumbers,
      currentWinner,
      enabledPatterns
    });
    const prefJps = enabledPatterns.pref ? uniquePreserveOrder(data.preferenceNumbers || []) : [];
    const zeroRuleJps = getZeroRuleJackpotNumbers(recentNumbers, { enabledPatterns });

    const highStakeNumbers = [];
    const seen = new Set();
    function pushJp(item) {
      const numStr = item && typeof item === "object" && item.number !== undefined ? String(item.number) : String(item);
      if (!numStr || seen.has(numStr)) {
        return;
      }
      seen.add(numStr);
      highStakeNumbers.push(item && typeof item === "object" ? item : { number: numStr, score: 100 });
    }

    zeroRuleJps.forEach((num) => pushJp({ number: String(num), score: 100, source: "ZERO" }));
    prefJps.forEach((num) => pushJp({ number: String(num), score: 100, source: "PREF" }));
    baseJps.forEach(pushJp);

    const finalHighStakeNumbers = highStakeNumbers.slice(0, 4);
    const jackpotNumbers = finalHighStakeNumbers.map((item) => String(item.number));
    const zoneStrategy = buildZoneFromAnchors(jackpotNumbers, data.wheelOrder);
    const patternNumbers = zoneStrategy.zoneNumbers.slice();
    prefJps.forEach((num) => {
      const numStr = String(num);
      if (!patternNumbers.includes(numStr)) {
        patternNumbers.push(numStr);
      }
    });

    return {
      highStakeNumbers: finalHighStakeNumbers,
      jackpotNumbers,
      patternNumbers,
      goldenRingNumbers: zoneStrategy.overlapOrdered,
      zoneStrategy,
      isWaitRound: recentNumbers.length < 4 || patternNumbers.length === 0
    };
  }

  return {
    WHEEL_ORDER,
    DEFAULT_PATTERNS,
    uniquePreserveOrder,
    get3Neighborhood,
    buildZoneFromAnchors,
    isJackpotActiveInGolden,
    calculateJackpotScore,
    createStandardJackpotEngine,
    getConsecutiveNeighbors,
    areConsecutive,
    getLightningConsecutiveNumbers,
    getRepeatPatternStateFromHistory,
    getLightningPatternNumbers,
    getZeroRuleJackpotNumbers,
    createLightningJackpotEngine,
    buildLightningRecommendation
  };
});
