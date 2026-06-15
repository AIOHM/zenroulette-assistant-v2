# ZenRoulette Assistant v2

Chrome side-panel assistant for roulette session tracking, live pattern review, and disciplined decision support.

ZenRoulette Assistant reads recent roulette outcomes from the active table page and turns them into a focused side-panel workspace. It helps players observe patterns, test strategy ideas, keep session context, export reports, and stay inside a repeatable process instead of reacting emotionally to each spin.

Roulette is still a game of chance. This extension is an analysis, learning, and discipline tool. It does not guarantee profit, predict future outcomes, or remove gambling risk.

## Highlights

- Chrome Manifest V3 side-panel interface.
- Live roulette history extraction from supported table pages and embedded game frames.
- Lightning and Dealer workspaces with wheel visualization, pattern chips, jackpot groups, and strategy panels.
- Session dashboard with dealer/table context, play log, stats, and recording controls.
- Pattern Pre-Check reports with JSON/CSV export.
- Active Pattern controls for Zero Guard, Consecutive Neighbor, Repeat, and Preference patterns.
- Import/export for layouts, preference maps, pattern configs, and session data.
- TradingView-style strategy builder with custom strategies, backtesting, and community sharing.
- Optional Gemini assistant integration using a user-provided API key stored in local Chrome extension storage.
- ZenRoulette account login and 24-hour license request/activation flow.

## Current Version

`2.1.6`

See [CHANGELOG.md](CHANGELOG.md) and [RELEASE_NOTES.md](RELEASE_NOTES.md) for recent changes.

## Download

Stable public ZIP:

https://zenroulette.com/get/extension/

This repository contains the unpacked extension source. Versioned release bundles may also be published as GitHub tags.

## Install From ZIP

1. Download the stable ZIP from the link above.
2. Unzip it on your computer.
3. Open Chrome and visit `chrome://extensions/`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the unzipped `ZenRoulette Assistant` folder.
7. Pin the extension, open a roulette table, then open the extension from the Chrome toolbar or side panel.

## Install From Source

```bash
git clone https://github.com/AIOHM/zenroulette-assistant-v2.git
cd zenroulette-assistant-v2
```

Then load the repository folder through `chrome://extensions/` using **Load unpacked**.

No build step is required for the current source package.

## Main Workspaces

### Lightning

Fast roulette workspace for recent outcomes, Lightning-specific pattern families, active pattern chips, jackpot candidates, golden overlaps, and exit-strategy math.

### Dealer

Standard dealer strategy workspace with wheel telemetry, bet groups, jackpot groups, recommendation state, and table context.

### Session

Session control center for starting/stopping a play session, recording table data, reviewing stats, and exporting logs.

### TradingView of Roulette

Strategy workspace for creating custom pattern rules, backtesting against scraped history, saving strategy presets, following community creators, and sharing patterns to the ZenRoulette forum.

### Account

Login, membership state, device-bound license status, 24-hour license request, and long license-code activation.

## Project Structure

```text
.
├── manifest.json       # Chrome extension manifest
├── popup.html          # Side-panel UI, styles, and tab markup
├── top.js              # Main side-panel logic and UI orchestration
├── background.js       # Service worker, API relay, tab targeting, exports
├── app.js              # Content script for roulette table/history extraction
├── main-world.js       # Main-world event/frame helper script
├── strategy-core.js    # Public placeholder; protected calculations run server-side
├── icons/              # Extension icons
├── ABOUT.md            # Short project overview
├── CHANGELOG.md        # Version history
└── RELEASE_NOTES.md    # Current release notes
```

## Permissions

The extension uses these Chrome permissions:

- `storage`: save account state, layouts, strategy settings, Gemini key, and local license state.
- `scripting`: inject helpers into active roulette tabs/frames.
- `tabs` and `webNavigation`: find the relevant roulette tab and communicate with embedded frames.
- `downloads`: export CSV/JSON reports and configuration files.
- `sidePanel`: open the assistant as a Chrome side panel.
- `tabCapture`: reserved for session capture/recording workflows.
- `host_permissions` for `http://*/*` and `https://*/*`: required because supported roulette tables are often nested inside third-party game frames and changing casino hostnames.

## API And License Flow

The background service worker relays public and authenticated requests to the ZenRoulette API:

- `https://zenroulette.com/api/index.php`
- `https://www.zenroulette.com/api/index.php`
- `https://zenroulette.com.local/api/index.php` for local development fallback

Public license actions include:

- `license_request`
- `license_activate`
- `license_status`

Authenticated account and community actions use the saved security token after login.

## Development Checks

There is no bundled test runner in this source package yet. Before packaging a release, run syntax checks on the JavaScript entry points:

```bash
node --check app.js
node --check background.js
node --check main-world.js
node --check top.js
```

Then load the unpacked extension in Chrome and verify:

- the side panel opens from the toolbar action,
- Account login and license status render correctly,
- Lightning and Dealer tabs unlock for a valid account/license,
- recent numbers update on a supported roulette table,
- pattern reports and session exports download successfully,
- custom strategies can be created, backtested, exported, and reloaded.

## Packaging

The release ZIP should contain the extension files at the archive root, including `manifest.json`, scripts, `popup.html`, and `icons/`.

Do not include local secrets, browser profile data, test exports, or private API materials in the release package.

## Security Notes

- Never commit API keys, license codes, private tokens, or customer data.
- Gemini API keys are user-provided and stored locally through `chrome.storage.local`.
- Core proprietary strategy calculations are intentionally kept server-side.
- Report sensitive issues privately to the ZenRoulette maintainer.

## Responsible Use

ZenRoulette Assistant is built for observation, journaling, structured review, and discipline. It should not be treated as financial advice, gambling advice, or a promise of winning outcomes. Use it only where online roulette tools are legal and allowed by the platform you are using.

## Community

Join the free ZenRoulette Tribe for tutorials, release updates, and strategy discussion:

https://zenroulette.com

## License

MIT. See [LICENSE](LICENSE).
