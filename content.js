// content.js

let alarmEnabled = false;
let alarmVolume = 50;
let continuousAlarm = false;
let lastAlarmTriggerSeconds = null;
let audioContext = null;
let continuousInterval = null;
let isAlarmActive = false;

// Load settings
chrome.storage.sync.get(['alarmEnabled', 'alarmVolume', 'continuousAlarm'], (data) => {
    alarmEnabled = data.alarmEnabled || false;
    alarmVolume = data.alarmVolume !== undefined ? data.alarmVolume : 50;
    continuousAlarm = data.continuousAlarm || false;
});

function getCurrentTimerText() {
    const timerElement = document.querySelector('[data-component-name="MarketJobPageTimer"]');
    if (!timerElement) return null;
    return timerElement.childNodes[0].nodeValue.trim();
}

function parseTimeToSeconds(timeString) {
    if (!timeString) return null;
    const parts = timeString.split(':').map(Number);
    const hours = parts.length === 3 ? parts[0] : 0;
    const minutes = parts.length === 3 ? parts[1] : parts[0];
    const seconds = parts.length === 3 ? parts[2] : parts[1];
    return (hours * 3600) + (minutes * 60) + seconds;
}

// Directly save timer to storage every second
function saveTimerToStorage() {
    const timerText = getCurrentTimerText();
    if (timerText) {
        chrome.storage.local.set({
            lastTimerText: timerText,
            lastTimerUpdate: Date.now()
        });
        // Also notify background for macro scheduling
        chrome.runtime.sendMessage({ action: "updateTimer", timerText }).catch(() => {});
    }
}

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

function startContinuousAlarm() {
    if (continuousInterval) clearInterval(continuousInterval);
    isAlarmActive = true;
    chrome.runtime.sendMessage({ action: "alarmActiveStatus", isActive: true }).catch(()=>{});
    playAlarm(alarmVolume);
    continuousInterval = setInterval(() => {
        playAlarm(alarmVolume);
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

function checkAlarm(totalSeconds) {
    if (!alarmEnabled) return;
    
    if (totalSeconds === 300 && lastAlarmTriggerSeconds !== 300) {
        lastAlarmTriggerSeconds = 300;
        if (continuousAlarm) {
            startContinuousAlarm();
        } else {
            playAlarm(alarmVolume);
        }
    } else if (totalSeconds > 300) {
        lastAlarmTriggerSeconds = null;
    }
}

function checkTimer() {
    const timerText = getCurrentTimerText();
    if (!timerText) return;
    
    saveTimerToStorage();
    
    const totalSeconds = parseTimeToSeconds(timerText);
    if (totalSeconds !== null) {
        checkAlarm(totalSeconds);
    }
}

// Save timer every second (ensures storage is always fresh)
setInterval(() => {
    saveTimerToStorage();
}, 1000);

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTimer") {
        const timerText = getCurrentTimerText();
        sendResponse({ timerText: timerText || '--:--:--' });
    } else if (request.action === "playMacro") {
        executeMacro(request.steps).then(() => sendResponse({ success: true }));
        return true;
    } else if (request.action === "updateSettings") {
        if (request.settings.alarmEnabled !== undefined) alarmEnabled = request.settings.alarmEnabled;
        if (request.settings.alarmVolume !== undefined) alarmVolume = request.settings.alarmVolume;
        if (request.settings.continuousAlarm !== undefined) {
            continuousAlarm = request.settings.continuousAlarm;
            if (!continuousAlarm && isAlarmActive) {
                stopAlarm();
            }
        }
        sendResponse({ success: true });
    } else if (request.action === "testAlarm") {
        if (continuousAlarm) {
            startContinuousAlarm();
        } else {
            playAlarm(alarmVolume);
        }
        sendResponse({ success: true });
    } else if (request.action === "stopAlarm") {
        stopAlarm();
        sendResponse({ success: true });
    }
});

async function executeMacro(steps) {
    for (const step of steps) {
        let element;
        if (step.id) {
            element = document.getElementById(step.id);
        } else if (step.className) {
            const classes = step.className.split(' ').filter(c => c).join('.');
            element = document.querySelector(`${step.tagName}.${classes}`);
        } else {
            element = document.querySelector(step.tagName);
        }
        if (element) {
            element.click();
            await new Promise(r => setTimeout(r, 300));
        }
    }
}

// Observer for immediate changes (also triggers save)
const observer = new MutationObserver(() => checkTimer());
function startObserving() {
    const timerEl = document.querySelector('[data-component-name="MarketJobPageTimer"]');
    if (timerEl) {
        observer.observe(timerEl, { characterData: true, childList: true, subtree: true });
        checkTimer();
    } else {
        const bodyObserver = new MutationObserver(() => {
            const el = document.querySelector('[data-component-name="MarketJobPageTimer"]');
            if (el) {
                bodyObserver.disconnect();
                observer.observe(el, { characterData: true, childList: true, subtree: true });
                checkTimer();
            }
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
}
startObserving();