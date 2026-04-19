# COR3 Helper

A Firefox extension that enhances the [cor3.gg](https://cor3.gg) experience by monitoring markets, expeditions, daily ops, and providing timer alerts — all from a compact popup UI.

## Features

- **Market Monitoring** — View Market-1 (HOME) and Market-2 (D4RK) options, prices, jobs, and reset timers
- **Expedition Tracking** — See active expeditions with various information
- **Daily Ops Timer** — Countdown to your next daily ops task with extra information
- **Multi-Alarm System** — Create multiple configurable alarms for any timer (daily ops, market job resets). Each alarm has its own threshold, volume, continuous mode, and on/off toggle
- **Pinned Timers** — Pin important timers to the top of the popup for quick access
- **Auto-Job-Refresh** — Market job timers automatically refresh when they reach zero, so jobs get refreshed even with the popup closed. This gives users more jobs per day by triggering them earlier and giving enough time to finish
- **Inventory Viewer** — Browse your stash with item details and total value
- **Expedition Decisions** — View details related to pending expedition decisions directly from the popup
- **Cache-First Design** — Data loads instantly from cache on popup open. Use the 🔄 Refresh All button or per-section refresh buttons to fetch fresh data
- **Theme Support** — Multiple color themes to match your preference
- **Lightweight** — Intercepts existing WebSocket traffic; no extra API calls beyond what the game already sends

## Installation

Firefox requires extensions to be signed and verified to use certain features, such as browser storage. This extensions is not yet signed, so you must use either of these Firefox editions, where it is possible to disable the verification enforcement:
- [**Firefox Developer Edition**](https://www.mozilla.org/firefox/developer/)
- [**Firefox Nightly**](https://nightly.mozilla.org/)

For Mozilla's official background on unsigned add-ons, see:
https://support.mozilla.org/en-US/kb/add-on-signing-in-firefox#w_what-are-my-options-if-i-want-to-use-an-unsigned-add-on-advanced-users

1. **Download the extension source**
   Click **Code -> Download ZIP** in the top right of this page.
   
   Alternatively you can clone the repository:
   ```
   git clone https://github.com/3ncy/cor3-helper-ff.git
   ```
   and then zip up all the files found within.

2. **Open advanced Firefox config**
   In Firefox (Developer Edition/Nightly), open `about:config`.

3. **Disable add-on signature enforcement**
   Search for `xpinstall.signatures.required` and set it to `false`.

   If Firefox warns about changing advanced preferences, accept the warning.

4. **Open the Add-ons Manager**
   Go to `about:addons`.

5. **Install from file**
   Click the gear icon in the top-right, choose **Install Add-on From File...**, and select the `.zip` file that you downloaded.

6. **Use the extension**
   Open [https://cor3.gg](https://cor3.gg) and log in. Then open the COR3 Helper toolbar popup.

## Installation to Chrome and Chromium browsers

See the parent project https://github.com/Femtoce11/cor3-helper.

## Usage

- **On page load**, the extension automatically fetches market data, expedition data, and daily ops to populate the cache.
- **Open the popup** to see cached data instantly with "last updated" timestamps.
- **Refresh All** (🔄 button in header) sequentially refreshes daily ops → markets → expeditions.
- **Per-section refresh** buttons let you refresh individual data types.
- **Alarms** — Click ➕ in the Alarms section to create a new alarm. Choose a timer source, set a threshold, and configure volume/continuous beeping. Toggle alarms on/off or edit/delete them anytime.
- **Pin timers** to keep them visible at the top of the popup.
- **Auto job refresh** feature can be used after pinning timers and clicking the "Auto" checkbox next to it.

## Files

| File | Description |
|---|---|
| `manifest.json` | Extension manifest (Manifest V3) |
| `popup.html` | Popup UI (HTML + CSS) |
| `popup.js` | Popup logic, rendering, alarm management |
| `content-early.js` | Injected at `document_start` — intercepts WebSocket messages, sends market/expedition requests |
| `content.js` | Injected at `document_idle` — relays data to storage, handles alarm checking, auto-refresh |
| `background.js` | Service worker for extension lifecycle |
| `ws-interceptor.js` | WebSocket interceptor helper |

## Requirements

- Firefox Developer Edition or Firefox Nightly
- An active [cor3.gg](https://cor3.gg) account

## License

MIT
