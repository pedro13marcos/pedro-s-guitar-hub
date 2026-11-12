// tabMaker.js - Interactive Guitar Tablature Editor
document.addEventListener('DOMContentLoaded', () => {
    const stringNames = ["e", "B", "G", "D", "A", "E"]; // Standard tuning (high e to low E)
    let totalColumns = 32;
    // 6 rows x totalColumns grid storing string/symbol values
    let tabGrid = Array.from({ length: 6 }, () => Array(totalColumns).fill("-"));

    let selectedRow = 0; // 0 (high e) to 5 (low E)
    let selectedCol = 0; // 0 to totalColumns-1
    let playbackInterval = null;

    const gridContainer = document.getElementById("tabGridContainer");
    const tabOutput = document.getElementById("tabAsciiOutput");
    const addColBtn = document.getElementById("addColBtn");
    const removeColBtn = document.getElementById("removeColBtn");
    const clearTabBtn = document.getElementById("clearTabBtn");
    const copyTabBtn = document.getElementById("copyTabBtn");
    const playTabBtn = document.getElementById("playTabBtn");

    // Standard open string MIDI base numbers:
    // e4 = 64, B3 = 59, G3 = 55, D3 = 50, A2 = 45, E2 = 40
    const stringBaseMidi = [64, 59, 55, 50, 45, 40];

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

    function playFretAudio(stringIdx, fretStr) {
        const fret = parseInt(fretStr, 10);
        if (isNaN(fret)) return;
        const midi = stringBaseMidi[stringIdx] + fret;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);

        try {
            const ctx = getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // Pluck-like synthesis
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, ctx.currentTime);

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.9);
        } catch (e) {
            console.error("Audio playback error:", e);
        }
    }

    // Render interactive visual grid
    function renderGrid() {
        if (!gridContainer) return;
        gridContainer.innerHTML = "";

        const table = document.createElement("table");
        table.className = "tab-table";

        for (let r = 0; r < 6; r++) {
            const tr = document.createElement("tr");

            // String Label header
            const th = document.createElement("th");
            th.className = "string-label";
            th.textContent = stringNames[r];
            tr.appendChild(th);

            for (let c = 0; c < totalColumns; c++) {
                const td = document.createElement("td");
                td.className = "tab-cell";
                td.dataset.row = r;
                td.dataset.col = c;

                const val = tabGrid[r][c];
                td.textContent = val;

                if (val !== "-") {
                    td.classList.add("has-note");
                }
                if (r === selectedRow && c === selectedCol) {
                    td.classList.add("cursor-active");
                }

                // Click on string cell to position cursor
                td.addEventListener("click", () => {
                    selectCell(r, c);
                });

                tr.appendChild(td);
            }
            table.appendChild(tr);
        }

        gridContainer.appendChild(table);
        updateAsciiOutput();
    }

    function selectCell(r, c) {
        selectedRow = Math.max(0, Math.min(5, r));
        selectedCol = Math.max(0, Math.min(totalColumns - 1, c));
        highlightCursor();
    }

    function highlightCursor() {
        document.querySelectorAll(".tab-cell").forEach(cell => {
            const r = parseInt(cell.dataset.row, 10);
            const c = parseInt(cell.dataset.col, 10);
            if (r === selectedRow && c === selectedCol) {
                cell.classList.add("cursor-active");
                cell.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            } else {
                cell.classList.remove("cursor-active");
            }
        });
    }

    function insertValue(val) {
        tabGrid[selectedRow][selectedCol] = val;
        playFretAudio(selectedRow, val);

        // Move to next column
        if (selectedCol < totalColumns - 1) {
            selectedCol++;
        }
        renderGrid();
    }

    function deleteCurrent() {
        tabGrid[selectedRow][selectedCol] = "-";
        renderGrid();
    }

    function backspace() {
        tabGrid[selectedRow][selectedCol] = "-";
        if (selectedCol > 0) {
            selectedCol--;
        }
        renderGrid();
    }

    // Convert tab grid to ASCII text format for copy/export
    function updateAsciiOutput() {
        if (!tabOutput) return;
        let ascii = "";
        for (let r = 0; r < 6; r++) {
            ascii += stringNames[r] + "|";
            for (let c = 0; c < totalColumns; c++) {
                ascii += tabGrid[r][c];
            }
            ascii += "|\n";
        }
        tabOutput.value = ascii;
    }

    // Keyboard navigation & notation input
    document.addEventListener("keydown", (e) => {
        // Only handle when Tab Maker tab is active
        const tabMakerContent = document.getElementById("tabmaker");
        if (!tabMakerContent || !tabMakerContent.classList.contains("active")) return;

        // If user is focused on the ASCII output textarea or other input, skip
        if (document.activeElement === tabOutput) return;

        // Number keys (0 to 9) for frets
        if (e.key >= "0" && e.key <= "9") {
            e.preventDefault();
            const curVal = tabGrid[selectedRow][selectedCol];
            // If already has 1 or 2, allow multi-digit like 12, 14, 21
            if (curVal !== "-" && (curVal === "1" || curVal === "2") && curVal.length === 1) {
                insertValue(curVal + e.key);
            } else {
                insertValue(e.key);
            }
            return;
        }

        // Navigation keys
        if (e.key === "ArrowRight") {
            e.preventDefault();
            selectCell(selectedRow, selectedCol + 1);
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            selectCell(selectedRow, selectedCol - 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectCell(selectedRow - 1, selectedCol);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            selectCell(selectedRow + 1, selectedCol);
        } else if (e.key === "Delete") {
            e.preventDefault();
            deleteCurrent();
        } else if (e.key === "Backspace") {
            e.preventDefault();
            backspace();
        } else if (e.key.toLowerCase() === "h") {
            e.preventDefault();
            insertValue("h"); // Hammer-on
        } else if (e.key.toLowerCase() === "p") {
            e.preventDefault();
            insertValue("p"); // Pull-off
        } else if (e.key.toLowerCase() === "b") {
            e.preventDefault();
            insertValue("b"); // Bend
        } else if (e.key.toLowerCase() === "r") {
            e.preventDefault();
            insertValue("r"); // Release bend
        } else if (e.key.toLowerCase() === "s" || e.key === "/") {
            e.preventDefault();
            insertValue("/"); // Slide up
        } else if (e.key === "\\") {
            e.preventDefault();
            insertValue("\\"); // Slide down
        } else if (e.key.toLowerCase() === "v" || e.key === "~") {
            e.preventDefault();
            insertValue("~"); // Vibrato
        } else if (e.key.toLowerCase() === "x") {
            e.preventDefault();
            insertValue("x"); // Mute / Dead note
        } else if (e.key === "|") {
            e.preventDefault();
            insertValue("|"); // Bar line
        } else if (e.key === " ") {
            e.preventDefault();
            // Advance cursor with space
            if (selectedCol < totalColumns - 1) {
                selectCell(selectedRow, selectedCol + 1);
            }
        }
    });

    // Toolbar Technique Buttons
    document.querySelectorAll(".technique-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const sym = btn.dataset.sym;
            if (sym) {
                insertValue(sym);
            }
        });
    });

    // Fret numpad buttons
    document.querySelectorAll(".fret-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const fret = btn.dataset.fret;
            if (fret !== undefined) {
                insertValue(fret);
            }
        });
    });

    // Add Column
    if (addColBtn) {
        addColBtn.addEventListener("click", () => {
            totalColumns += 8;
            for (let r = 0; r < 6; r++) {
                for (let i = 0; i < 8; i++) {
                    tabGrid[r].push("-");
                }
            }
            renderGrid();
        });
    }

    // Remove Column
    if (removeColBtn) {
        removeColBtn.addEventListener("click", () => {
            if (totalColumns > 8) {
                totalColumns -= 8;
                for (let r = 0; r < 6; r++) {
                    tabGrid[r].splice(totalColumns, 8);
                }
                if (selectedCol >= totalColumns) {
                    selectedCol = totalColumns - 1;
                }
                renderGrid();
            }
        });
    }

    // Clear
    if (clearTabBtn) {
        clearTabBtn.addEventListener("click", () => {
            if (confirm("Clear all tabs?")) {
                tabGrid = Array.from({ length: 6 }, () => Array(totalColumns).fill("-"));
                selectedRow = 0;
                selectedCol = 0;
                renderGrid();
            }
        });
    }

    // Copy ASCII
    if (copyTabBtn) {
        copyTabBtn.addEventListener("click", () => {
            if (tabOutput) {
                tabOutput.select();
                navigator.clipboard.writeText(tabOutput.value).then(() => {
                    const originalText = copyTabBtn.textContent;
                    copyTabBtn.textContent = "✓ Copied!";
                    setTimeout(() => {
                        copyTabBtn.textContent = originalText;
                    }, 1500);
                });
            }
        });
    }

    // Audio Playback of the Tab
    if (playTabBtn) {
        playTabBtn.addEventListener("click", () => {
            if (playbackInterval) {
                clearInterval(playbackInterval);
                playbackInterval = null;
                playTabBtn.textContent = "▶ Play Tab";
                playTabBtn.classList.remove("playing");
                highlightCursor();
                return;
            }

            let playCol = 0;
            playTabBtn.textContent = "⏹ Stop";
            playTabBtn.classList.add("playing");

            playbackInterval = setInterval(() => {
                if (playCol >= totalColumns) {
                    clearInterval(playbackInterval);
                    playbackInterval = null;
                    playTabBtn.textContent = "▶ Play Tab";
                    playTabBtn.classList.remove("playing");
                    selectCell(selectedRow, selectedCol);
                    return;
                }

                selectCell(selectedRow, playCol);

                // Play all notes present in column playCol
                for (let r = 0; r < 6; r++) {
                    const val = tabGrid[r][playCol];
                    if (val !== "-" && !isNaN(parseInt(val, 10))) {
                        playFretAudio(r, val);
                    }
                }

                playCol++;
            }, 200); // 200ms per column step
        });
    }

    // Initial render
    renderGrid();
});
