document.addEventListener("DOMContentLoaded", function () {
    // Элементы UI
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
    const bookId = window.location.pathname.split("/")[2];

    // Константы
    const MIN_NOTE_TEXT_LENGTH = 30; // Минимальная длина текста заметки для уникальной идентификации

    // Переменные состояния
    let selectedText = "";
    let selectionRange = null;
    let notesCache = [];

    // Проверка наличия необходимых элементов
    if (!notesIcon || !notesPanel || !notesList) {
        console.error("Ошибка: один из элементов заметок не найден.");
        return;
    }

    // Вспомогательные функции
    function getTextColor(bgColor) {
        const r = parseInt(bgColor.substring(1, 3), 16);
        const g = parseInt(bgColor.substring(3, 5), 16);
        const b = parseInt(bgColor.substring(5, 7), 16);

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        return brightness < 128 ? "#ffffff" : "#000000";
    }

    // Получает текст вокруг выделения для создания контекста
    function getTextContext(selectedText, range) {
        try {
            if (!range || !range.startContainer || !reader) return null;

            const readerContent = reader.textContent;
            const selectedTextNormalized = selectedText.replace(/\s+/g, ' ').trim();
            const readerContentNormalized = readerContent.replace(/\s+/g, ' ').trim();

            const textIndex = readerContentNormalized.indexOf(selectedTextNormalized);
            if (textIndex === -1) return null;

            // Получаем контекст до выделения (до 100 символов)
            const beforeLength = Math.min(100, textIndex);
            const beforeContext = readerContentNormalized.substring(textIndex - beforeLength, textIndex);

            // Получаем контекст после выделения (до 100 символов)
            const afterStart = textIndex + selectedTextNormalized.length;
            const afterLength = Math.min(100, readerContentNormalized.length - afterStart);
            const afterContext = readerContentNormalized.substring(afterStart, afterStart + afterLength);

            return {
                before: beforeContext,
                after: afterContext
            };
        } catch (e) {
            console.error("Ошибка при получении контекста: ", e);
            return null;
        }
    }

    // UI функции
    function openAddNotePopup() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        selectionRange = selection.getRangeAt(0);
        selectedText = selection.toString().trim();

        // Проверка на минимальную длину выделения
        if (selectedText.length < MIN_NOTE_TEXT_LENGTH) {
            alert(`Выделите больше текста для создания заметки (минимум ${MIN_NOTE_TEXT_LENGTH} символов)`);
            return;
        }

        const rect = selectionRange.getBoundingClientRect();

        let x = rect.right + window.scrollX;
        let y = rect.bottom + window.scrollY;

        const windowWidth = window.innerWidth + window.scrollX;
        const windowHeight = window.innerHeight + window.scrollY;
        const popupWidth = addNotePopup.offsetWidth || 250;
        const popupHeight = addNotePopup.offsetHeight || 150;

        if (x + popupWidth > windowWidth - 20) {
            x = rect.left + window.scrollX - popupWidth;
        }

        if (y + popupHeight > windowHeight - 20) {
            y = rect.top + window.scrollY - popupHeight;
        }

        x -= 10;
        y -= 10;

        addNotePopup.style.left = `${x}px`;
        addNotePopup.style.top = `${y}px`;
        addNotePopup.style.display = "block";

        noteColorInput.value = "#ffffff";
        colorPreview.style.backgroundColor = "#ffffff";
    }

    function closeAddNotePopup() {
        addNotePopup.style.display = "none";
        selectedText = "";
        selectionRange = null;
    }

    function createNote(title, text, color, page, noteId = null) {
        const noteItem = document.createElement("div");
        noteItem.classList.add("note-item");
        noteItem.style.backgroundColor = color;

        const textColor = getTextColor(color);
        noteItem.style.color = textColor;
        noteItem.setAttribute("data-full-text", text);
        if (noteId) noteItem.dataset.noteId = noteId;

        const maxLength = 100;
        let isExpanded = false;
        const shortText = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

        noteItem.innerHTML = `
            <h4 class="note-title" style="color: ${textColor};">${title}</h4>
            <p class="note-content" style="color: ${textColor};">${shortText}</p>
            <div class="note-footer">
                <a href="javascript:void(0)" class="note-page" data-page="${page}" data-full-text="${text}"
                style="color: ${textColor}; border-color: ${textColor};"> Pg. ${page}
                </a>
                <button class="expand-note" style="color: ${textColor}; border-color: ${textColor};">${text.length > maxLength ? "Expand" : ""}</button>
                <button class="delete-note" style="color: ${textColor}; border-color: ${textColor};">Delete</button>
            </div>
        `;

        const content = noteItem.querySelector(".note-content");
        const expandButton = noteItem.querySelector(".expand-note");
        const deleteButton = noteItem.querySelector(".delete-note");
        const pageLink = noteItem.querySelector(".note-page");

        expandButton.addEventListener("click", function () {
            isExpanded = !isExpanded;

            if (isExpanded) {
                content.innerHTML = text.replace(/\n/g, "<br>").trim();
                expandButton.textContent = "Collapse";
            } else {
                content.innerHTML = shortText.replace(/\n/g, "<br>").trim();
                if (text.length > maxLength) {
                    content.innerHTML += "...";
                }
                expandButton.textContent = "Expand";
            }
        });

        // Удаление заметки с сервера
        deleteButton.addEventListener("click", function () {
            if (noteId) {
                fetch(`/api/notes/${noteId}`, {
                    method: 'DELETE',
                    credentials: 'same-origin'
                })
                    .then(response => {
                        if (response.ok) {
                            noteItem.remove();
                            // Удаляем из кэша, если заметка была там
                            notesCache = notesCache.filter(note => note.id !== noteId);
                        }
                    })
                    .catch(error => {
                        console.error('Ошибка удаления заметки:', error);
                    });
            } else {
                noteItem.remove();
            }
        });

        // Навигация к странице заметки
        pageLink.addEventListener("click", function (event) {
            event.preventDefault();
            navigateToNote(page, text);
        });

        notesList.appendChild(noteItem);
        return noteItem;
    }

    // Функция навигации к заметке
    function navigateToNote(page, noteText) {
        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
        const currentWordsPerScreen = currentUrl.searchParams.get("wordsPerScreen");

        const newUrl = new URL(`/book/${bookId}`, window.location.origin);
        newUrl.searchParams.set("page", page.toString());
        newUrl.searchParams.set("twoPageMode", isTwoPageMode.toString());

        if (currentWordsPerScreen) {
            newUrl.searchParams.set("wordsPerScreen", currentWordsPerScreen);
        }

        // Сохраняем текст заметки для последующей подсветки
        localStorage.setItem("highlightFragment", noteText);

        if (typeof loadPage === "function") {
            loadPage(newUrl.toString()).then(() => {
                if (typeof highlightNote === "function") {
                    // Принудительная перерисовка
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            highlightNote(page);
                        });
                    });
                }
            }).catch(error => {
                console.error("❌ Error navigating to note:", error);
            });
        } else {
            window.location.href = newUrl.toString();
        }
    }

    // Загрузка заметок с сервера
    function loadNotes() {
        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
        const wordsPerScreen = currentUrl.searchParams.get("wordsPerScreen") || "1500";

        fetch(`/api/notes/book/${bookId}?twoPageMode=${isTwoPageMode}&wordsPerScreen=${wordsPerScreen}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(notes => {
                notesList.innerHTML = '';
                notesCache = notes; // Сохраняем заметки в кэш для быстрого доступа

                notes.forEach(note => {
                    createNote(note.title, note.text, note.color, note.page, note.id);
                });
            })
            .catch(error => {
                console.error('Ошибка загрузки заметок:', error);
            });
    }

    // Обработчики событий

    // Переключение видимости панели заметок
    notesIcon.addEventListener("click", function () {
        notesPanel.style.display = notesPanel.style.display === "block" ? "none" : "block";
        const rect = notesIcon.getBoundingClientRect();
        notesPanel.style.left = `${rect.right + 10}px`;
        notesPanel.style.top = `${rect.top}px`;
    });

    // Добавление кнопки при выделении текста
    reader.addEventListener("mouseup", function (event) {
        const selection = window.getSelection();
        if (selection.toString().trim()) {
            selectedText = selection.toString();
            selectionRange = selection.getRangeAt(0);
            openAddNotePopup();
        }
    });

    // Сохранение заметки
    saveNote.addEventListener("click", function () {
        const title = noteTitleInput.value.trim();
        const color = noteColorInput.value;
        const page = document.getElementById("pageInput").value;
        const totalPages = parseInt(document.getElementById("pageInput").max);
        const wordsPerScreen = parseInt(new URL(window.location.href).searchParams.get("wordsPerScreen") || "1500");
        const isTwoPageMode = new URL(window.location.href).searchParams.get("twoPageMode") === "true";

        // Проверка минимальной длины выделения
        if (title && selectedText && selectedText.length >= MIN_NOTE_TEXT_LENGTH) {
            // Получаем контекст выделения
            const context = getTextContext(selectedText, selectionRange);
            const contextData = context ?
                `&contextBefore=${encodeURIComponent(context.before)}&contextAfter=${encodeURIComponent(context.after)}` : '';

            fetch('/api/notes/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `bookId=${bookId}&text=${encodeURIComponent(selectedText)}&title=${encodeURIComponent(title)}` +
                    `&color=${color}&page=${page}&totalPages=${totalPages}&wordsPerScreen=${wordsPerScreen}` +
                    `&twoPageMode=${isTwoPageMode}${contextData}`,
                credentials: 'same-origin'
            })
                .then(response => {
                    if (!response.ok) {
                        // Выводим подробности об ошибке
                        return response.text().then(text => {
                            try {
                                const error = JSON.parse(text);
                                alert(error.error || 'Ошибка сохранения заметки');
                            } catch (e) {
                                console.error('Ошибка ответа:', text);
                                alert('Ошибка сохранения заметки');
                            }
                            throw new Error('Ошибка сохранения заметки');
                        });
                    }
                    return response.json();
                })
                .then(note => {
                    console.log('Заметка сохранена:', note);
                    createNote(note.title, note.text, note.color, note.page, note.id);
                    notesCache.push(note); // Добавляем в кэш

                    noteTitleInput.value = "";
                    selectedText = "";
                    closeAddNotePopup();

                    // Подсветим заметку в тексте

                })
                .catch(error => {
                    console.error('Ошибка сохранения заметки:', error);
                });
        } else {
            alert(`Введите название заметки и выделите текст (минимум ${MIN_NOTE_TEXT_LENGTH} символов).`);
        }
    });

    // Закрытие popup при клике вне его области
    document.addEventListener("click", function (event) {
        if (!addNotePopup.contains(event.target) && !window.getSelection().toString()) {
            closeAddNotePopup();
        }

        // Закрытие панели заметок при клике вне нее
        if (!notesPanel.contains(event.target) && !notesIcon.contains(event.target)) {
            notesPanel.style.display = "none";
        }
    });

    // Закрытие popup при скролле
    document.addEventListener("scroll", closeAddNotePopup);

    // Отмена добавления заметки
    cancelNote.addEventListener("click", closeAddNotePopup);

    // Очистка всех заметок
    clearNotes.addEventListener("click", function () {
        if (!confirm("Вы уверены, что хотите удалить все заметки для этой книги?")) {
            return;
        }

        fetch(`/api/notes/book/${bookId}/clear`, {
            method: 'DELETE',
            credentials: 'same-origin'
        })
            .then(response => {
                if (response.ok) {
                    // Очищаем список заметок локально
                    notesList.innerHTML = '';
                    notesCache = []; // Очищаем кэш
                    alert("Все заметки успешно удалены");
                } else {
                    console.error('Не удалось очистить заметки');
                    alert("Произошла ошибка при удалении заметок");
                }
            })
            .catch(error => {
                console.error('Ошибка при очистке заметок:', error);
                alert("Произошла ошибка при удалении заметок");
            });
    });

    // Обработчики для цветовой палитры заметок
    colorPreview.addEventListener("click", function () {
        colorInput.click();
    });

    colorInput.addEventListener("input", function () {
        colorPreview.style.backgroundColor = colorInput.value;
    });

    // Устанавливаем начальный цвет
    colorPreview.style.backgroundColor = colorInput.value;

    // Предупреждение при фокусе на поле ввода без выделенного текста
    noteTitleInput.addEventListener("focus", function () {
        if (!selectedText || selectedText.length < MIN_NOTE_TEXT_LENGTH) {
            alert(`Сначала выделите текст (минимум ${MIN_NOTE_TEXT_LENGTH} символов) перед вводом названия!`);
        }
    });

    // Обработчик прокрутки панели заметок
    notesPanel.addEventListener("wheel", function (event) {
        if (notesPanel.scrollHeight > notesPanel.clientHeight) {
            event.preventDefault();
            notesPanel.scrollBy({top: event.deltaY, behavior: "smooth"});
        }
    }, {passive: false});



    // Улучшенная функция подсветки заметки
    window.highlightNote = function (page) {
        const reader = document.getElementById("reader");
        if (!reader) {
            console.error("Ошибка: элемент reader не найден!");
            return;
        }

        // Получаем текст заметки из localStorage
        const savedText = localStorage.getItem("highlightFragment");
        if (!savedText) {
            console.warn("Текст для подсветки не найден");
            return;
        }

        // Проверяем, находимся ли мы в двухстраничном режиме и на обложке
        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
        const currentPage = parseInt(document.getElementById("pageInput").value);

        // Если мы в двухстраничном режиме и на странице обложки, нужно перейти к нужной странице
        if (isTwoPageMode && currentPage === 0) {
            // Создаем новый URL с сохранением всех параметров, но с нужной страницей
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("page", page.toString());

            // Используем loadPage для перехода на нужную страницу
            if (typeof loadPage === "function") {
                loadPage(newUrl.toString()).then(() => {
                    // После загрузки новой страницы повторяем подсветку
                    setTimeout(() => highlightNote(page), 300);
                });
                return;
            } else {
                // Резервный вариант - обычный переход
                window.location.href = newUrl.toString();
                return;
            }
        }

        // Удаляем предыдущие подсветки
        reader.querySelectorAll(".highlight").forEach(el => {
            const parent = el.parentNode;
            while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
        });

        // Разбиваем текст заметки на параграфы для более точного поиска
        const paragraphs = savedText.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);

        // Получаем весь текст страницы
        const fullText = reader.textContent;
        const lowerFullText = fullText.toLowerCase();

        // Ищем каждый параграф заметки в тексте
        let occurrences = [];
        paragraphs.forEach(para => {
            const lowerPara = para.toLowerCase();
            let startPos = 0;
            while (true) {
                const index = lowerFullText.indexOf(lowerPara, startPos);
                if (index === -1) break;
                occurrences.push({start: index, end: index + para.length});
                startPos = index + para.length;
            }
        });

        // Если ничего не нашли, попробуем поискать в кэше заметок
        if (occurrences.length === 0) {
            console.warn("Текст заметки не найден на этой странице, ищем в кэше...");

            // Ищем заметку с похожим текстом в кэше
            const noteMatch = notesCache.find(note => {
                return note.text.includes(savedText) || savedText.includes(note.text);
            });

            if (noteMatch && noteMatch.page !== currentPage) {
                console.log("Найдено совпадение в кэше, перенаправляем на страницу", noteMatch.page);
                navigateToNote(noteMatch.page, noteMatch.text);
                return;
            }

            // Новый код: проверяем соседние страницы
            console.log("Проверяем соседние страницы...");

            // Функция для проверки страницы
            const checkNearbyPage = async (nearbyPage) => {
                if (nearbyPage < (isTwoPageMode ? 0 : 1) ||
                    nearbyPage > parseInt(document.getElementById("pageInput").max)) {
                    return false;
                }

                const nearbyUrl = new URL(window.location.href);
                nearbyUrl.searchParams.set("page", nearbyPage.toString());

                try {
                    const response = await fetch(nearbyUrl.toString());
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, "text/html");
                    const pageContent = doc.getElementById("reader").textContent;

                    // Ищем текст заметки на соседней странице
                    const cleanContent = pageContent.toLowerCase();
                    const cleanNoteText = noteText.toLowerCase();

                    if (cleanContent.includes(cleanNoteText)) {
                        if (confirm(`Текст заметки найден на странице ${nearbyPage}. Перейти?`)) {
                            loadPage(nearbyUrl.toString()).then(() => {
                                setTimeout(() => highlightNote(nearbyPage, noteText), 300);
                            });
                            return true;
                        }
                    }
                    return false;
                } catch (error) {
                    console.error("Ошибка при проверке соседней страницы:", error);
                    return false;
                }
            };

            // Проверяем сначала следующую, потом предыдущую страницу
            checkNearbyPage(currentPage + 1).then(found => {
                if (!found) {
                    checkNearbyPage(currentPage - 1);
                }
            });

            // Если в кэше не нашли и страница отличается от ожидаемой,
            // попробуем перейти к странице заметки
            if (page !== currentPage) {
                const bookId = window.location.pathname.split("/")[2];
                const newUrl = new URL(`/book/${bookId}`, window.location.origin);
                newUrl.searchParams.set("page", page.toString());
                newUrl.searchParams.set("twoPageMode", isTwoPageMode.toString());
                newUrl.searchParams.set("wordsPerScreen",
                    currentUrl.searchParams.get("wordsPerScreen") || "1500");

                // Используем loadPage для перехода на нужную страницу
                if (typeof loadPage === "function") {
                    loadPage(newUrl.toString()).then(() => {
                        // После загрузки новой страницы повторяем подсветку
                        setTimeout(() => highlightNote(page), 300);
                    });
                } else {
                    window.location.href = newUrl.toString();
                }
            }
            return;
        }

        // Сортируем найденные вхождения по позиции
        occurrences.sort((a, b) => a.start - b.start);

        // Применяем подсветку к каждому найденному фрагменту
        for (let i = occurrences.length - 1; i >= 0; i--) {
            const {start, end} = occurrences[i];
            let currentPos = 0;
            const walker = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT, null);
            let node;
            let range = document.createRange();
            let rangeSet = false;

            while (node = walker.nextNode()) {
                const nodeText = node.nodeValue;
                const nodeStart = currentPos;
                const nodeEnd = currentPos + nodeText.length;

                if (!rangeSet && start >= nodeStart && start < nodeEnd) {
                    range.setStart(node, start - nodeStart);
                    rangeSet = true;
                }
                if (rangeSet && end > nodeStart && end <= nodeEnd) {
                    range.setEnd(node, end - nodeStart);
                    break;
                }
                currentPos = nodeEnd;
            }

            if (!range.collapsed) {
                const highlightSpan = document.createElement("span");
                highlightSpan.classList.add("highlight");
                const extractedContent = range.extractContents();
                highlightSpan.appendChild(extractedContent);
                range.insertNode(highlightSpan);
            }
        }

        // Прокручиваем к первой подсветке
        const firstHighlight = reader.querySelector(".highlight");
        if (firstHighlight) {
            setTimeout(() => {
                firstHighlight.scrollIntoView({behavior: "smooth", block: "center"});
            }, 200);
        }
    };

    // Загрузка заметок при открытии книги
    loadNotes();
});