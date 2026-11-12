const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const notesList = document.getElementById("notesList");
const randomNotesButton = document.getElementById("randomNotesButton");
const clearButton = document.getElementById("clearButton");

function getRandomNotes() {
    let shuffledNotes = [...notes];
    for (let i = shuffledNotes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledNotes[i], shuffledNotes[j]] = [shuffledNotes[j], shuffledNotes[i]];
    }
    return shuffledNotes;
}

if (randomNotesButton) {
    randomNotesButton.addEventListener("click", () => {
        if (!notesList) return;
        notesList.innerHTML = "";

        const randomNotes = getRandomNotes();
        randomNotes.forEach((note, index) => {
            const listItem = document.createElement("li");
            listItem.textContent = note;

            // Alternating checkerboard/chess pattern with high visual distinction
            const isEven = index % 2 === 0;
            if (isEven) {
                // Electric Cobalt Blue tile
                listItem.className = "note-card note-card-blue";
            } else {
                // Warm Amber / Bronze Gold tile
                listItem.className = "note-card note-card-gold";
            }

            notesList.appendChild(listItem);
        });
    });
}

if (clearButton) {
    clearButton.addEventListener("click", () => {
        if (notesList) notesList.innerHTML = "";
    });
}
