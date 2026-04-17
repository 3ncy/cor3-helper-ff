// recorder.js
(function() {
    // Guard against multiple injections
    if (window.__macroRecorderActive) {
        return;
    }
    window.__macroRecorderActive = true;

    // --- Create floating UI ---
    const bar = document.createElement('div');
    bar.id = 'macro-recorder-bar';
    bar.innerHTML = `
        <style>
            #macro-recorder-bar {
                position: fixed;
                top: 10px;
                right: 10px;
                background: #1e1e2f;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                z-index: 999999;
                display: flex;
                align-items: center;
                gap: 15px;
                font-family: 'Segoe UI', sans-serif;
                border: 1px solid #61dafb;
            }
            #macro-recorder-bar input {
                padding: 5px;
                border-radius: 4px;
                border: none;
                width: 120px;
            }
            #macro-recorder-bar button {
                background: #6272a4;
                border: none;
                color: white;
                padding: 6px 15px;
                border-radius: 20px;
                cursor: pointer;
                font-weight: bold;
            }
            #macro-recorder-bar button:hover {
                background: #7a93d1;
            }
            #macro-recorder-bar .status {
                color: #ff5555;
                font-weight: bold;
            }
            #macro-recorder-bar .timer {
                font-size: 18px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
                color: #61dafb;
            }
        </style>
        <div class="status">🔴 RECORDING</div>
        <div>Timer: <span class="timer" id="macro-timer-display">--:--:--</span></div>
        <input type="text" id="macro-name-input" placeholder="Macro name" value="Macro ${new Date().toLocaleTimeString()}">
        <button id="macro-save-btn">Save & Stop</button>
        <button id="macro-cancel-btn">Cancel</button>
    `;
    document.body.appendChild(bar);

    // Timer update function
    function updateTimer() {
        const timerEl = document.querySelector('[data-component-name="MarketJobPageTimer"]');
        if (timerEl) {
            const timerText = timerEl.childNodes[0]?.nodeValue?.trim() || '--:--:--';
            const displaySpan = document.getElementById('macro-timer-display');
            if (displaySpan) displaySpan.textContent = timerText;
        }
    }
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    // Macro steps storage
    let recordedSteps = [];

    // Click capture function
    function captureClick(e) {
        const el = e.target;
        // Avoid capturing clicks on our own UI
        if (el.closest('#macro-recorder-bar')) return;
        
        const info = {
            tagName: el.tagName,
            id: el.id || null,
            className: el.className || null,
            textContent: el.textContent ? el.textContent.trim().substring(0, 30) : ''
        };
        recordedSteps.push(info);
        // Visual feedback
        el.style.outline = '2px solid #61dafb';
        setTimeout(() => el.style.outline = '', 200);
        chrome.runtime.sendMessage({ action: "elementCaptured", elementInfo: info });
    }

    document.addEventListener('click', captureClick, true);

    // Cleanup function
    function cleanup() {
        clearInterval(timerInterval);
        document.removeEventListener('click', captureClick, true);
        bar.remove();
        window.__macroRecorderActive = false;
    }

    // Save button
    document.getElementById('macro-save-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('macro-name-input');
        const name = nameInput.value.trim();
        if (!name) {
            alert('Please enter a macro name');
            return;
        }
        chrome.runtime.sendMessage({ 
            action: "saveMacro", 
            name: name, 
            steps: recordedSteps 
        }, () => {
            chrome.runtime.sendMessage({ action: "stopRecording" });
            cleanup();
        });
    });

    // Cancel button
    document.getElementById('macro-cancel-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "stopRecording" });
        cleanup();
    });

    // Listen for hide command from background
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === "hideRecordingUI") {
            cleanup();
        }
    });
})();