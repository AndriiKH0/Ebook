document.addEventListener("DOMContentLoaded", function () {
    const notesIcon = document.getElementById("notesIcon");
    const notesPanel = document.getElementById("notesPanel");
    const clearNotes = document.getElementById("clearNotes");
    const notesList = document.getElementById("notesList");
    const addNotePopup = document.getElementById("addNotePopup");
    const saveNote = document.getElementById("saveNote");
    const cancelNote = document.getElementById("cancelNote");
    const noteTitleInput = document.getElementById("noteTitle");
    const noteColorInput = document.getElementById("noteColor");
    const reader = document.getElementById("reader");
    const colorInput = document.getElementById("noteColor");
    const colorPreview = document.getElementById("colorPreview");
    let selectedText = "";
    let selectionRange = null;

    // Открытие и закрытие панели заметок (показывается справа от кнопки)
    // Отправляем событие для `notes.js`
    document.dispatchEvent(new CustomEvent("noteAdded", {
        detail: {
            title: noteTitle,
            text: selectedText,
            color: noteColor,
            page: document.getElementById("pageInput").value
        }
    }));


    // Открытие окна добавления заметки (в месте выделения)


    function openAddNotePopup() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const addNotePopup = document.getElementById("addNotePopup");

        let x = rect.right + window.scrollX;  // Добавляем прокрутку по горизонтали
        let y = rect.bottom + window.scrollY; // Добавляем прокрутку по вертикали

        // Проверяем размер окна браузера
        const windowWidth = window.innerWidth + window.scrollX;
        const windowHeight = window.innerHeight + window.scrollY;
        const popupWidth = addNotePopup.offsetWidth || 250; // Минимальная ширина
        const popupHeight = addNotePopup.offsetHeight || 150; // Минимальная высота

        // Если окно выходит за границы справа - двигаем влево
        if (x + popupWidth > windowWidth - 20) {
            x = rect.left + window.scrollX - popupWidth;
        }

        // Если окно выходит за границы снизу - двигаем вверх
        if (y + popupHeight > windowHeight - 20) {
            y = rect.top + window.scrollY - popupHeight;
        }

        // **Добавляем небольшое смещение влево и вверх для точного позиционирования**
        x -= 10;
        y -= 10;

        // Устанавливаем позицию окна
        addNotePopup.style.left = `${x}px`;
        addNotePopup.style.top = `${y}px`;
        addNotePopup.style.display = "block";

        // Сбрасываем цвет при открытии нового окна
        noteColorInput.value = "#ffffff";
        colorPreview.style.backgroundColor = "#ffffff";
    }

    // Закрытие окна добавления заметки
    // Функция закрытия окна заметок
    function closeAddNotePopup() {
        document.getElementById("addNotePopup").style.display = "none";
    }
    document.addEventListener("scroll", function () {
        closeAddNotePopup();
    });

// Закрытие окна при клике вне него
    document.addEventListener("click", function (event) {
        const addNotePopup = document.getElementById("addNotePopup");

        // Проверяем, был ли клик внутри окна или на выделенном тексте
        if (!addNotePopup.contains(event.target) && !window.getSelection().toString()) {
            closeAddNotePopup();
        }
    });




    // Отмена добавления заметки
    cancelNote.addEventListener("click", function () {
        closeAddNotePopup();
    });

    // Очистка всех заметок
    clearNotes.addEventListener("click", function () {
        notesList.innerHTML = "";
    });

    // Добавление кнопки при выделении текста
    reader.addEventListener("mouseup", function (event) {
        const selection = window.getSelection();
        if (selection.toString().trim()) {
            selectedText = selection.toString();
            selectionRange = selection.getRangeAt(0).getBoundingClientRect();
            openAddNotePopup(selectionRange.x, selectionRange.y + window.scrollY + 20);
        }
    });
    // При клике на блок открывается палитра
    colorPreview.addEventListener("click", function () {
        colorInput.click();
    });

    // Меняем цвет блока при выборе цвета
    colorInput.addEventListener("input", function () {
        colorPreview.style.backgroundColor = colorInput.value;
    });

    // Устанавливаем начальный цвет
    colorPreview.style.backgroundColor = colorInput.value;
});
