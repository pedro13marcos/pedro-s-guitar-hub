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

    const alphaTabContainer = document.getElementById('alphaTabContainer');

    let api = null;
    let isApiPlaying = false;

    // Canon in D sample in Guitar Pro format (classic public domain demo)
    const SAMPLE_GP_URL = 'https://www.alphatab.net/files/canon.gp';

    // Initialize alphaTab instance
    function initAlphaTab() {
        if (!alphaTabContainer || typeof alphaTab === 'undefined') {
            console.warn('alphaTab library not loaded');
            return;
        }

        api = new alphaTab.AlphaTabApi(alphaTabContainer, {
            core: {
                engine: 'html5',
                logLevel: 'warning'
            },
            display: {
                layoutMode: 'page',
                staveProfile: 'tab', // Show tablature
            },
            player: {
                enablePlayer: true,
                enableCursor: true,
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
            }
        });

        // Score loaded event
        api.scoreLoaded.on((score) => {
            if (gpSongTitle) gpSongTitle.textContent = score.title || 'Untitled Song';
            if (gpSongArtist) gpSongArtist.textContent = score.artist ? `by ${score.artist}` : '';
            if (gpStatusBadge) gpStatusBadge.textContent = 'READY';
            if (gpMetaBar) gpMetaBar.style.display = 'flex';

            // Populate Track Select
            if (gpTrackSelect) {
                gpTrackSelect.innerHTML = '';
                score.tracks.forEach((track, index) => {
                    const opt = document.createElement('option');
                    opt.value = index;
                    opt.textContent = `${index + 1}. ${track.name || 'Track ' + (index + 1)}`;
                    gpTrackSelect.appendChild(opt);
                });
                gpTrackSelect.value = 0;
            }
        });
    }

    // Load file from ArrayBuffer
    function loadGpBuffer(arrayBuffer) {
        if (!api) initAlphaTab();
        if (api) {
            if (gpStatusBadge) gpStatusBadge.textContent = 'LOADING...';
            api.load(arrayBuffer);
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
                api.renderTracks([api.score.tracks[trackIdx]]);
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
            }
        });
    }
});
