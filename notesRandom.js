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
        randomNotes.forEach(note => {
            const listItem = document.createElement("li");
            listItem.textContent = note;

            if (note.includes("#")) {
                listItem.style.background = "linear-gradient(135deg, #1e293b, #334155)";
                listItem.style.borderColor = "#60a5fa";
                listItem.style.color = "#38bdf8";
            } else {
                listItem.style.background = "#1e293b";
                listItem.style.color = "#f8fafc";
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
