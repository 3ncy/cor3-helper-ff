// content.js

// Check if extension context is still valid
function isContextValid() {
    try { return !!chrome.runtime.id; } catch (e) { return false; }
}

// --- Listen for data relayed from content-early.js (MAIN world) ---
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!isContextValid()) return; // Extension was reloaded/updated
    const now = Date.now();
    if (event.data && event.data.type === 'COR3_WS_EXPEDITIONS') {
        chrome.storage.local.set({ expeditionsData: event.data.expeditions, expeditionsDataUpdatedAt: now });
        // Check for completed expeditions to trigger auto-send flow
        checkAutoSendOnExpeditionData(event.data.expeditions);
    }
    // Update decisions — always replace with fresh data from expedition messages
    if (event.data && event.data.type === 'COR3_WS_DECISIONS') {
        chrome.storage.local.set({ expeditionDecisions: event.data.decisions });
    }
    if (event.data && event.data.type === 'COR3_WS_STASH') {
        chrome.storage.local.set({ stashData: event.data.stash, stashDataUpdatedAt: now });
    }
    if (event.data && event.data.type === 'COR3_WS_MARKET') {
        chrome.storage.local.set({ marketData: event.data.market, marketDataUpdatedAt: now });
    }
    if (event.data && event.data.type === 'COR3_WS_DARK_MARKET') {
        chrome.storage.local.set({ darkMarketData: event.data.market, darkMarketAvailable: true, darkMarketDataUpdatedAt: now });
    }
    // Handle dark market unreachable — keep cached data, set flag
    if (event.data && event.data.type === 'COR3_WS_DARK_MARKET_UNREACHABLE') {
        chrome.storage.local.set({ darkMarketAvailable: false, darkMarketDataUpdatedAt: now });
    }
    if (event.data && event.data.type === 'COR3_BEARER_TOKEN') {
        chrome.storage.local.set({ bearerToken: event.data.token });
    }
    // Store web version and system version
    if (event.data && event.data.type === 'COR3_WEB_VERSION') {
        chrome.storage.local.set({ webVersion: event.data.version });
    }
    if (event.data && event.data.type === 'COR3_SYSTEM_VERSION') {
        chrome.storage.local.set({ systemVersion: event.data.version });
    }
    // Store daily rewards data for streak bonus calculation
    if (event.data && event.data.type === 'COR3_DAILY_REWARDS') {
        chrome.storage.local.set({ dailyRewardsData: event.data.rewards });
    }
    // Store archived expeditions
    if (event.data && event.data.type === 'COR3_WS_ARCHIVED_EXPEDITIONS') {
        chrome.storage.local.set({ archivedExpeditionsData: event.data.data, archivedExpeditionsUpdatedAt: now });
    }
    // Store mercenary data
    if (event.data && event.data.type === 'COR3_WS_MERCENARIES') {
        chrome.storage.local.set({ mercenariesData: event.data.data, mercenariesUpdatedAt: now });
    }
    // Store expedition config data
    if (event.data && event.data.type === 'COR3_WS_EXPEDITION_CONFIG') {
        chrome.storage.local.set({ expeditionConfigData: event.data.data, expeditionConfigUpdatedAt: now });
    }
    // Store mercenary configure data (cost/risk per mercenary)
    if (event.data && event.data.type === 'COR3_WS_MERC_CONFIGURE' && event.data.mercenaryId) {
        chrome.storage.local.get('mercConfigData', (result) => {
            const configs = result.mercConfigData || {};
            configs[event.data.mercenaryId] = event.data.data;
            chrome.storage.local.set({ mercConfigData: configs, mercConfigUpdatedAt: now });
        });
    }
    // Auto-send: container opened — proceed to collect all
    if (event.data && event.data.type === 'COR3_WS_CONTAINER_OPENED') {
        if (autoSendInProgress && autoSendExpeditionId) {
            console.log('[COR3 Helper] Auto-send: Container opened, collecting all...');
            setTimeout(() => {
                window.postMessage({ type: 'COR3_COLLECT_ALL', expeditionId: autoSendExpeditionId }, '*');
            }, 1000 + Math.floor(Math.random() * 500));
        }
    }
    // Auto-send: collected all — proceed to get mercenaries and launch
    if (event.data && event.data.type === 'COR3_WS_COLLECTED_ALL') {
        if (autoSendInProgress && autoSendExpeditionId) {
            console.log('[COR3 Helper] Auto-send: All collected, refreshing mercenaries...');
            autoSendExpeditionId = null; // done with old expedition
            // Refresh stash in background
            setTimeout(() => {
                window.postMessage({ type: 'COR3_REQUEST_STASH' }, '*');
            }, 500);
            // Now get mercenaries and launch selected one
            setTimeout(() => {
                window.postMessage({ type: 'COR3_REQUEST_MERCENARIES' }, '*');
            }, 1500 + Math.floor(Math.random() * 500));
            // Wait for mercenaries data, then launch
            autoSendAwaitingMercenaries = true;
        }
    }
    // Auto-send: mercenaries data arrived — configure and launch selected mercenary
    if (event.data && event.data.type === 'COR3_WS_MERCENARIES' && autoSendAwaitingMercenaries) {
        autoSendAwaitingMercenaries = false;
        chrome.storage.sync.get('autoSendMerc', (settings) => {
            if (!settings.autoSendMerc || !settings.autoSendMerc.enabled) {
                console.log('[COR3 Helper] Auto-send: disabled, aborting');
                autoSendInProgress = false;
                return;
            }
            let mercs = event.data.data;
            if (mercs && !Array.isArray(mercs) && mercs.mercenaries) mercs = mercs.mercenaries;
            if (!Array.isArray(mercs)) {
                console.log('[COR3 Helper] Auto-send: cannot parse mercenary list, aborting');
                autoSendInProgress = false;
                return;
            }
            let mercId = settings.autoSendMerc.mercenaryId;
            // If auto-choose mercenary is enabled, pick cheapest AVAILABLE (least risk on tie)
            if (settings.autoSendMerc.autoChooseMerc) {
                chrome.storage.local.get('mercConfigData', (cfgResult) => {
                    const configs = cfgResult.mercConfigData || {};
                    const available = mercs.filter(m => m.status === 'AVAILABLE' && configs[m.id]);
                    if (available.length > 0) {
                        available.sort((a, b) => {
                            const costA = (configs[a.id] && configs[a.id].totalCost) || Infinity;
                            const costB = (configs[b.id] && configs[b.id].totalCost) || Infinity;
                            if (costA !== costB) return costA - costB;
                            const riskA = (configs[a.id] && configs[a.id].riskScore) || 0;
                            const riskB = (configs[b.id] && configs[b.id].riskScore) || 0;
                            return riskA - riskB;
                        });
                        mercId = available[0].id;
                        console.log('[COR3 Helper] Auto-choose merc: selected', available[0].callsign, 'cost:', configs[available[0].id].totalCost);
                    }
                    proceedWithMerc(mercId, mercs, settings);
                });
                return; // async path — proceedWithMerc handles the rest
            }
            proceedWithMerc(mercId, mercs, settings);
        });

        function proceedWithMerc(mercId, mercs, settings) {
            if (!mercId) {
                console.log('[COR3 Helper] Auto-send: no mercenary selected, aborting');
                autoSendInProgress = false;
                return;
            }
            const selectedMerc = mercs.find(m => m.id === mercId);
            if (!selectedMerc || selectedMerc.status !== 'AVAILABLE') {
                console.log('[COR3 Helper] Auto-send: selected mercenary not AVAILABLE (status: ' + (selectedMerc ? selectedMerc.status : 'not found') + '), aborting');
                autoSendInProgress = false;
                return;
            }
            // Get expedition config IDs from storage and launch
            chrome.storage.local.get('expeditionConfigData', (result) => {
                const config = result.expeditionConfigData;
                if (!config || !config.locations || config.locations.length === 0) {
                    console.log('[COR3 Helper] Auto-send: no expedition config available, aborting');
                    autoSendInProgress = false;
                    return;
                }
                const loc = config.locations[0];
                const zone = loc.zones && loc.zones[0] ? loc.zones[0] : null;
                const objective = zone && zone.objectives && zone.objectives[0] ? zone.objectives[0] : null;
                if (!zone || !objective) {
                    console.log('[COR3 Helper] Auto-send: missing zone/objective config, aborting');
                    autoSendInProgress = false;
                    return;
                }
                const launchConfig = {
                    mercenaryId: mercId,
                    marketId: '019d3ea4-85bd-7389-904d-8f7c85841134',
                    locationConfigId: loc.id,
                    zoneConfigId: zone.id,
                    objectiveId: objective.id,
                    hasInsurance: false
                };
                console.log('[COR3 Helper] Auto-send: launching expedition with mercenary:', selectedMerc.callsign);
                setTimeout(() => {
                    window.postMessage({ type: 'COR3_LAUNCH_EXPEDITION', config: launchConfig }, '*');
                    // Refresh mercenaries after launch to update UI
                    setTimeout(() => {
                        window.postMessage({ type: 'COR3_REQUEST_MERCENARIES' }, '*');
                        window.postMessage({ type: 'COR3_REQUEST_EXPEDITIONS' }, '*');
                        autoSendInProgress = false;
                    }, 3000);
                }, 1500 + Math.floor(Math.random() * 500));
            });
        }
    }
    // Auto-send: expedition launched confirmation
    if (event.data && event.data.type === 'COR3_WS_EXPEDITION_LAUNCHED') {
        console.log('[COR3 Helper] Expedition launched successfully');
    }
    // Relay daily hack log messages to storage for popup to read
    if (event.data && event.data.type === 'COR3_DAILY_HACK_LOG') {
        chrome.storage.local.set({
            dailyHackLog: event.data.message,
            dailyHackLogUpdatedAt: Date.now()
        });
    }
    // Auto-fetch daily ops on page load (triggered from content-early.js)
    if (event.data && event.data.type === 'COR3_FETCH_DAILY_OPS') {
        console.log('[COR3 Helper] Requesting daily ops data');
        chrome.storage.local.get('bearerToken', (result) => {
            const token = result.bearerToken;
            if (!token) return;
            fetch('https://svc-corie.cor3.gg/api/user-daily-claim', {
                headers: { 'Authorization': token }
            })
            .then(r => {
                if (r.ok) return r.json();
                if (r.status === 400 || r.status === 401 || r.status === 403) {
                    chrome.storage.local.set({ dailyOpsError: 'token_expired', dailyOpsErrorUpdatedAt: Date.now() });
                    return null;
                }
                return null;
            })
            .then(data => {
                if (data) {
                    chrome.storage.local.set({ dailyOpsData: data, dailyOpsUpdatedAt: Date.now(), dailyOpsError: null });
                    // Also fetch rewards for streak bonus calculation
                    fetchDailyRewards(token);
                }
            })
            .catch(() => {});
        });
    }
});

