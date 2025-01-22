let startTime = 0;
let elapsedTime = 0;
let timerInterval;
let isRunning = false; // Keep track of whether the timer is running

const timerDisplay = document.getElementById("timer-display"); // Assumes you have an element with id="timer" to display the time
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const resetButton = document.getElementById("reset");


function startTimer() {
    if (!isRunning) {
        startTime = Date.now() - elapsedTime;
        timerInterval = setInterval(updateTimer, 10); // Update every 10 milliseconds (adjust as needed)
        isRunning = true;
    }
}

function stopTimer() {
    if (isRunning) {
        clearInterval(timerInterval);
        elapsedTime = Date.now() - startTime;
        isRunning = false;
    }
}


function resetTimer() {
    clearInterval(timerInterval);
    elapsedTime = 0;
    startTime = 0;
    isRunning = false;
    timerDisplay.textContent = "00:00:00";
}

function updateTimer() {
    const currentTime = Date.now();
    elapsedTime = currentTime - startTime;

    const milliseconds = Math.floor(elapsedTime % 1000); //Added milliseconds
    const centiseconds = Math.floor(milliseconds / 10);
    const seconds = Math.floor((elapsedTime / 1000) % 60);
    const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
    const hours = Math.floor((elapsedTime / (1000 * 60 * 60)) % 60);


    const formattedTime = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`; //Added centiseconds to display
    timerDisplay.textContent = formattedTime;
}

function pad(number) { //Helper function to add leading zeros.
    return number < 10 ? '0' + number : number;
}


startButton.addEventListener("click", startTimer);
stopButton.addEventListener("click", stopTimer);
resetButton.addEventListener("click", resetTimer);


// Initial display
timerDisplay.textContent = "00:00:00";