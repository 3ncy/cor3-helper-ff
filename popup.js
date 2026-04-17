// popup.js

const timerDisplay = document.getElementById('timerDisplay');
const macroSelect = document.getElementById('macroSelect');
const runMacroBtn = document.getElementById('runMacroBtn');
const deleteMacroBtn = document.getElementById('deleteMacroBtn');
const recordBtn = document.getElementById('recordBtn');
const testBtn = document.getElementById('testBtn');
const alarmToggle = document.getElementById('alarmToggle');
const continuousToggle = document.getElementById('continuousToggle');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const testAlarmBtn = document.getElementById('testAlarmBtn');
const stopAlarmBtn = document.getElementById('stopAlarmBtn');
const statusDiv = document.getElementById('status');

let timerInterval = null;

// --- Helper functions for timer formatting ---
function parseTimeToSeconds(timeString) {
    if (!timeString) return null;
    const parts = timeString.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    const hours = parts.length === 3 ? parts[0] : 0;
    const minutes = parts.length === 3 ? parts[1] : parts[0];
    const seconds = parts.length === 3 ? parts[2] : parts[1];
    return (hours * 3600) + (minutes * 60) + seconds;
}

function formatSeconds(sec) {
    if (sec < 0) sec = 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h:${m}m:${s}s`;
}

// --- Timer Fetch with Fallback (shows dashes if no valid data) ---
async function fetchTimer() {
    // 1. Try content script (live)
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { action: "getTimer" });
        if (response && response.timerText && response.timerText !== '--:--:--') {
            timerDisplay.textContent = response.timerText;
            return;
        }
    } catch (e) {
        // content script not reachable
    }

    // 2. Fallback: read from storage
    chrome.storage.local.get(['lastTimerText', 'lastTimerUpdate'], (data) => {
        if (data.lastTimerText && data.lastTimerUpdate) {
            const originalSeconds = parseTimeToSeconds(data.lastTimerText);
            if (originalSeconds !== null) {
                const elapsed = Math.floor((Date.now() - data.lastTimerUpdate) / 1000);
                let remaining = originalSeconds - elapsed;
                if (remaining < 0) remaining = 0;
                timerDisplay.textContent = formatSeconds(remaining);
            } else {
                timerDisplay.textContent = '--:--:--';
            }
        } else {
            timerDisplay.textContent = '--:--:--';
        }
    });
}

// Listen for live updates
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "updateTimer") {
        timerDisplay.textContent = request.timerText;
    }
    if (request.action === "alarmActiveStatus") {
        stopAlarmBtn.disabled = !request.isActive;
        statusDiv.textContent = request.isActive ? 'Alarm sounding...' : 'Ready';
    }
});

// Start polling
fetchTimer();
timerInterval = setInterval(fetchTimer, 1000);
window.addEventListener('unload', () => clearInterval(timerInterval));

// --- Macro Management ---
async function loadMacroList() {
    const { macros } = await chrome.storage.local.get('macros');
    const macroList = macros || {};
    macroSelect.innerHTML = '<option value="">-- Select a macro --</option>';
    Object.keys(macroList).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        macroSelect.appendChild(option);
    });
    
    const { activeMacro } = await chrome.storage.local.get('activeMacro');
    if (activeMacro && macroList[activeMacro]) {
        macroSelect.value = activeMacro;
        chrome.runtime.sendMessage({ action: "setActiveMacro", macroName: activeMacro });
    }
}
loadMacroList();

macroSelect.addEventListener('change', () => {
    const name = macroSelect.value;
    chrome.storage.local.set({ activeMacro: name });
    chrome.runtime.sendMessage({ action: "setActiveMacro", macroName: name });
});

// --- Alarm Settings ---
async function loadSettings() {
    const { alarmEnabled, alarmVolume, continuousAlarm } = await chrome.storage.sync.get(['alarmEnabled', 'alarmVolume', 'continuousAlarm']);
    alarmToggle.checked = alarmEnabled || false;
    continuousToggle.checked = continuousAlarm || false;
    const vol = alarmVolume !== undefined ? alarmVolume : 50;
    volumeSlider.value = vol;
    volumeValue.textContent = vol + '%';
    sendSettingsToContent();
}
function sendSettingsToContent() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "updateSettings",
                settings: {
                    alarmEnabled: alarmToggle.checked,
                    alarmVolume: parseInt(volumeSlider.value),
                    continuousAlarm: continuousToggle.checked
                }
            }).catch(() => {});
        }
    });
}
loadSettings();

alarmToggle.addEventListener('change', async () => {
    await chrome.storage.sync.set({ alarmEnabled: alarmToggle.checked });
    sendSettingsToContent();
});
continuousToggle.addEventListener('change', async () => {
    await chrome.storage.sync.set({ continuousAlarm: continuousToggle.checked });
    sendSettingsToContent();
});
volumeSlider.addEventListener('input', async () => {
    const vol = volumeSlider.value;
    volumeValue.textContent = vol + '%';
    await chrome.storage.sync.set({ alarmVolume: parseInt(vol) });
    sendSettingsToContent();
});

testAlarmBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "testAlarm" });
        }
    });
});
stopAlarmBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "stopAlarm" });
            stopAlarmBtn.disabled = true;
        }
    });
});

// --- Recording and Macro Execution ---
recordBtn.addEventListener('click', async () => {
    try {
        const response = await chrome.runtime.sendMessage({ action: "startRecording" });
        if (response && response.success) {
            statusDiv.textContent = 'Recording active - close popup and click elements';
        }
    } catch (error) {
        statusDiv.textContent = 'Error: ' + error.message;
    }
});

testBtn.addEventListener('click', async () => {
    const name = macroSelect.value;
    if (!name) {
        statusDiv.textContent = 'Select a macro first';
        return;
    }
    await chrome.runtime.sendMessage({ action: "executeMacro", macroName: name });
    statusDiv.textContent = `Running "${name}"`;
    setTimeout(() => statusDiv.textContent = 'Ready', 2000);
});

runMacroBtn.addEventListener('click', async () => {
    const name = macroSelect.value;
    if (!name) {
        statusDiv.textContent = 'Select a macro';
        return;
    }
    await chrome.runtime.sendMessage({ action: "executeMacro", macroName: name });
    statusDiv.textContent = `Running "${name}"`;
    setTimeout(() => statusDiv.textContent = 'Ready', 2000);
});

deleteMacroBtn.addEventListener('click', async () => {
    const name = macroSelect.value;
    if (!name) return;
    if (!confirm(`Delete macro "${name}"?`)) return;
    const { macros } = await chrome.storage.local.get('macros');
    if (macros && macros[name]) {
        delete macros[name];
        await chrome.storage.local.set({ macros });
        loadMacroList();
        statusDiv.textContent = `Deleted "${name}"`;
    }
});