// Fetch daily claim rewards for streak bonus calculation
function fetchDailyRewards(token) {
    fetch('https://svc-corie.cor3.gg/api/user-daily-claim/rewards', {
        headers: { 'Authorization': token }
    })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
        if (data && Array.isArray(data)) {
            chrome.storage.local.set({ dailyRewardsData: data });
        }
    })
    .catch(() => {});
}

// --- Auto-Send Mercenary State ---
let autoSendInProgress = false;
let autoSendExpeditionId = null;
let autoSendAwaitingMercenaries = false;

function checkAutoSendOnExpeditionData(expeditions) {
    if (!expeditions || !Array.isArray(expeditions) || autoSendInProgress) return;
    chrome.storage.sync.get('autoSendMerc', (settings) => {
        if (!settings.autoSendMerc || !settings.autoSendMerc.enabled) return;
        if (!settings.autoSendMerc.mercenaryId && !settings.autoSendMerc.autoChooseMerc) return;
        // Look for a COMPLETED expedition that hasn't been fully collected yet
        for (const exp of expeditions) {
            if (exp.status === 'COMPLETED' && !exp.completedAt) {
                autoSendInProgress = true;
                autoSendExpeditionId = exp.id;
                if (!exp.containerOpenedAt) {
                    // Container not opened yet — Step 1: open container
                    console.log('[COR3 Helper] Auto-send: Detected COMPLETED expedition:', exp.id, '- opening container');
                    setTimeout(() => {
                        window.postMessage({ type: 'COR3_OPEN_CONTAINER', expeditionId: exp.id }, '*');
                    }, 1000 + Math.floor(Math.random() * 500));
                } else {
                    // Container already opened but not collected — Step 2: collect all
                    console.log('[COR3 Helper] Auto-send: Detected COMPLETED expedition:', exp.id, '- container already open, collecting');
                    setTimeout(() => {
                        window.postMessage({ type: 'COR3_COLLECT_ALL', expeditionId: exp.id }, '*');
                    }, 1000 + Math.floor(Math.random() * 500));
                }
                return; // process one at a time
            }
        }
    });
}

