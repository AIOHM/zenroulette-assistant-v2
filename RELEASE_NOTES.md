# ZenRoulette Assistant v2.1.6

This release focuses on a cleaner Lightning module, better pattern synchronization, and a more professional public download package.

## Highlights

- PT pattern chips now follow the enabled state from Active Patterns.
- JP and PT rails stay centered and avoid unnecessary scrolling.
- Repeat Pattern targets are available to the assistant as soon as the local history detects them.
- Active Pattern actions now live in a consistent footer toolbar.
- Pattern Pre-Check can scan history even when optional strategy-core helpers are unavailable.
- The account flow supports the temporary promotional 24-hour license request.

## Download

Use the stable download link:

https://zenroulette.com/get/extension/

Or download the tagged ZIP from GitHub after the release tag is published.

## Verification

- `node --check top.js`
- `node --check background.js`
- `node --check app.js`
- `php -l api/index.php`
- Production download metadata and HTTP header verification through the deploy script.
