// tuner.js
document.addEventListener('DOMContentLoaded', (event) => {
    //All tuner initialization code here

    
let tunerInitiated = false;
let audioContext; // Define audioContext in a higher scope

const toneDisplay = document.getElementById('toneDisplay');
//const frequencyDisplay = document.getElementById('frequencyDisplay'); // Optional frequency display

const tones = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const A4 = 440; // Tuning frequency of A4
const tonesFrequencies = tones.map((tone, index) => {
    // Calculate the frequency relative to A4
    const halfStepsFromA = index - 9; // A is at index 9
    return A4 * Math.pow(2, halfStepsFromA / 12);
});




function updateTuner() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyser.fftSize = 2048; // Larger FFT size for more accurate frequency detection
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);


        function getFrequency() {
            analyser.getByteFrequencyData(dataArray);

            // Find the peak frequency (index with highest value) and then get the real frequency
            let maxIndex = 0;
            for (let i = 1; i < bufferLength; i++) {
                if (dataArray[i] > dataArray[maxIndex]) {
                    maxIndex = i;
                }
            }


            const frequency = maxIndex * audioContext.sampleRate / analyser.fftSize;
            return frequency;

        }

        function findClosestNote(frequency) {
            let closestNote = "";
            let minDifference = Infinity; // initialize with a large value

            for (let i = 0; i < tonesFrequencies.length; i++) {
                const difference = Math.abs(frequency - tonesFrequencies[i]);
                if (difference < minDifference) {
                    minDifference = difference;
                    closestNote = tones[i];
                }
            }

            return closestNote;
        }

        setInterval(() => {
          const frequency = getFrequency();
          //frequencyDisplay.textContent = `Frequency: ${frequency.toFixed(2)} Hz`; // Optional
          const closestNote = findClosestNote(frequency);
          toneDisplay.textContent = closestNote;

          // Visual feedback (change text color based on tuning accuracy)
          const difference = Math.abs(frequency - tonesFrequencies[tones.indexOf(closestNote)]);
          if (difference < 2) {  // Tune threshold
              toneDisplay.style.color = 'green';
          } else if (difference < 5) { // Close to Tune
                toneDisplay.style.color = 'orange';
          }
          else{
              toneDisplay.style.color = "white"
          }

        }, 100); // Update every 100ms


        // Stop the tuner when leaving the tab or closing the page
        const tunerTab = document.getElementById('tuner');

        function stopTuner() {

            audioContext.close();

        }


        //Visibility change handling
        let hidden, visibilityChange;
        if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
          hidden = "hidden";
          visibilityChange = "visibilitychange";
        } else if (typeof document.msHidden !== "undefined") {
          hidden = "msHidden";
          visibilityChange = "msvisibilitychange";
        } else if (typeof document.webkitHidden !== "undefined") {
          hidden = "webkitHidden";
          visibilityChange = "webkitvisibilitychange";
        }




        document.addEventListener(visibilityChange, stopTuner);
        tunerTab.addEventListener('blur', stopTuner);
        window.addEventListener('beforeunload', stopTuner);



      })
      .catch(function (err) {
        console.error('Error accessing microphone:', err);
        toneDisplay.textContent = 'Error accessing microphone';
      });
  } else {
    console.error('getUserMedia not supported on this browser.');
    toneDisplay.textContent = 'getUserMedia not supported';
  }
}




// Start the tuner when the tuner tab is clicked
const tunerTabButton = document.querySelector('.tab-button[data-tab="tuner"]');
tunerTabButton.addEventListener('click', updateTuner);

});
