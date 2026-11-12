// gpReader.js - Guitar Pro (.gp3, .gp4, .gp5, .gpx, .gp) Reader, Play Along Coach & Audio Player
document.addEventListener('DOMContentLoaded', () => {
    const gpFileInput = document.getElementById('gpFileInput');
    const gpDropZone = document.getElementById('gpDropZone');
    const gpPlayBtn = document.getElementById('gpPlayBtn');
    const gpStopBtn = document.getElementById('gpStopBtn');
    const gpTrackSelect = document.getElementById('gpTrackSelect');
    const gpSpeedSelect = document.getElementById('gpSpeedSelect');
    const gpBpmInput = document.getElementById('gpBpmInput');
    const gpRestoreSpeedBtn = document.getElementById('gpRestoreSpeedBtn');
    const gpZoomSelect = document.getElementById('gpZoomSelect');
    const gpSongTitle = document.getElementById('gpSongTitle');
    const gpSongArtist = document.getElementById('gpSongArtist');
    const gpStatusBadge = document.getElementById('gpStatusBadge');
    const gpMetaBar = document.getElementById('gpMetaBar');
    const loadSampleGpBtn = document.getElementById('loadSampleGpBtn');

    // Visual Follow-Up HUD Elements
    const gpFollowUpBar = document.getElementById('gpFollowUpBar');
    const curTrackBadge = document.getElementById('curTrackBadge');
    const curBarBadge = document.getElementById('curBarBadge');
    const curBeatBadge = document.getElementById('curBeatBadge');
    const curTempoBadge = document.getElementById('curTempoBadge');
    const activeNotePreview = document.getElementById('activeNotePreview');

    // Play Along Controls
    const playAlongToggle = document.getElementById('playAlongToggle');
    const playAlongModeSelect = document.getElementById('playAlongModeSelect');
    const playAlongFeedback = document.getElementById('playAlongFeedback');

    // Countdown Overlay Elements
    const gpCountdownOverlay = document.getElementById('gpCountdownOverlay');
    const countdownNumber = document.getElementById('countdownNumber');
    let isCountingDown = false;
    let countdownTimer = null;

    const alphaTabContainer = document.getElementById('alphaTabContainer');

    let api = null;
    let isApiPlaying = false;
    let originalBpm = 120;
    let playAlongEngine = null;
    let isPlayAlongActive = false;
    let playAlongListeningLoop = null;

    // Standard string base MIDI numbers: e4=64, B3=59, G3=55, D3=50, A2=45, E2=40
    const stringBaseMidi = [64, 59, 55, 50, 45, 40];

    // Canon in D sample in Guitar Pro format
    const SAMPLE_GP_URL = 'https://www.alphatab.net/files/canon.gp';

    function initAlphaTab() {
        if (!alphaTabContainer || typeof alphaTab === 'undefined') {
            console.warn('alphaTab library not loaded');
            return;
        }

        api = new alphaTab.AlphaTabApi(alphaTabContainer, {
            core: {
                engine: 'svg',
                logLevel: 'warning'
            },
            display: {
                layoutMode: 'page',
                staveProfile: 'default',
                resources: {
                    staffLineColor: 'rgba(255, 255, 255, 0.35)',
                    barSeparatorColor: 'rgba(255, 255, 255, 0.7)',
                    mainGlyphColor: '#f8fafc',
                    secondaryGlyphColor: '#94a3b8',
                    scoreInfoColor: '#38bdf8',
                    barNumberColor: '#64748b',
                    fretNumberColor: '#38bdf8'
                }
            },
            player: {
                enablePlayer: true,
                enableCursor: true,
                scrollMode: 1,
                scrollElement: '.alphatab-wrapper',
                soundFont: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2'
            }
        });

        // Player state events
        api.playerStateChanged.on((args) => {
            if (args.state === 1) { // Playing
                isApiPlaying = true;
                if (gpPlayBtn) {
                    gpPlayBtn.textContent = '⏸ Pause';
                    gpPlayBtn.classList.add('playing');
                }
                if (gpStatusBadge) gpStatusBadge.textContent = 'PLAYING';
            } else if (args.state === 2) { // Paused
                isApiPlaying = false;
                if (gpPlayBtn) {
                    gpPlayBtn.textContent = '▶ Play';
                    gpPlayBtn.classList.remove('playing');
                }
                if (gpStatusBadge) gpStatusBadge.textContent = 'PAUSED';
            } else { // Stopped
                isApiPlaying = false;
                if (gpPlayBtn) {
                    gpPlayBtn.textContent = '▶ Play';
                    gpPlayBtn.classList.remove('playing');
                }
                if (gpStatusBadge) gpStatusBadge.textContent = 'READY';
                if (activeNotePreview) activeNotePreview.textContent = '--';
                if (playAlongFeedback) {
                    playAlongFeedback.textContent = 'STANDBY';
                    playAlongFeedback.className = 'playalong-status-badge standby';
                }
            }
        });

        // Live Playback Tracker & Play Along Beat Verifier
        api.playedBeatChanged.on((beat) => {
            if (!beat) return;

            // Bar number
            if (curBarBadge && beat.voice && beat.voice.bar) {
                curBarBadge.textContent = `Bar ${beat.voice.bar.index + 1}`;
            }

            // Beat position
            if (curBeatBadge) {
                curBeatBadge.textContent = `Beat ${(beat.index % 4) + 1}`;
            }

            // Tempo
            if (curTempoBadge && beat.voice && beat.voice.bar && beat.voice.bar.tempoAutomation) {
                const bpm = Math.round(beat.voice.bar.tempoAutomation.value);
                curTempoBadge.textContent = `${bpm} BPM`;
            }

            // Extract target MIDI notes from current beat
            const targetMidiNotes = [];
            if (beat.notes && beat.notes.length > 0) {
                const noteDescriptions = beat.notes.map(n => {
                    if (n.isPercussion) {
                        return n.percussionElement ? n.percussionElement.name : 'Drum Hit';
                    }
                    const baseMidi = stringBaseMidi[n.string - 1] || 40;
                    const noteMidi = baseMidi + n.fret;
                    targetMidiNotes.push(noteMidi);
                    return `${n.fret} (Str ${n.string})`;
                });
                if (activeNotePreview) activeNotePreview.textContent = noteDescriptions.join(', ');
            } else {
                if (activeNotePreview) activeNotePreview.textContent = 'Rest';
            }

            // Execute Play Along Verification if active
            if (isPlayAlongActive && targetMidiNotes.length > 0) {
                verifyPlayAlongBeat(targetMidiNotes, beat);
            }
        });

        // Score loaded event
        api.scoreLoaded.on((score) => {
            if (gpSongTitle) gpSongTitle.textContent = score.title || 'Untitled Song';
            if (gpSongArtist) gpSongArtist.textContent = score.artist ? `by ${score.artist}` : '';
            if (gpStatusBadge) gpStatusBadge.textContent = 'READY';
            if (gpMetaBar) gpMetaBar.style.display = 'flex';
            if (gpFollowUpBar) gpFollowUpBar.style.display = 'flex';

            // Capture original song tempo
            originalBpm = score.tempo || 120;
            if (gpBpmInput) gpBpmInput.value = originalBpm;
            if (gpSpeedSelect) gpSpeedSelect.value = "1.0";

            // Fix drums tracks
            score.tracks.forEach(t => {
                if (t.isPercussion) {
                    t.staves.forEach(stave => {
                        stave.showStandardNotation = true;
                        stave.showTablature = false;
                    });
                }
            });

            // Populate Track Select
            if (gpTrackSelect) {
                gpTrackSelect.innerHTML = '';
                score.tracks.forEach((track, index) => {
                    const opt = document.createElement('option');
                    opt.value = index;
                    const typeLabel = track.isPercussion ? '🥁 Drums' : (track.name.toLowerCase().includes('bass') ? '🎸 Bass' : '🎸 Guitar');
                    opt.textContent = `${index + 1}. ${track.name || 'Track ' + (index + 1)} (${typeLabel})`;
                    gpTrackSelect.appendChild(opt);
                });
                gpTrackSelect.value = 0;
                updateCurrentTrackBadge(score.tracks[0]);
            }
        });

        api.postRenderFinished.on(() => {
            if (gpStatusBadge && gpStatusBadge.textContent === 'LOADING...') {
                gpStatusBadge.textContent = 'READY';
            }
        });
    }

    // Play Along Verification Logic
    function verifyPlayAlongBeat(targetMidiNotes, beat) {
        if (!playAlongEngine || !playAlongEngine.isRunning) return;

        const mode = playAlongModeSelect ? playAlongModeSelect.value : 'stop';
        let evalResult = playAlongEngine.evaluateMatch(targetMidiNotes);

        if (evalResult.matched) {
            // Note Hit!
            showPlayAlongResult('HIT! (In Tune)', 'hit');
        } else {
            // Note Missed
            if (mode === 'stop') {
                // Pause playback until user plays the note correctly
                api.pause();
                showPlayAlongResult('WAITING FOR CORRECT NOTE...', 'wait');

                if (playAlongListeningLoop) clearInterval(playAlongListeningLoop);
                playAlongListeningLoop = setInterval(() => {
                    evalResult = playAlongEngine.evaluateMatch(targetMidiNotes);
                    if (evalResult.matched) {
                        clearInterval(playAlongListeningLoop);
                        playAlongListeningLoop = null;
                        showPlayAlongResult('CORRECT! RESUMING...', 'hit');
                        setTimeout(() => {
                            if (isPlayAlongActive) api.play();
                        }, 250);
                    }
                }, 100);
            } else {
                // Keep going, mark missed beat with red highlight
                showPlayAlongResult('MISSED NOTE', 'miss');
                highlightMissedBeatInRed();
            }
        }
    }

    function showPlayAlongResult(text, type) {
        if (!playAlongFeedback) return;
        playAlongFeedback.textContent = text;
        playAlongFeedback.className = `playalong-status-badge ${type}`;
    }

    function highlightMissedBeatInRed() {
        const beatEl = document.querySelector('.at-cursor-beat');
        if (beatEl) {
            beatEl.classList.add('missed-red-glow');
            setTimeout(() => {
                beatEl.classList.remove('missed-red-glow');
            }, 600);
        }
    }

    function updateCurrentTrackBadge(track) {
        if (!curTrackBadge || !track) return;
        const typeIcon = track.isPercussion ? '🥁' : '🎸';
        curTrackBadge.textContent = `${typeIcon} ${track.name || 'Track'}`;
    }

    function loadGpBuffer(arrayBuffer) {
        if (!api) initAlphaTab();
        if (api) {
            if (gpStatusBadge) gpStatusBadge.textContent = 'LOADING...';
            const uint8 = new Uint8Array(arrayBuffer);
            api.load(uint8);
        }
    }

    function loadGpUrl(url) {
        if (!api) initAlphaTab();
        if (api) {
            if (gpStatusBadge) gpStatusBadge.textContent = 'DOWNLOADING...';
            api.load(url);
        }
    }

    // Play Along Toggle Switch
    if (playAlongToggle) {
        playAlongToggle.addEventListener('change', async () => {
            isPlayAlongActive = playAlongToggle.checked;
            if (isPlayAlongActive) {
                try {
                    if (!playAlongEngine) {
                        playAlongEngine = new window.PlayAlongEngine();
                    }
                    await playAlongEngine.start();
                    showPlayAlongResult('COACH LISTENING...', 'listening');
                } catch (e) {
                    console.error("Mic error:", e);
                    playAlongToggle.checked = false;
                    isPlayAlongActive = false;
                    alert("Could not access microphone for Play Along coach. Please grant mic permission.");
                }
            } else {
                if (playAlongEngine) playAlongEngine.stop();
                if (playAlongListeningLoop) clearInterval(playAlongListeningLoop);
                showPlayAlongResult('OFF', 'standby');
            }
        });
    }

    // Speed Multiplier Select
    if (gpSpeedSelect) {
        gpSpeedSelect.addEventListener('change', () => {
            if (!api) return;
            const speed = parseFloat(gpSpeedSelect.value);
            api.playbackSpeed = speed;
            // Update BPM input to reflect scaled tempo
            if (gpBpmInput) {
                gpBpmInput.value = Math.round(originalBpm * speed);
            }
        });
    }

    // Direct BPM Input
    if (gpBpmInput) {
        gpBpmInput.addEventListener('input', () => {
            if (!api) return;
            const newBpm = parseInt(gpBpmInput.value, 10);
            if (!isNaN(newBpm) && newBpm > 20 && newBpm <= 400 && originalBpm > 0) {
                const calculatedSpeed = newBpm / originalBpm;
                api.playbackSpeed = calculatedSpeed;
                // Update speed selector dropdown if exact match exists, or leave custom
                if (gpSpeedSelect) {
                    const matchOpt = Array.from(gpSpeedSelect.options).find(o => Math.abs(parseFloat(o.value) - calculatedSpeed) < 0.05);
                    if (matchOpt) {
                        gpSpeedSelect.value = matchOpt.value;
                    }
                }
            }
        });
    }

    // Restore Speed & BPM to Original
    if (gpRestoreSpeedBtn) {
        gpRestoreSpeedBtn.addEventListener('click', () => {
            if (!api) return;
            api.playbackSpeed = 1.0;
            if (gpSpeedSelect) gpSpeedSelect.value = "1.0";
            if (gpBpmInput) gpBpmInput.value = originalBpm;
        });
    }

    if (gpFileInput) {
        gpFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    loadGpBuffer(event.target.result);
                };
                reader.readAsArrayBuffer(file);
            }
        });
    }

    if (gpDropZone) {
        gpDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            gpDropZone.classList.add('drag-over');
        });
        gpDropZone.addEventListener('dragleave', () => {
            gpDropZone.classList.remove('drag-over');
        });
        gpDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            gpDropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    loadGpBuffer(event.target.result);
                };
                reader.readAsArrayBuffer(file);
            }
        });
    }

    if (loadSampleGpBtn) {
        loadSampleGpBtn.addEventListener('click', () => {
            loadGpUrl(SAMPLE_GP_URL);
        });
    }

    // Beep audio click for countdown beats
    let countdownAudioCtx = null;
    function playCountdownClick(isFinal) {
        try {
            if (!countdownAudioCtx) {
                countdownAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (countdownAudioCtx.state === 'suspended') {
                countdownAudioCtx.resume();
            }
            const osc = countdownAudioCtx.createOscillator();
            const gain = countdownAudioCtx.createGain();

            osc.type = "sine";
            // High pitch on 1 (final beat), lower on 4, 3, 2
            osc.frequency.setValueAtTime(isFinal ? 1200 : 800, countdownAudioCtx.currentTime);

            gain.gain.setValueAtTime(0.25, countdownAudioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, countdownAudioCtx.currentTime + 0.15);

            osc.connect(gain);
            gain.connect(countdownAudioCtx.destination);

            osc.start();
            osc.stop(countdownAudioCtx.currentTime + 0.15);
        } catch (e) {
            console.warn("Countdown click error:", e);
        }
    }

    // Trigger 4-3-2-1 countdown before starting
    function startCountdownAndPlay() {
        if (!api || isCountingDown) return;

        // If song is currently paused, resume immediately without countdown
        if (api.playerState === 2) {
            api.playPause();
            return;
        }

        // Calculate beat duration based on active BPM & speed
        const currentBpm = gpBpmInput ? parseInt(gpBpmInput.value, 10) : originalBpm;
        const beatIntervalMs = Math.max(250, Math.min(1000, 60000 / (currentBpm || 120)));

        isCountingDown = true;
        let count = 4;

        if (gpCountdownOverlay && countdownNumber) {
            countdownNumber.textContent = count;
            gpCountdownOverlay.style.display = 'flex';
        }

        if (gpStatusBadge) gpStatusBadge.textContent = 'COUNTDOWN...';
        playCountdownClick(false);

        countdownTimer = setInterval(() => {
            count--;
            if (count > 0) {
                if (countdownNumber) countdownNumber.textContent = count;
                playCountdownClick(count === 1);
            } else {
                // Countdown complete
                clearInterval(countdownTimer);
                countdownTimer = null;
                isCountingDown = false;
                if (gpCountdownOverlay) gpCountdownOverlay.style.display = 'none';

                // Start alphaTab audio playback
                api.play();
            }
        }, beatIntervalMs);
    }

    function cancelCountdown() {
        if (isCountingDown) {
            if (countdownTimer) clearInterval(countdownTimer);
            countdownTimer = null;
            isCountingDown = false;
            if (gpCountdownOverlay) gpCountdownOverlay.style.display = 'none';
        }
    }

    if (gpPlayBtn) {
        gpPlayBtn.addEventListener('click', () => {
            if (!api) return;
            if (isApiPlaying) {
                api.pause();
            } else {
                startCountdownAndPlay();
            }
        });
    }

    if (gpStopBtn) {
        gpStopBtn.addEventListener('click', () => {
            cancelCountdown();
            if (!api) return;
            api.stop();
            if (playAlongListeningLoop) clearInterval(playAlongListeningLoop);
        });
    }

    if (gpTrackSelect) {
        gpTrackSelect.addEventListener('change', () => {
            if (!api || !api.score) return;
            const trackIdx = parseInt(gpTrackSelect.value, 10);
            if (!isNaN(trackIdx) && api.score.tracks[trackIdx]) {
                const selectedTrack = api.score.tracks[trackIdx];
                updateCurrentTrackBadge(selectedTrack);

                if (selectedTrack.isPercussion) {
                    selectedTrack.staves.forEach(stave => {
                        stave.showStandardNotation = true;
                        stave.showTablature = false;
                    });
                }

                api.renderTracks([selectedTrack]);
            }
        });
    }

    if (gpZoomSelect) {
        gpZoomSelect.addEventListener('change', () => {
            if (!api) return;
            const zoom = parseFloat(gpZoomSelect.value);
            api.settings.display.scale = zoom;
            api.updateSettings();
            api.render();
        });
    }

    const gpTabBtn = document.querySelector('.tab-button[data-tab="gpreader"]');
    if (gpTabBtn) {
        gpTabBtn.addEventListener('click', () => {
            if (!api) {
                setTimeout(initAlphaTab, 100);
            } else {
                setTimeout(() => {
                    if (api) api.render();
                }, 100);
            }
        });
    }
});
