
const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const notesList = document.getElementById("notesList");
const randomNotesButton = document.getElementById("randomNotesButton");


function getRandomNotes() {
    // Create a copy to avoid modifying the original array
    let shuffledNotes = [...notes];
    // Shuffle the copy of the array in place.
    for (let i = shuffledNotes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledNotes[i], shuffledNotes[j]] = [shuffledNotes[j], shuffledNotes[i]];
    }

    return shuffledNotes;


}

randomNotesButton.addEventListener("click", () => {
    notesList.innerHTML = ""; // Clear previous list


    const randomNotes = getRandomNotes();
    randomNotes.forEach(note => {
        const listItem = document.createElement("li");
        listItem.textContent = note;
        notesList.appendChild(listItem);
    });
});

const clearButton = document.getElementById("clearButton");  // Get the clear button element

clearButton.addEventListener("click", () => {
    notesList.innerHTML = ""; // Clear the contents of the notesList
});