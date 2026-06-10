(function() {
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

  if (!isRelevantRouletteFrame()) {
    return;
  }

  if (window.__zraMainWorldInjected) {
    return;
  }
  window.__zraMainWorldInjected = true;

  console.log("ZRA main world helper injected into frame:", window.location.href);

  try {
    if (EventTarget.prototype.addEventListener.__zraPatched) {
      return;
    }

    const originalAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (listener) {
        let wrapped = listener.__zraWrapped;
        if (!wrapped) {
          if (typeof listener === "function") {
            wrapped = function(event) {
              const isTrustedBypass = event && (
                event.__zraTrusted || 
                (!event.isTrusted && document.documentElement.getAttribute('data-zra-trusted') === 'true')
              );
              if (isTrustedBypass) {
                const proxy = new Proxy(event, {
                  get: function(target, prop) {
                    if (prop === "isTrusted") {
                      return true;
                    }
                    const val = target[prop];
                    if (typeof val === "function") {
                      return val.bind(target);
                    }
                    return val;
                  }
                });
                return listener.call(this, proxy);
              }
              return listener.call(this, event);
            };
          } else if (typeof listener.handleEvent === "function") {
            wrapped = {
              handleEvent: function(event) {
                const isTrustedBypass = event && (
                  event.__zraTrusted || 
                  (!event.isTrusted && document.documentElement.getAttribute('data-zra-trusted') === 'true')
                );
                if (isTrustedBypass) {
                  const proxy = new Proxy(event, {
                    get: function(target, prop) {
                      if (prop === "isTrusted") {
                        return true;
                      }
                      const val = target[prop];
                      if (typeof val === "function") {
                        return val.bind(target);
                      }
                      return val;
                    }
                  });
                  return listener.handleEvent(proxy);
                }
                return listener.handleEvent(event);
              }
            };
          }
          if (wrapped) {
            wrapped.__zraOriginal = listener;
            listener.__zraWrapped = wrapped;
          }
        }
        return originalAdd.call(this, type, wrapped || listener, options);
      }
      return originalAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.addEventListener.__zraPatched = true;

    const originalRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      if (listener) {
        const wrapped = listener.__zraWrapped || listener;
        return originalRemove.call(this, type, wrapped, options);
      }
      return originalRemove.call(this, type, listener, options);
    };

    // Monkeypatch on-event properties (like onclick, onmousedown) to automatically wrap them via addEventListener
    const patchOnProperty = (proto, propName, eventType) => {
      const hiddenProp = '__zra_on' + propName;
      Object.defineProperty(proto, propName, {
        get: function() {
          return this[hiddenProp];
        },
        set: function(listener) {
          if (this[hiddenProp]) {
            this.removeEventListener(eventType, this[hiddenProp]);
          }
          this[hiddenProp] = listener;
          if (listener) {
            this.addEventListener(eventType, listener);
          }
        },
        configurable: true,
        enumerable: true
      });
    };

    const propsToPatch = [
      ['click', 'click'],
      ['mousedown', 'mousedown'],
      ['mouseup', 'mouseup'],
      ['pointerdown', 'pointerdown'],
      ['pointerup', 'pointerup'],
      ['touchstart', 'touchstart'],
      ['touchend', 'touchend']
    ];

    [HTMLElement.prototype, SVGElement.prototype, Document.prototype, Window.prototype].forEach(proto => {
      propsToPatch.forEach(([prop, type]) => {
        try {
          patchOnProperty(proto, 'on' + prop, type);
        } catch (e) {}
      });
    });
  } catch (e) {
    console.error("ZRA: main world helper patch error:", e);
  }
})();