let alarms = []; // array of alarm objects from storage
let alarmTriggered = {}; // keyed by alarm id
let audioContext = null;
let continuousInterval = null;
let isAlarmActive = false;

// Load alarms
chrome.storage.sync.get('alarms', (data) => {
    alarms = data.alarms || [];
});

function playAlarm(volumePercent) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(volumePercent / 100, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(now + 0.5);
}

function startContinuousAlarm(volume) {
    if (continuousInterval) clearInterval(continuousInterval);
    isAlarmActive = true;
    chrome.runtime.sendMessage({ action: "alarmActiveStatus", isActive: true }).catch(()=>{});
    playAlarm(volume);
    continuousInterval = setInterval(() => {
        playAlarm(volume);
    }, 2000);
}

function stopAlarm() {
    if (continuousInterval) {
        clearInterval(continuousInterval);
        continuousInterval = null;
    }
    isAlarmActive = false;
    chrome.runtime.sendMessage({ action: "alarmActiveStatus", isActive: false }).catch(()=>{});
}

function getTimerRemainingSeconds(timerSource) {
    return new Promise((resolve) => {
        if (!isContextValid()) { resolve(null); return; }
        if (timerSource === 'daily') {
            chrome.storage.local.get('dailyOpsData', (result) => {
                if (result.dailyOpsData && result.dailyOpsData.nextTaskTime) {
                    const diff = new Date(result.dailyOpsData.nextTaskTime).getTime() - Date.now();
                    resolve(diff > 0 ? Math.floor(diff / 1000) : 0);
                } else {
                    resolve(null);
                }
            });
        } else if (timerSource === 'home_jobs') {
            chrome.storage.local.get('marketData', (result) => {
                if (result.marketData && result.marketData.nextJobsResetAt) {
                    const diff = new Date(result.marketData.nextJobsResetAt).getTime() - Date.now();
                    resolve(diff > 0 ? Math.floor(diff / 1000) : 0);
                } else {
                    resolve(null);
                }
            });
        } else if (timerSource === 'dark_jobs') {
            chrome.storage.local.get('darkMarketData', (result) => {
                if (result.darkMarketData && result.darkMarketData.nextJobsResetAt) {
                    const diff = new Date(result.darkMarketData.nextJobsResetAt).getTime() - Date.now();
                    resolve(diff > 0 ? Math.floor(diff / 1000) : 0);
                } else {
                    resolve(null);
                }
            });
        } else if (timerSource.startsWith('exp_')) {
            const expId = timerSource.substring(4);
            chrome.storage.local.get('expeditionsData', (result) => {
                const exps = result.expeditionsData || [];
                const exp = exps.find(e => e.id === expId);
                if (exp && exp.endTime) {
                    const diff = new Date(exp.endTime).getTime() - Date.now();
                    resolve(diff > 0 ? Math.floor(diff / 1000) : 0);
                } else {
                    resolve(null);
                }
            });
		} else {
            resolve(null);
        }
    });
}

