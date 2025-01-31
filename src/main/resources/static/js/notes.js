document.addEventListener("DOMContentLoaded", function () {
    const notesIcon = document.getElementById("notesIcon");
    const notesPanel = document.getElementById("notesPanel");
    const clearNotes = document.getElementById("clearNotes");
    const notesList = document.getElementById("notesList");
    const saveNote = document.getElementById("saveNote");
    const noteTitleInput = document.getElementById("noteTitle");
    const noteColorInput = document.getElementById("noteColor");
    const addNotePopup = document.getElementById("addNotePopup");
    let selectedText = ""; // Запоминаем выделенный текст
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get("page");


    if (!notesIcon || !notesPanel || !notesList) {
        console.error("Ошибка: один из элементов заметок не найден.");
        return;
    }

    // Открытие/закрытие панели заметок
    notesIcon.addEventListener("click", function () {
        notesPanel.style.display = notesPanel.style.display === "block" ? "none" : "block";
        const rect = notesIcon.getBoundingClientRect();
        notesPanel.style.left = `${rect.right + 10}px`;
        notesPanel.style.top = `${rect.top}px`;
    });

    function closeAddNotePopup() {
        addNotePopup.style.display = "none";
    }

    function getTextColor(bgColor) {
        // Преобразуем HEX в RGB
        let r = parseInt(bgColor.substring(1, 3), 16);
        let g = parseInt(bgColor.substring(3, 5), 16);
        let b = parseInt(bgColor.substring(5, 7), 16);

        // Вычисляем яркость (Perceived Brightness formula)
        let brightness = (r * 299 + g * 587 + b * 114) / 1000;

        // Если фон темный, текст будет белым, иначе черным
        return brightness < 128 ? "#ffffff" : "#000000";
    }

    // Функция для создания заметки
    function createNote(title, text, color, page) {

        const noteItem = document.createElement("div");
        noteItem.classList.add("note-item");
        noteItem.style.backgroundColor = color;
         // Определяем цвет текста
        const textColor = getTextColor(color); // Определяем цвет текста
        noteItem.style.color = textColor; // Меняем цвет текста
        noteItem.setAttribute("data-full-text", text);


        const maxLength = 100;
        let isExpanded = false;
        const shortText = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

        noteItem.innerHTML = `
        <h4 class="note-title" style="color: ${textColor};">${title}</h4>
        <p class="note-content" style="color: ${textColor};">${shortText}</p>
        <div class="note-footer">
            <a href="?page=${page}" class="note-page" data-page="${page}" data-full-text="${text}"
        style="color: ${textColor}; border-color: ${textColor};">
        Стр. ${page}
        </a>
            <button class="expand-note" style="color: ${textColor}; border-color: ${textColor};">${text.length > maxLength ? "Развернуть" : ""}</button>
            <button class="delete-note" style="color: ${textColor}; border-color: ${textColor};">Удалить</button>
        </div>
    `;

        const content = noteItem.querySelector(".note-content");
        const expandButton = noteItem.querySelector(".expand-note");

        // Разворачивание и сворачивание текста
        expandButton.addEventListener("click", function () {
            isExpanded = !isExpanded;

            if (isExpanded) {
                content.innerHTML = text.replace(/\n/g, "<br>").trim();
                expandButton.textContent = "Свернуть";
            } else {
                content.innerHTML = shortText.replace(/\n/g, "<br>").trim();
                if (text.length > maxLength) {
                    content.innerHTML += "...";
                }
                expandButton.textContent = "Развернуть";
            }

            console.log("Текущее состояние:", isExpanded);
            console.log("Отображаемый текст:", content.innerHTML);
        });

        document.addEventListener("click", function (event) {
            const notesPanel = document.getElementById("notesPanel");
            const notesIcon = document.getElementById("notesIcon");

            // Проверяем, был ли клик внутри заметок или на кнопку
            if (!notesPanel.contains(event.target) && !notesIcon.contains(event.target)) {
                notesPanel.style.display = "none";
            }
        });
        document.getElementById("notesList").addEventListener("click", function (event) {
            if (event.target.classList.contains("delete-note")) {
                event.stopPropagation(); // Предотвращаем всплытие события
            }
        });
        /**/
        document.addEventListener("click", function (event) {
            if (event.target.classList.contains("note-page")) {
                event.preventDefault();

                const page = event.target.dataset.page;
                const bookId = window.location.pathname.split("/")[2];
                const newUrl = `/book/${bookId}?page=${page}`;
                const noteText = event.target.closest(".note-item").dataset.fullText;


                console.log("Переход на страницу:", newUrl);
                console.log("Текст заметки:", noteText);

                // Сохраняем текст заметки в localStorage (для подсветки)
                localStorage.setItem("highlightFragment", noteText);

                if (typeof loadPage === "function") {
                    console.log("loadPage() вызывается...");

                    // Загружаем страницу
                    loadPage(newUrl);

                    // Ожидаем загрузку и подсвечиваем текст
                    setTimeout(() => {
                        console.log("Страница загружена, вызываем подсветку...");
                        console.log("Используемый текст для подсветки:", noteText); // ЛОГ ДЛЯ ПРОВЕРКИ
                        console.log("Абзацы, которые передаем в подсветку:", text.split("\n"));
                        console.log("Передаем в подсветку:", text);
                        console.log("Разделенные строки:", text.split("\n"));
                        highlightNote(page);
                    }, 500);
                } else {
                    console.error("Функция loadPage() не найдена!");
                }

            }
        });




        /**/

        noteItem.querySelector(".delete-note").addEventListener("click", function () {
            noteItem.remove();
        });

        notesList.appendChild(noteItem);
    }

    // Очистка всех заметок
    clearNotes.addEventListener("click", function () {
        notesList.innerHTML = "";
    });

    // **Запоминаем выделенный текст сразу при выделении**
    document.addEventListener("mouseup", function () {
        const selection = window.getSelection().toString().trim();
        if (selection) {
            selectedText = selection;
            console.log("Выделенный текст сохранён:", selectedText);
        }
    });

    // **При клике в поле ввода заголовка сохраняем текст**
    noteTitleInput.addEventListener("focus", function () {
        if (!selectedText) {
            alert("Сначала выделите текст перед вводом названия!");
        }
    });



    notesPanel.addEventListener("wheel", function (event) {
        if (notesPanel.scrollHeight > notesPanel.clientHeight) {
            event.preventDefault(); // Блокируем скроллинг страницы
            notesPanel.scrollBy({ top: event.deltaY, behavior: "smooth" }); // Плавная прокрутка
        }
    }, { passive: false });


    // **Добавление заметки с сохранённым текстом**
    saveNote.addEventListener("click", function () {
        const title = noteTitleInput.value.trim();
        const color = noteColorInput.value;
        const page = document.getElementById("pageInput").value;

        if (title && selectedText) {
            createNote(title, selectedText, color, page);
            noteTitleInput.value = "";
            selectedText = "";
            closeAddNotePopup();// Очищаем после сохранения
        } else {
            alert("Введите название заметки и выделите текст.");
        }
    });

    // Пример работы

});
