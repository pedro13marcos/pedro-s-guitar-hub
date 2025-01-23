// State to track stopwatch
let isRunning = false;
let stopwatchInterval; // Interval ID for the stopwatch
let elapsedMilliseconds = 0; // Tracks the time in milliseconds

// Update the display function
function updateDisplay() {
    const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
    const centiseconds = Math.floor((elapsedMilliseconds % 1000) / 10); // Get centiseconds

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    document.getElementById("timerDisplay").textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

// Start the stopwatch
function startStopwatch() {
    if (!isRunning) {
        isRunning = true;
        stopwatchInterval = setInterval(() => {
            elapsedMilliseconds += 10; // Increment by 10ms
            updateDisplay();
        }, 10); // Update every 10ms
    }
}

// Stop the stopwatch
function stopStopwatch() {
    if (isRunning) {
        isRunning = false;
        clearInterval(stopwatchInterval);
    }
}

// Reset the stopwatch
function resetStopwatch() {
    clearInterval(stopwatchInterval);
    isRunning = false;
    elapsedMilliseconds = 0;
    updateDisplay();
}

// Button event listeners
document.getElementById("start").addEventListener("click", function () {
    startStopwatch();
});

document.getElementById("stop").addEventListener("click", function () {
    stopStopwatch();
});

document.getElementById("reset").addEventListener("click", function () {
    resetStopwatch();
});

// Spacebar functionality
document.addEventListener("keydown", function (event) {
    if (event.code === "Space") {
        event.preventDefault(); // Prevent spacebar from scrolling or interacting with buttons
        if (isRunning) {
            stopStopwatch();
        } else {
            startStopwatch();
        }
    }
});

// Initialize the display on page load
updateDisplay();
