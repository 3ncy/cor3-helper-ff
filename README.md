# COR3 Helper

A Firefox extension that enhances the [cor3.gg](https://cor3.gg) experience by monitoring markets, expeditions, daily ops, and providing timer alerts — all from a compact popup UI.

## Features

- **Theme Support** — Multiple color themes to match your preference
- **Pop-up Window / Panel Support** — Exports the UI to pop-up window or side panel depending on your preference
- **Refresh System** — Either by using "refresh all" button or by clicking "refresh" for each section, it refreshes related data available on the UI
- **Pinned Timers** — Every timer except "RESTING" timer for mercenaries can be pinned to top of the UI for tracking.
- **Auto Job Refresh** — If the "auto-refresh" checkbox next to pinned job timer is enabled, jobs get automatically refreshed when they reach zero. This gives users more jobs per day by triggering them earlier and giving enough time to finish
- **Auto Decrypt Hacking** — Automatically solves decryption hacks when enabled. Just toggle it on and the extension handles the rest
- **Auto Daily Hacking** — Automatically solves log integration hack and gives results of signal hack when enabled. Check information below it for signal hack results.
- **Daily Ops** — Countdown to your next daily ops task with streak bonus, difficulty, and claim status
- **Market Monitoring** — View Market-1 (HOME) and Market-2 (D4RK) stats, job reset timers, items list, and jobs list (with Category/Server/Reward columns)
- **Active Expedition Tracking** — See active expeditions with remaining timer, cost, risk, insurance, and mercenary info
- **Expedition Decisions** — View and respond to pending decisions by clicking them with score calculation
- **Auto Choose Decision** — Auto choose decisions 1-min before deadline according to their scoring. Configure loot/risk modifiers to change how scoring works.
- **Inventory Viewer** — Browse your stash sorted by rarity (rarest first) then price, with item/storage details, total value, and last-updated timestamps
- **Mercenaries** — View mercenary callsign, rank, status, specialization, traits, mission count, cost, rest timers, risk, failed-survive chance, and death chance.
- **Auto Send Mercenary** — Enable "auto send" toggle and select a mercenary to send just after current expedition is done. It auto-claims previous reward container.
- **Auto Choose Mercenary** — Enable "auto choose" toggle for extension to do best mercenary selection according to their cost and risk values.
- **Archived Expeditions** — View past expeditions with outcome, cost, risk, location, loot container details and item images. Auto-loaded on startup
- **Multi-Alarm System** — Create multiple configurable alarms for any timer (daily ops, market job resets, expeditions). Each alarm has its own threshold, volume, continuous mode, and on/off toggle
- **Version Tracking** — Displays extension, web, and system versions
- **Check for Updates** — Compare your installed extension, web, and system versions against the latest on GitHub. It lets user know if an update is required for extension or if web/system versions are different from what's stored.
- **Cache-First Design** — Data loads instantly from cache on popup open. Use the "Refresh All" button or per-section refresh buttons to fetch fresh data
- **Real-Time Updates** — WebSocket listeners auto-update daily ops, markets, expeditions, decisions, inventory, mercenaries, and archived expeditions when data arrives
- **Lightweight** — Only intercepts existing WebSocket traffic and re-triggers some API calls that the game already sends

## Installation

Firefox requires extensions to be signed and verified to use certain features, such as browser storage. This extensions is not yet signed, so you must use either of these Firefox editions, where it is possible to disable the verification enforcement:
- [**Firefox Developer Edition**](https://www.mozilla.org/firefox/developer/)
- [**Firefox Nightly**](https://nightly.mozilla.org/)

For Mozilla's official background on unsigned add-ons, see the article on [support.mozilla.org](https://support.mozilla.org/en-US/kb/add-on-signing-in-firefox#w_what-are-my-options-if-i-want-to-use-an-unsigned-add-on-advanced-users).

1. **Download the latest release**  
   Open the [GitHub Releases page](https://github.com/3ncy/cor3-helper-ff/releases) and download the latest `.xpi` file.

   Alternatively you can clone the the repository yourself with `git clone https://github.com/3ncy/cor3-helper-ff.git`, then zip up the files inside the cloned folder so that `manifest.json` is at the root of the ZIP.

2. **Open advanced Firefox config**  
   In Firefox (Developer Edition/Nightly), open `about:config`.

3. **Disable add-on signature enforcement**  
   Search for `xpinstall.signatures.required` and set it to `false`.

   If Firefox warns about changing advanced preferences, accept the warning.

4. **Open the Add-ons Manager**  
   Go to `about:addons`.

5. **Install from file**  
   Click the gear icon in the top-right, choose **Install Add-on From File...**, and select the `.xpi` file you downloaded in Step 1.

6. **Use the extension**  
   Open [https://cor3.gg](https://cor3.gg) and log in. Then open the COR3 Helper toolbar popup.

## Installation to Chrome and Chromium browsers

See the parent project https://github.com/Femtoce11/cor3-helper.

## Usage

- **On page load**, the extension automatically fetches daily ops, market data, expedition data, and mercenary data to populate the cache.
- **Open the popup** to see cached data instantly with "last updated" timestamps.
- **Refresh All** button sequentially refreshes daily ops → markets → expeditions -> mercenary.
- **Per-section refresh** buttons let you refresh individual data types.
- **Pin timers** to keep them visible at the top of the popup.
- **Auto job refresh** feature can be used to automatically refresh jobs when needed after pinning timers and clicking the "Auto" checkbox next to it.
- **Auto Decrypt Hacking** — Toggle the switch to enable. It automatically solves decryption hacks whenever one appears.
- **Auto Daily Hacking** — Toggle the switch to enable. It automatically solves log integration hacks whenever one appears. It also solves signal hacks and shows results on UI for user to put in.
- **Set decision scores** by clicking edit button. After the change click save button to keep the changes. This way you can change default scoring that extension shows next to each decision.
- **Enable auto choose decision** for extension to automatically choose best decision according to scoring which is calculated by default/modified loot/risk modifiers.
- **Enable auto send mercenary** for extension to send selected mercenary by itself after the current expedition ends.
- **Enable auto choose mercenary** for extension to choose which mercenary to send for next expedition according to their cost and risk values. It only works if "auto-send" feature is turned on.
- **Alarms** — Click ➕ in the Alarms section to create a new alarm. Choose a timer source, set a threshold, and configure volume/continuous beeping. Toggle alarms on/off or edit/delete them anytime.
- **Check for Updates** — Click the button at the bottom of the popup to see if a new version of extension is available on GitHub. It also shows if web/system versions are changed recently.

## Files

| File                   | Description                                                                                                                   |
|------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `manifest.json`        | Extension manifest (Manifest V3)                                                                                              |
| `popup.html`           | Popup UI (HTML + CSS)                                                                                                         |
| `popup.js`             | Popup logic, rendering, alarm management                                                                                      |
| `content-early.js`     | Injected at `document_start` — intercepts WebSocket messages, sends market/expedition requests                                |
| `content.js`           | Injected at `document_idle` — relays data to storage, handles alarm checking, auto-refresh                                    |
| `background.js`        | Service worker for extension lifecycle                                                                                        |
| `ws-interceptor.js`    | WebSocket interceptor helper                                                                                                  |
| `decrypt-solver.js`    | Auto-solver for decryption hacking minigame (injected into page when enabled)                                                 |
| `daily-hack-solver.js` | Auto-solver for log integration hack and singal hack minigames (only log integration hack is injected into page when enabled) |
| `versions.json`        | Version tracking file for update checks (extension, web, system)                                                              |

## Requirements

- Firefox Developer Edition or Firefox Nightly
- An active [cor3.gg](https://cor3.gg) account

## License

MIT