// Interval IDs — stored so we can clear them on context invalidation
let alarmsIntervalId = null;
let autoRefreshIntervalId = null;

function clearAllIntervals() {
    if (alarmsIntervalId) { clearInterval(alarmsIntervalId); alarmsIntervalId = null; }
    if (autoRefreshIntervalId) { clearInterval(autoRefreshIntervalId); autoRefreshIntervalId = null; }
}

async function checkAlarms() {
    try {
        if (!isContextValid()) { clearAllIntervals(); return; }
        for (const alarm of alarms) {
            if (!alarm.enabled || alarm.thresholdSeconds <= 0) continue;
            const remaining = await getTimerRemainingSeconds(alarm.timerSource);
            if (remaining === null) continue;

            if (remaining <= alarm.thresholdSeconds && remaining > 0 && !alarmTriggered[alarm.id]) {
                alarmTriggered[alarm.id] = true;
                if (alarm.continuous) {
                    startContinuousAlarm(alarm.volume);
                } else {
                    playAlarm(alarm.volume);
                }
            } else if (remaining > alarm.thresholdSeconds) {
                alarmTriggered[alarm.id] = false;
            }
        }
    } catch (e) {
        if (e.message && e.message.includes('Extension context invalidated')) clearAllIntervals();
    }
}

