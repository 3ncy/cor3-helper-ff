// daily-hack-solver.js
// Auto-solver for daily hacking minigames on cor3.gg
// Handles both "System Log Integrity" and "Signal Hack" puzzles.
// Injected into MAIN world. Controllable via window.__dailyHackAbort flag.
// Based on auto-hack-script.txt logic.

(function () {
    if (window.__dailyHackActive) {
        console.warn('[COR3 Daily Hack] Solver already active.');
        return;
    }
    window.__dailyHackActive = true;
    window.__dailyHackAbort = false;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // --- Morse / Binary maps for Signal Hack ---
    const MORSE_MAP = {
        LLLLL: '0', SLLLL: '1', SSLLL: '2', SSSLL: '3', SSSSL: '4',
        SSSSS: '5', LSSSS: '6', LLSSS: '7', LLLSS: '8', LLLLS: '9'
    };
    const BINARY_MAP = {
        SSSS: '0', SSSL: '1', SSLS: '2', SSLL: '3', SLSS: '4',
        SLSL: '5', SLLS: '6', SLLL: '7', LSSS: '8', LSSL: '9'
    };

    // --- System Log Integrity: valid types & statuses ---
    const VALID_TYPES = new Set(['AUTH', 'TEMP-SYNC', 'SCAN', 'ROUTE-CHECK', 'RADIO-TEST', 'PING', 'SYNC']);
    const VALID_STATUSES = new Set(['OK', 'WARN', 'ERROR']);
    const ERROR_LABELS = {
        TIME: 'Time format is incorrect',
        TYPE: 'Event type is incorrect',
        MISSING_SECTOR: 'Missing /sector parameter',
        MISSING_STATUS: 'Missing /status parameter',
        SECTOR_BAD: '/sector parameter is incorrect',
        STATUS_BAD: '/status parameter is incorrect'
    };

    function analyzeLogLine(rawText) {
        const issues = [];
        const text = (rawText || '').trim();
        const timeMatch = text.match(/^\[(\d{2}):(\d{2}):(\d{2})\]\s+/);
        let rest = text;
        if (timeMatch) {
            const h = Number(timeMatch[1]), m = Number(timeMatch[2]), s = Number(timeMatch[3]);
            if (!(Number.isInteger(h) && h >= 0 && h <= 23 && Number.isInteger(m) && m >= 0 && m <= 59 && Number.isInteger(s) && s >= 0 && s <= 59)) issues.push('TIME');
            rest = text.slice(timeMatch[0].length);
        } else {
            issues.push('TIME');
        }
        const typeMatch = rest.match(/^([A-Z-]+)\b/);
        if (typeMatch) {
            if (!VALID_TYPES.has(typeMatch[1])) issues.push('TYPE');
            rest = rest.slice(typeMatch[0].length).trim();
        } else {
            issues.push('TYPE');
        }
        const hasSector = /(^|\s)\/sector=/.test(rest);
        const hasStatus = /(^|\s)\/status=/.test(rest);
        if (!hasSector) issues.push('MISSING_SECTOR');
        if (!hasStatus) issues.push('MISSING_STATUS');
        if (hasSector) {
            const sm = rest.match(/\/sector=([^\s]+)/);
            const sv = sm ? sm[1] : null;
            const sn = sv != null && /^[0-9]+$/.test(sv) ? Number(sv) : NaN;
            if (!(Number.isInteger(sn) && sn >= 1 && sn <= 256)) issues.push('SECTOR_BAD');
        }
        if (hasStatus) {
            const stm = rest.match(/\/status=([^\s]+)/);
            const stv = stm ? stm[1] : null;
            if (!(stv != null && VALID_STATUSES.has(stv))) issues.push('STATUS_BAD');
        }
        return [...new Set(issues)];
    }

    function clickCheckbox(entryEl) {
        const input = entryEl.querySelector('input[type="checkbox"]') ||
                       entryEl.querySelector('.checkbox input') ||
                       entryEl.querySelector('[role="checkbox"]') ||
                       entryEl.querySelector('input');
        if (!input) return false;
        if (input.tagName === 'INPUT' && input.type === 'checkbox') {
            if (!input.checked) {
                input.checked = true;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
            return true;
        }
        input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
    }

    function findErrorTypeButton(container, label) {
        return Array.from(container.querySelectorAll('.error-type-button'))
            .find(b => (b.textContent || '').trim() === label) || null;
    }

    // --- System Log Integrity solver ---
    async function solveSystemLogIntegrity() {
        console.log('[COR3 Daily Hack] Detected System Log Integrity puzzle');
        const logContainer = document.querySelector('.log-entries') ||
                             document.querySelector('.log-entries-holder') ||
                             document.querySelector('.log-entries-container') ||
                             document.querySelector('.log');
        if (!logContainer) {
            console.error('[COR3 Daily Hack] Could not find log-entries container.');
            return;
        }
        const entries = Array.from(logContainer.querySelectorAll('.log-entry'));
        if (!entries.length) {
            console.error('[COR3 Daily Hack] No .log-entry elements found.');
            return;
        }

        const analyzed = entries.map(el => {
            const textEl = el.querySelector('span') || el.querySelector('.log-text') || el;
            const text = (textEl?.textContent || '').trim();
            return { el, text, issues: analyzeLogLine(text) };
        }).filter(e => e.issues.length > 0);

        analyzed.sort((a, b) => b.issues.length - a.issues.length);
        const selected = analyzed.slice(0, 2);
        if (selected.length < 2) console.log(`[COR3 Daily Hack] Only found ${selected.length} invalid log(s).`);

        for (const entry of selected) {
            clickCheckbox(entry.el);
        }

        console.log(`[COR3 Daily Hack] Selected ${selected.length} wrong log(s):`);
        selected.forEach((e, i) => {
            console.log(`\n[SELECTED #${i + 1}] ${e.text}`);
            console.log('choices to select:');
            e.issues.forEach(iss => console.log(`  - ${ERROR_LABELS[iss] || iss}`));
        });

        // Click confirm button
        const confirmBtn = document.querySelector('.confirm-button');
        if (!confirmBtn) {
            console.error('[COR3 Daily Hack] Could not find .confirm-button');
            return;
        }
        confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(1000);

        // Handle analysis/fix phase
        const analysisContainer = document.querySelector('.analysis-container');
        if (!analysisContainer) {
            console.error('[COR3 Daily Hack] Could not find .analysis-container after confirming.');
            return;
        }

        const blocks = Array.from(analysisContainer.querySelectorAll('.error-analysis-block'));
        if (!blocks.length) {
            console.error('[COR3 Daily Hack] No .error-analysis-block found.');
            return;
        }

        const issueMap = new Map(selected.map(e => [e.text, e.issues]));

        for (const block of blocks) {
            const lineDisplay = block.querySelector('.log-line-display');
            const lineText = (lineDisplay?.textContent || '').trim();
            let issues = issueMap.get(lineText);
            if (!issues) {
                const match = selected.find(e => e.text === lineText) ||
                              selected.find(e => lineText && e.text && (e.text.includes(lineText) || lineText.includes(e.text)));
                issues = match ? match.issues : null;
            }
            if (!issues || !issues.length) {
                console.warn('[COR3 Daily Hack] Could not map analysis block to picked issues:', lineText);
                continue;
            }

            const fixBtn = block.querySelector('.fix-error-button');
            if (fixBtn) {
                fixBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                await sleep(50);
                for (const iss of issues) {
                    const label = ERROR_LABELS[iss] || iss;
                    const errBtn = findErrorTypeButton(block, label);
                    if (errBtn) {
                        errBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        await sleep(25);
                    } else {
                        console.warn('[COR3 Daily Hack] Could not find error-type-button for:', label);
                    }
                }
                console.log(`\n[FIXED] ${lineText}`);
                console.log('clicked:');
                issues.forEach(iss => console.log(`  - ${ERROR_LABELS[iss] || iss}`));
            } else {
                console.warn('[COR3 Daily Hack] Could not find .fix-error-button for:', lineText);
            }
        }
    }

    // --- Signal Hack solver (pulse timeline) ---
    function solveSignalHack() {
        console.log('[COR3 Daily Hack] Detected Signal Hack (pulse timeline) puzzle');
        const timeline = document.querySelector('.pulse-timeline');
        if (!timeline) {
            console.error('[COR3 Daily Hack] Could not find .pulse-timeline');
            return;
        }

        const groups = Array.from(timeline.querySelectorAll('.pulse-group'));
        const pulses = groups.map((g, i) => {
            const isShort = !!g.querySelector('.pulse-bar.short');
            const longCount = g.querySelectorAll('.pulse-bar.long').length;
            if (isShort) return 'S';
            if (longCount >= 3) return 'L';
            const bar = g.querySelector('.pulse-bar');
            if (bar?.classList.contains('short')) return 'S';
            if (bar?.classList.contains('long')) return 'L';
            console.warn(`[COR3 Daily Hack] Pulse group #${i} couldn't be classified. Using "?".`);
            return '?';
        });

        const decode = (groupSize, map) => {
            const result = [];
            for (let i = 0; i < pulses.length; i += groupSize) {
                const chunk = pulses.slice(i, i + groupSize);
                if (chunk.length < groupSize) break;
                result.push(map[chunk.join('')] ?? '?');
            }
            return result.join('');
        };

        const morseResult = decode(5, MORSE_MAP);
        const binaryResult = decode(4, BINARY_MAP);
        const countDigits = s => (s.match(/[0-9]/g) || []).length;
        const countUnknown = s => (s.match(/\?/g) || []).length;

        const md = countDigits(morseResult);
        const bd = countDigits(binaryResult);
        let encoding, value;
        if (md === 0 && bd === 0) {
            encoding = 'UNKNOWN';
            value = '';
        } else if (md > bd) {
            encoding = 'MORSE';
            value = morseResult;
        } else if (bd > md) {
            encoding = 'BINARY';
            value = binaryResult;
        } else if (countUnknown(morseResult) <= countUnknown(binaryResult)) {
            encoding = 'MORSE';
            value = morseResult;
        } else {
            encoding = 'BINARY';
            value = binaryResult;
        }

        console.log(`[COR3 Daily Hack] Type: ${encoding}`);
        console.log(`[COR3 Daily Hack] Value: ${value}`);
        console.log(`[COR3 Daily Hack] Pulses: ${pulses.join(' ')}`);

        // Report signal hack info to extension for display
        window.postMessage({
            type: 'COR3_DAILY_HACK_LOG',
            message: `Signal Hack → Type: ${encoding}, Value: ${value}`
        }, '*');
    }

    // --- Detect puzzle type ---
    function detectPuzzle() {
        if (document.querySelector('.pulse-timeline')) return 'signal';
        if (document.querySelector('.log-entries') || document.querySelector('.log-entries-holder') || document.querySelector('.log-entries-container') || document.querySelector('.log')) return 'log';
        return null;
    }

    // --- Main: detect puzzle type and solve, then keep polling for new hacks ---
    // Track the last puzzle DOM signature so we detect when a NEW hack starts
    let lastPuzzleSignature = null;

    function getPuzzleSignature() {
        // Build a signature from puzzle DOM to detect when a new puzzle appears
        const timeline = document.querySelector('.pulse-timeline');
        if (timeline) {
            const groups = timeline.querySelectorAll('.pulse-group');
            return 'signal:' + groups.length + ':' + timeline.innerHTML.length;
        }
        const logContainer = document.querySelector('.log-entries') ||
                             document.querySelector('.log-entries-holder') ||
                             document.querySelector('.log-entries-container') ||
                             document.querySelector('.log');
        if (logContainer) {
            const entries = logContainer.querySelectorAll('.log-entry');
            return 'log:' + entries.length + ':' + logContainer.innerHTML.length;
        }
        return null;
    }

    async function run() {
        console.log('[COR3 Daily Hack] Solver started, waiting for puzzle...');
        // Try up to 30 seconds for puzzle elements to appear
        let puzzle = detectPuzzle();
        let waited = 0;
        while (!puzzle && waited < 30000 && !window.__dailyHackAbort) {
            await sleep(500);
            waited += 500;
            puzzle = detectPuzzle();
        }

        if (window.__dailyHackAbort) {
            console.log('[COR3 Daily Hack] Aborted.');
            window.__dailyHackActive = false;
            return;
        }

        try {
            if (puzzle === 'signal') {
                solveSignalHack();
                lastPuzzleSignature = getPuzzleSignature();
            } else if (puzzle === 'log') {
                await solveSystemLogIntegrity();
                lastPuzzleSignature = getPuzzleSignature();
            } else {
                console.log('[COR3 Daily Hack] No known puzzle detected after 30s. Looking for ".pulse-timeline" or ".log-entries".');
                window.postMessage({
                    type: 'COR3_DAILY_HACK_LOG',
                    message: 'No puzzle detected. Navigate to the daily hack page first.'
                }, '*');
            }
        } catch (e) {
            console.error('[COR3 Daily Hack] Error:', e);
            window.postMessage({
                type: 'COR3_DAILY_HACK_LOG',
                message: 'Error: ' + (e.message || e)
            }, '*');
        }

        // Keep polling for new hacks (e.g. signal hack back-to-back)
        console.log('[COR3 Daily Hack] Solver finished. Monitoring for new puzzles...');
        pollForNewPuzzle();
    }

    async function pollForNewPuzzle() {
        while (!window.__dailyHackAbort) {
            await sleep(2000);
            if (window.__dailyHackAbort) break;

            const currentSig = getPuzzleSignature();
            // New puzzle appeared (different from last solved one)
            if (currentSig && currentSig !== lastPuzzleSignature) {
                console.log('[COR3 Daily Hack] New puzzle detected, solving...');
                const puzzle = detectPuzzle();
                try {
                    if (puzzle === 'signal') {
                        solveSignalHack();
                    } else if (puzzle === 'log') {
                        await solveSystemLogIntegrity();
                    }
                    lastPuzzleSignature = getPuzzleSignature();
                } catch (e) {
                    console.error('[COR3 Daily Hack] Error solving new puzzle:', e);
                    window.postMessage({
                        type: 'COR3_DAILY_HACK_LOG',
                        message: 'Error: ' + (e.message || e)
                    }, '*');
                }
            }
        }

        console.log('[COR3 Daily Hack] Polling stopped (aborted).');
        window.__dailyHackActive = false;
        window.__dailyHackAbort = false;
    }

    run();
})();
