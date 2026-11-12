// tabReader.js - ASCII Guitar Tablature Reader & Synthesizer Player
document.addEventListener('DOMContentLoaded', () => {
    const inputArea = document.getElementById("asciiInputArea");
    const parseBtn = document.getElementById("parseTabBtn");
    const loadSampleBtn = document.getElementById("loadSampleTabBtn");
    const playBtn = document.getElementById("playReaderBtn");
    const stopBtn = document.getElementById("stopReaderBtn");
    const clearBtn = document.getElementById("clearReaderBtn");
    const speedSlider = document.getElementById("readerSpeed");
    const speedValue = document.getElementById("readerSpeedVal");
    const visualizer = document.getElementById("readerVisualizer");
    const statusMsg = document.getElementById("readerStatus");

    // Standard string base MIDI numbers: e4=64, B3=59, G3=55, D3=50, A2=45, E2=40
    const stringBaseMidi = [64, 59, 55, 50, 45, 40];
    const defaultTuning = ["e", "B", "G", "D", "A", "E"];

    let parsedBlocks = []; // Array of { stringNames: [], columns: [{ notes: [{stringIdx, fret}] }] }
    let playbackTimeout = null;
    let isPlaying = false;
    let currentStep = 0;
    let totalSteps = 0;
    let audioCtx = null;

    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playNoteAudio(stringIdx, fret) {
        if (isNaN(fret)) return;
        const midi = stringBaseMidi[stringIdx] + fret;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);

        try {
            const ctx = getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, ctx.currentTime);

            gain.gain.setValueAtTime(0.28, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.9);
        } catch (e) {
            console.error("Playback audio error:", e);
        }
    }

    // Sample classic guitar riff (Smoke on the Water intro)
    const sampleTab = `e|-----------------------------------|
B|-----------------------------------|
G|--0---3---5---0---3---6-5---0---3--|
D|--0---3---5---0---3---6-5---0---3--|
A|-----------------------------------|
E|-----------------------------------|`;

    if (loadSampleBtn) {
        loadSampleBtn.addEventListener("click", () => {
            if (inputArea) {
                inputArea.value = sampleTab;
                parseAsciiTab();
            }
        });
    }

    // Parse ASCII text into playable timeline
    function parseAsciiTab() {
        stopPlayback();
        const text = inputArea.value;
        const lines = text.split("\n").map(l => l.trimEnd()).filter(l => l.length > 0);

        parsedBlocks = [];
        let currentBlockLines = [];

        // Group consecutive lines that look like strings into 6-line blocks
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check if line looks like a guitar tab string (contains '-' and '|')
            if (line.includes("-") && (line.includes("|") || /^[eBGDAE0-9]/i.test(line))) {
                currentBlockLines.push(line);
                if (currentBlockLines.length === 6) {
                    processTabBlock(currentBlockLines);
                    currentBlockLines = [];
                }
            } else {
                if (currentBlockLines.length === 6) {
                    processTabBlock(currentBlockLines);
                }
                currentBlockLines = [];
            }
        }

        if (currentBlockLines.length === 6) {
            processTabBlock(currentBlockLines);
        }

        renderVisualizer();
    }

    function processTabBlock(lines) {
        const stringNames = [];
        const rawStrings = [];

        lines.forEach((line, idx) => {
            let name = defaultTuning[idx];
            let content = line;

            // Match string header e.g. "e|", "B|", "e|"
            const match = line.match(/^([eBGDAE]|1|2|3|4|5|6)?\s*[:|](.*)$/i);
            if (match) {
                if (match[1]) name = match[1];
                content = match[2];
            }
            stringNames.push(name);
            rawStrings.push(content);
        });

        // Determine max length across strings
        const maxLen = Math.max(...rawStrings.map(s => s.length));
        const columns = [];

        for (let c = 0; c < maxLen; c++) {
            const colNotes = [];
            for (let r = 0; r < 6; r++) {
                const char = rawStrings[r][c] || "-";
                // Look for numbers (frets)
                if (char >= "0" && char <= "9") {
                    let fretNum = parseInt(char, 10);
                    // Check next char for double digit (12, 14, etc.)
                    const nextChar = rawStrings[r][c + 1];
                    if (nextChar >= "0" && nextChar <= "9") {
                        fretNum = parseInt(char + nextChar, 10);
                    }
                    colNotes.push({ stringIdx: r, fret: fretNum, char });
                } else if (char !== "-" && char !== "|" && char !== " ") {
                    colNotes.push({ stringIdx: r, fret: NaN, technique: char });
                }
            }
            columns.push(colNotes);
        }

        parsedBlocks.push({ stringNames, columns, rawStrings });
    }

    function renderVisualizer() {
        if (!visualizer) return;
        visualizer.innerHTML = "";

        if (parsedBlocks.length === 0) {
            visualizer.innerHTML = `<p class="empty-tab-hint">Paste an ASCII guitar tab above and click <strong>"Parse & Load Tab"</strong> to visualize and listen.</p>`;
            if (statusMsg) statusMsg.textContent = "Waiting for tab...";
            return;
        }

        let globalStepCounter = 0;

        parsedBlocks.forEach((block, blockIdx) => {
            const blockDiv = document.createElement("div");
            blockDiv.className = "reader-block";

            const table = document.createElement("table");
            table.className = "reader-table";

            for (let r = 0; r < 6; r++) {
                const tr = document.createElement("tr");
                const th = document.createElement("th");
                th.className = "reader-string-label";
                th.textContent = block.stringNames[r];
                tr.appendChild(th);

                for (let c = 0; c < block.columns.length; c++) {
                    const td = document.createElement("td");
                    td.className = "reader-cell";
                    td.dataset.block = blockIdx;
                    td.dataset.col = c;
                    td.dataset.step = globalStepCounter + c;

                    const noteOnString = block.columns[c].find(n => n.stringIdx === r);
                    if (noteOnString) {
                        td.textContent = isNaN(noteOnString.fret) ? noteOnString.technique : noteOnString.fret;
                        td.classList.add("has-note");
                    } else {
                        td.textContent = "-";
                    }

                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }

            blockDiv.appendChild(table);
            visualizer.appendChild(blockDiv);
            globalStepCounter += block.columns.length;
        });

        totalSteps = globalStepCounter;
        if (statusMsg) {
            statusMsg.textContent = `Tab Loaded: ${parsedBlocks.length} block(s), ${totalSteps} beats. Ready to play!`;
        }
    }

    function startPlayback() {
        if (totalSteps === 0) {
            parseAsciiTab();
            if (totalSteps === 0) return;
        }

        isPlaying = true;
        if (playBtn) {
            playBtn.textContent = "⏸ Pause";
            playBtn.classList.add("playing");
        }
        if (statusMsg) statusMsg.textContent = "Playing...";

        playNextStep();
    }

    function playNextStep() {
        if (!isPlaying) return;

        if (currentStep >= totalSteps) {
            stopPlayback();
            currentStep = 0;
            return;
        }

        // Highlight active column across blocks
        document.querySelectorAll(".reader-cell").forEach(cell => {
            if (parseInt(cell.dataset.step, 10) === currentStep) {
                cell.classList.add("reader-cursor");
                cell.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            } else {
                cell.classList.remove("reader-cursor");
            }
        });

        // Find notes at current step and play
        let stepOffset = 0;
        for (let b = 0; b < parsedBlocks.length; b++) {
            const block = parsedBlocks[b];
            if (currentStep >= stepOffset && currentStep < stepOffset + block.columns.length) {
                const colIdx = currentStep - stepOffset;
                const notes = block.columns[colIdx];
                notes.forEach(n => {
                    if (!isNaN(n.fret)) {
                        playNoteAudio(n.stringIdx, n.fret);
                    }
                });
                break;
            }
            stepOffset += block.columns.length;
        }

        currentStep++;
        const speed = speedSlider ? parseInt(speedSlider.value, 10) : 180;
        playbackTimeout = setTimeout(playNextStep, speed);
    }

    function stopPlayback() {
        isPlaying = false;
        if (playbackTimeout) {
            clearTimeout(playbackTimeout);
            playbackTimeout = null;
        }
        if (playBtn) {
            playBtn.textContent = "▶ Play Tab";
            playBtn.classList.remove("playing");
        }
        document.querySelectorAll(".reader-cursor").forEach(el => el.classList.remove("reader-cursor"));
    }

    if (parseBtn) parseBtn.addEventListener("click", parseAsciiTab);

    if (playBtn) {
        playBtn.addEventListener("click", () => {
            if (isPlaying) {
                stopPlayback();
            } else {
                startPlayback();
            }
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            stopPlayback();
            currentStep = 0;
            if (statusMsg) statusMsg.textContent = "Playback stopped.";
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            stopPlayback();
            if (inputArea) inputArea.value = "";
            parsedBlocks = [];
            totalSteps = 0;
            currentStep = 0;
            renderVisualizer();
        });
    }

    if (speedSlider) {
        speedSlider.addEventListener("input", () => {
            if (speedValue) speedValue.textContent = `${speedSlider.value} ms`;
        });
    }

    // Auto-parse on page load if default value exists
    if (inputArea && inputArea.value.trim().length > 0) {
        parseAsciiTab();
    }
});