// Check alarms every second
alarmsIntervalId = setInterval(() => checkAlarms(), 1000);

// --- Auto-Refresh for Market Job Timers ---
let autoRefreshSettings = { home_jobs: false, dark_jobs: false };
let autoRefreshRetryPending = { home_jobs: false, dark_jobs: false };

// Load auto-refresh settings on startup
try { chrome.storage.sync.get('autoRefresh', (data) => {
    if (data.autoRefresh) autoRefreshSettings = data.autoRefresh;
}); } catch (e) {}

function getMarketTimerSeconds(which) {
    return new Promise((resolve) => {
        if (!isContextValid()) { resolve(null); return; }
        try {
            const key = which === 'home_jobs' ? 'marketData' : 'darkMarketData';
            chrome.storage.local.get(key, (result) => {
                const data = result[key];
                if (data && data.nextJobsResetAt) {
                    const diff = new Date(data.nextJobsResetAt).getTime() - Date.now();
                    resolve(diff > 0 ? Math.floor(diff / 1000) : 0);
                } else {
                    resolve(null);
                }
            });
        } catch (e) { resolve(null); }
    });
}

function doAutoRefreshMarket(which) {
    if (which === 'home_jobs') {
        window.postMessage({ type: 'COR3_REFRESH_MARKET' }, '*');
    } else {
        window.postMessage({ type: 'COR3_REFRESH_DARK_MARKET' }, '*');
    }
}

async function checkAutoRefresh() {
    try {
        if (!isContextValid()) { clearAllIntervals(); return; }
        for (const key of ['home_jobs', 'dark_jobs']) {
            if (!autoRefreshSettings[key]) continue;
            if (autoRefreshRetryPending[key]) continue;

            const sec = await getMarketTimerSeconds(key);
            if (sec !== null && sec <= 0) {
                autoRefreshRetryPending[key] = true;
                doAutoRefreshMarket(key);

                // After 10s, re-check. If still 0, retry.
                setTimeout(async () => {
                    autoRefreshRetryPending[key] = false;
                    const newSec = await getMarketTimerSeconds(key);
                    if (newSec !== null && newSec <= 0) {
                        // Will be picked up by next checkAutoRefresh cycle
                    }
                }, 10000);
            }
        }
    } catch (e) {
        if (e.message && e.message.includes('Extension context invalidated')) clearAllIntervals();
    }
}

// Check auto-refresh every second
autoRefreshIntervalId = setInterval(() => checkAutoRefresh(), 1000);

// --- Auto Decrypt Solver ---
let decryptSolverInjected = false;

