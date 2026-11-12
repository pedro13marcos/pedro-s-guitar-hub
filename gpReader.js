// gpReader.js - Guitar Pro (.gp3, .gp4, .gp5, .gpx, .gp) Reader and Audio Player using alphaTab
document.addEventListener('DOMContentLoaded', () => {
    const gpFileInput = document.getElementById('gpFileInput');
    const gpDropZone = document.getElementById('gpDropZone');
    const gpPlayBtn = document.getElementById('gpPlayBtn');
    const gpStopBtn = document.getElementById('gpStopBtn');
    const gpTrackSelect = document.getElementById('gpTrackSelect');
    const gpSpeedSelect = document.getElementById('gpSpeedSelect');
    const gpZoomSelect = document.getElementById('gpZoomSelect');
    const gpSongTitle = document.getElementById('gpSongTitle');
    const gpSongArtist = document.getElementById('gpSongArtist');
    const gpStatusBadge = document.getElementById('gpStatusBadge');
    const gpMetaBar = document.getElementById('gpMetaBar');
    const loadSampleGpBtn = document.getElementById('loadSampleGpBtn');

    // Visual Follow-up HUD Elements
    const gpFollowUpBar = document.getElementById('gpFollowUpBar');
    const curTrackBadge = document.getElementById('curTrackBadge');
    const curBarBadge = document.getElementById('curBarBadge');
    const curBeatBadge = document.getElementById('curBeatBadge');
    const curTempoBadge = document.getElementById('curTempoBadge');
    const activeNotePreview = document.getElementById('activeNotePreview');

    const alphaTabContainer = document.getElementById('alphaTabContainer');

    let api = null;
    let isApiPlaying = false;

    // Canon in D sample in Guitar Pro format
    const SAMPLE_GP_URL = 'https://www.alphatab.net/files/canon.gp';

    // Initialize alphaTab instance with dark studio theme and SVG engine
    function initAlphaTab() {
        if (!alphaTabContainer || typeof alphaTab === 'undefined') {
            console.warn('alphaTab library not loaded');
            return;
        }

        api = new alphaTab.AlphaTabApi(alphaTabContainer, {
            core: {
                engine: 'svg', // Crisp vector SVG rendering
                logLevel: 'warning'
            },
            display: {
                layoutMode: 'page',
                staveProfile: 'default', // Auto-detects notation & tablature properly for both guitar & drums
                resources: {
                    // Dark theme matching Pedro's Guitar Hub
                    staffLineColor: 'rgba(255, 255, 255, 0.35)', // Tab, drum and staff lines
                    barSeparatorColor: 'rgba(255, 255, 255, 0.7)',
                    mainGlyphColor: '#f8fafc',                    // Crisp white notes, stems, drum heads
                    secondaryGlyphColor: '#94a3b8',
                    scoreInfoColor: '#38bdf8',                    // Cyan title/artist
                    barNumberColor: '#64748b',
                    fretNumberColor: '#38bdf8'
                }
            },
            player: {
                enablePlayer: true,
                enableCursor: true,
                scrollMode: 1, // Continuous scroll into view
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
            }
        });

        // Live Playback Tracker - Follow active bar, beat, tempo and notes
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
                curTempoBadge.textContent = `${Math.round(beat.voice.bar.tempoAutomation.value)} BPM`;
            }

            // Note / Fret or Percussion sound readout
            if (activeNotePreview && beat.notes && beat.notes.length > 0) {
                const noteDescriptions = beat.notes.map(n => {
                    if (n.isPercussion) {
                        return n.percussionElement ? n.percussionElement.name : 'Drum Hit';
                    }
                    return `${n.fret} (Str ${n.string})`;
                });
                activeNotePreview.textContent = noteDescriptions.join(', ');
            }
        });

        // Score loaded event
        api.scoreLoaded.on((score) => {
            if (gpSongTitle) gpSongTitle.textContent = score.title || 'Untitled Song';
            if (gpSongArtist) gpSongArtist.textContent = score.artist ? `by ${score.artist}` : '';
            if (gpStatusBadge) gpStatusBadge.textContent = 'READY';
            if (gpMetaBar) gpMetaBar.style.display = 'flex';
            if (gpFollowUpBar) gpFollowUpBar.style.display = 'flex';

            // Ensure drum tracks have standard notation enabled so percussion never renders blank
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

        // Post render finished
        api.postRenderFinished.on(() => {
            if (gpStatusBadge && gpStatusBadge.textContent === 'LOADING...') {
                gpStatusBadge.textContent = 'READY';
            }
        });
    }

    function updateCurrentTrackBadge(track) {
        if (!curTrackBadge || !track) return;
        const typeIcon = track.isPercussion ? '🥁' : '🎸';
        curTrackBadge.textContent = `${typeIcon} ${track.name || 'Track'}`;
    }

    // Load file from ArrayBuffer
    function loadGpBuffer(arrayBuffer) {
        if (!api) initAlphaTab();
        if (api) {
            if (gpStatusBadge) gpStatusBadge.textContent = 'LOADING...';
            const uint8 = new Uint8Array(arrayBuffer);
            api.load(uint8);
        }
    }

    // Load from URL
    function loadGpUrl(url) {
        if (!api) initAlphaTab();
        if (api) {
            if (gpStatusBadge) gpStatusBadge.textContent = 'DOWNLOADING...';
            api.load(url);
        }
    }

    // File input change
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

    // Drag and Drop
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

    // Sample button
    if (loadSampleGpBtn) {
        loadSampleGpBtn.addEventListener('click', () => {
            loadGpUrl(SAMPLE_GP_URL);
        });
    }

    // Play / Pause
    if (gpPlayBtn) {
        gpPlayBtn.addEventListener('click', () => {
            if (!api) return;
            api.playPause();
        });
    }

    // Stop
    if (gpStopBtn) {
        gpStopBtn.addEventListener('click', () => {
            if (!api) return;
            api.stop();
        });
    }

    // Track Select change
    if (gpTrackSelect) {
        gpTrackSelect.addEventListener('change', () => {
            if (!api || !api.score) return;
            const trackIdx = parseInt(gpTrackSelect.value, 10);
            if (!isNaN(trackIdx) && api.score.tracks[trackIdx]) {
                const selectedTrack = api.score.tracks[trackIdx];
                updateCurrentTrackBadge(selectedTrack);

                // If percussion, ensure notation is rendered properly
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

    // Speed Select
    if (gpSpeedSelect) {
        gpSpeedSelect.addEventListener('change', () => {
            if (!api) return;
            const speed = parseFloat(gpSpeedSelect.value);
            api.playbackSpeed = speed;
        });
    }

    // Zoom Select
    if (gpZoomSelect) {
        gpZoomSelect.addEventListener('change', () => {
            if (!api) return;
            const zoom = parseFloat(gpZoomSelect.value);
            api.settings.display.scale = zoom;
            api.updateSettings();
            api.render();
        });
    }

    // Lazy load alphaTab when the tab is clicked
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
