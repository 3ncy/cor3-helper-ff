// background.js

let isRecording = false;
let activeMacroName = null;
let macroAlarmScheduled = false;

function parseTimeToSeconds(timeString) {
    if (!timeString) return null;
    const parts = timeString.split(':').map(Number);
    const hours = parts.length === 3 ? parts[0] : 0;
    const minutes = parts.length === 3 ? parts[1] : parts[0];
    const seconds = parts.length === 3 ? parts[2] : parts[1];
    return (hours * 3600) + (minutes * 60) + seconds;
}

function executeActiveMacro() {
    if (!activeMacroName) {
        console.log('[Background] No active macro');
        return;
    }
    chrome.storage.local.get('macros', (data) => {
        const macros = data.macros || {};
        const steps = macros[activeMacroName];
        if (steps) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "playMacro", steps });
                }
            });
        }
    });
    macroAlarmScheduled = false;
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'executeMacroAlarm') {
        executeActiveMacro();
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateTimer") {
        const timerText = request.timerText;
        chrome.storage.local.set({
            lastTimerText: timerText,
            lastTimerUpdate: Date.now()
        });
        const totalSeconds = parseTimeToSeconds(timerText);
        if (totalSeconds !== null && totalSeconds <= 30 && totalSeconds > 0) {
            if (!macroAlarmScheduled) {
                macroAlarmScheduled = true;
                chrome.alarms.create('executeMacroAlarm', { delayInMinutes: 1 });
            }
        } else if (totalSeconds > 30) {
            if (macroAlarmScheduled) {
                chrome.alarms.clear('executeMacroAlarm');
                macroAlarmScheduled = false;
            }
        }
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === "getTimerFallback") {
        chrome.storage.local.get(['lastTimerText', 'lastTimerUpdate'], (data) => {
            if (data.lastTimerText && data.lastTimerUpdate) {
                const elapsed = Math.floor((Date.now() - data.lastTimerUpdate) / 1000);
                const original = parseTimeToSeconds(data.lastTimerText);
                if (original !== null) {
                    let remaining = original - elapsed;
                    if (remaining < 0) remaining = 0;
                    const h = Math.floor(remaining / 3600);
                    const m = Math.floor((remaining % 3600) / 60);
                    const s = remaining % 60;
                    sendResponse({ timerText: `${h}h:${m}m:${s}s` });
                    return;
                }
            }
            sendResponse({ timerText: '--:--:--' });
        });
        return true;
    }
    
    if (request.action === "startRecording") {
        isRecording = true;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['recorder.js']
                }, () => {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "showRecordingUI" });
                });
            }
        });
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === "stopRecording") {
        isRecording = false;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "hideRecordingUI" });
            }
        });
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === "saveMacro") {
        const { name, steps } = request;
        chrome.storage.local.get('macros', (data) => {
            const macros = data.macros || {};
            macros[name] = steps;
            chrome.storage.local.set({ macros }, () => {
                sendResponse({ success: true });
            });
        });
        return true;
    }
    
    if (request.action === "setActiveMacro") {
        activeMacroName = request.macroName;
        chrome.storage.local.set({ activeMacro: activeMacroName });
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === "executeMacro") {
        const macroName = request.macroName;
        chrome.storage.local.get('macros', (data) => {
            const macros = data.macros || {};
            const steps = macros[macroName];
            if (steps) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: "playMacro", steps });
                    }
                });
            }
        });
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === "getRecordingStatus") {
        sendResponse({ isRecording });
        return true;
    }
});