function injectDecryptSolver() {
    if (decryptSolverInjected) {
        // Solver already injected, just signal restart
        window.postMessage({ type: 'COR3_START_DECRYPT_SOLVER' }, '*');
        return;
    }
    decryptSolverInjected = true;
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('decrypt-solver.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

function stopDecryptSolver() {
    window.postMessage({ type: 'COR3_STOP_DECRYPT_SOLVER' }, '*');
    decryptSolverInjected = false;
}

// --- Auto Daily Hack Solver ---
let dailyHackInjected = false;

function injectDailyHackSolver() {
    if (dailyHackInjected) {
        window.postMessage({ type: 'COR3_STOP_DAILY_HACK' }, '*');
        dailyHackInjected = false;
        setTimeout(() => injectDailyHackSolver(), 300);
        return;
    }
    dailyHackInjected = true;
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('daily-hack-solver.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

function stopDailyHackSolver() {
    window.postMessage({ type: 'COR3_STOP_DAILY_HACK' }, '*');
    dailyHackInjected = false;
}

// Auto-start solver if it was enabled before page load
chrome.storage.sync.get('autoDecryptEnabled', (data) => {
    if (data.autoDecryptEnabled) {
        injectDecryptSolver();
    }
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateAlarms") {
        alarms = request.alarms || [];
        alarmTriggered = {}; // reset triggers on update
        sendResponse({ success: true });
    } else if (request.action === "testAlarm") {
        const vol = request.volume !== undefined ? request.volume : 50;
        if (request.continuous) {
            startContinuousAlarm(vol);
        } else {
            playAlarm(vol);
        }
        sendResponse({ success: true });
    } else if (request.action === "stopAlarm") {
        stopAlarm();
        sendResponse({ success: true });
    } else if (request.action === "requestExpeditions") {
        window.postMessage({ type: 'COR3_REQUEST_EXPEDITIONS' }, '*');
        sendResponse({ success: true });
    } else if (request.action === "requestStash") {
        window.postMessage({ type: 'COR3_REQUEST_STASH' }, '*');
        sendResponse({ success: true });
    } else if (request.action === "requestMarket") {
        window.postMessage({ type: 'COR3_REQUEST_MARKET' }, '*');
        sendResponse({ success: true });
    } else if (request.action === "refreshMarket") {
        window.postMessage({ type: 'COR3_REFRESH_MARKET' }, '*');
        sendResponse({ success: true });
    } else if (request.action === "requestDarkMarket") {
        window.postMessage({ type: 'COR3_REQUEST_DARK_MARKET' }, '*');
        sendResponse({ success: true });
    } else if (request.action === "refreshDarkMarket") {
        window.postMessage({ type: 'COR3_REFRESH_DARK_MARKET' }, '*');
        sendResponse({ success: true });
    } else if (request.action === "leaveStash") {
        window.postMessage({ type: 'COR3_LEAVE_STASH' }, '*');
        sendResponse({ success: true });
    } else if (request.action === "updateAutoRefresh") {
        if (request.autoRefresh) {
            autoRefreshSettings = request.autoRefresh;
        }
        sendResponse({ success: true });
    } else if (request.action === "toggleDecryptSolver") {
        if (request.enabled) {
            injectDecryptSolver();
        } else {
            stopDecryptSolver();
        }
        sendResponse({ success: true });
    } else if (request.action === "toggleDailyHackSolver") {
        if (request.enabled) {
            injectDailyHackSolver();
        } else {
            stopDailyHackSolver();
        }
        sendResponse({ success: true });
    } else if (request.action === "respondDecision") {
        // Relay decision response to content-early.js
        window.postMessage({
            type: 'COR3_RESPOND_DECISION',
            expeditionId: request.expeditionId,
            messageId: request.messageId,
            selectedOption: request.selectedOption
        }, '*');
        sendResponse({ success: true });
    } else if (request.action === "requestArchivedExpeditions") {
        // Request archived expeditions
        window.postMessage({ type: 'COR3_REQUEST_ARCHIVED_EXPEDITIONS' }, '*');
        sendResponse({ success: true });
    } else if (request.action === "requestMercenaries") {
        window.postMessage({ type: 'COR3_REQUEST_MERCENARIES' }, '*');
        sendResponse({ success: true });
    } else if (request.action === "requestExpeditionConfig") {
        window.postMessage({ type: 'COR3_REQUEST_EXPEDITION_CONFIG', mercenaryId: request.mercenaryId }, '*');
        sendResponse({ success: true });
    } else if (request.action === "launchExpedition") {
        window.postMessage({ type: 'COR3_LAUNCH_EXPEDITION', config: request.config }, '*');
        sendResponse({ success: true });
    } else if (request.action === "openContainer") {
        window.postMessage({ type: 'COR3_OPEN_CONTAINER', expeditionId: request.expeditionId }, '*');
        sendResponse({ success: true });
    } else if (request.action === "collectAll") {
        window.postMessage({ type: 'COR3_COLLECT_ALL', expeditionId: request.expeditionId }, '*');
        sendResponse({ success: true });
    } else if (request.action === "fetchDailyOps") {
        // Fetch daily ops in page context using stored bearer token
        chrome.storage.local.get('bearerToken', (result) => {
            const token = result.bearerToken;
            if (!token) {
                sendResponse({ error: 'no token' });
                return;
            }
            fetch('https://svc-corie.cor3.gg/api/user-daily-claim', {
                headers: { 'Authorization': token }
            })
            .then(r => {
                if (r.ok) return r.json();
                if (r.status === 400 || r.status === 401 || r.status === 403) return r.json().then(d => { throw new Error(d.message || 'token_expired'); }).catch(() => { throw new Error('token_expired'); });
                return null;
            })
            .then(data => {
                if (data) {
                    chrome.storage.local.set({ dailyOpsData: data, dailyOpsUpdatedAt: Date.now() });
                    fetchDailyRewards(token);
                }
                sendResponse({ data: data });
            })
            .catch(e => sendResponse({ error: e.message || 'fetch failed' }));
        });
        return true; // keep channel open for async sendResponse
    }
});
