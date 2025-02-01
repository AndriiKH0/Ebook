
document.addEventListener("DOMContentLoaded", function () {

    const searchInput = document.getElementById("searchInput");
    const searchIcon = document.getElementById("searchIcon");
    const clearSearch = document.getElementById("clearSearch");
    const reader = document.getElementById("reader");
    setTimeout(() => {
        loadChapters();
    }, 500);

    function highlightText(query) {
        if (!query.trim()) {
            document.querySelectorAll(".highlight").forEach(el => {
                el.outerHTML = el.innerText;
            });
            return;
        }

        const regex = new RegExp(escapeRegExp(query), "gi");

        function escapeRegExp(string) {
            return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        }

        function processNode(node) {
            if (node.nodeType === 3) { // Текстовый узел
                let parent = node.parentNode;
                if (parent.classList.contains("highlight")) return; // Пропускаем уже выделенный текст

                const newText = node.nodeValue.replace(regex, (match) => `<span class="highlight">${match}</span>`);
                if (newText !== node.nodeValue) {
                    const span = document.createElement("span");
                    span.innerHTML = newText;
                    node.replaceWith(span);
                }
            } else if (node.nodeType === 1) {
                node.childNodes.forEach(processNode);
            }
        }

        // Очищаем предыдущую подсветку
        document.querySelectorAll(".highlight").forEach(el => {
            el.outerHTML = el.innerText;
        });

        // Обрабатываем текст в параграфах и спанах
        document.querySelectorAll("p, span").forEach(element => {
            element.childNodes.forEach(processNode);
        });
    }



    window.loadChapters = loadChapters;

    let allChapters = new Map();
    let allPagesLoaded = false; // Флаг, загружены ли все страницы

    async function loadChapters() {
        console.log("⏳ Загружаем главы...");

        if (allPagesLoaded) {
            console.log("✅ Главы уже загружены, пропускаем повторное сканирование.");
            return;
        }

        allChapters.clear(); // Чистим перед новой загрузкой

        let totalPages = parseInt(document.getElementById("pageInput").max); // Общее количество страниц
        let bookId = window.location.pathname.split("/")[2];

        for (let page = 1; page <= totalPages; page++) {
            console.log(`🔄 Загружаем страницу ${page} для анализа глав...`);
            let response = await fetch(`/book/${bookId}?page=${page}`);
            let text = await response.text();
            let doc = new DOMParser().parseFromString(text, "text/html");
            let headings = doc.querySelectorAll("#reader section h3");

            console.log(`📖 Страница ${page}: найдено ${headings.length} глав.`);

            headings.forEach((heading) => {
                let chapterText = heading.textContent.trim();
                let chapterId = `chapter-${allChapters.size + 1}`;

                if (!allChapters.has(chapterId)) {
                    allChapters.set(chapterId, { id: chapterId, page: page });
                    heading.id = chapterId;

                    let li = document.createElement("li");
                    li.textContent = chapterText;
                    li.dataset.target = chapterId;

                    // ✅ Теперь передаем chapterId
                    li.addEventListener("click", function () {
                        goToChapter(chapterId);
                    });

                    document.getElementById("chapterList").appendChild(li);
                }
            });
        }

        allPagesLoaded = true;
        console.log("✅ Все главы загружены:", allChapters.size);
    }


    function findChapterPage(chapterText) {
        let chaptersPerPage = 2; // Среднее количество глав на страницу (примерное значение)
        let chapterIndex = [...allChapters.keys()].indexOf(chapterText);
        return Math.ceil((chapterIndex + 1) / chaptersPerPage); // Определяем номер страницы
    }

    function goToChapter(chapterId) {
        console.log(`🔹 Переход к главе: ${chapterId}`);

        const chapterElement = document.getElementById(chapterId);
        if (chapterElement) {
            console.log("✅ Глава найдена на текущей странице, прокручиваем...");
            chapterElement.scrollIntoView({ behavior: "smooth" });
            return;
        }

        console.log("❌ Глава не найдена, загружаем страницу...");

        const chapterData = allChapters.get(chapterId);
        if (chapterData) {
            const bookId = window.location.pathname.split("/")[2];

            // ✅ Загружаем страницу, где находится глава
            loadPage(`/book/${bookId}?page=${chapterData.page}`);

            // ✅ После загрузки плавно скроллим к главе
            setTimeout(() => {
                document.getElementById(chapterId)?.scrollIntoView({ behavior: "smooth" });
            }, 700);
        } else {
            console.error("🚨 Глава не найдена в загруженных данных!");
        }
    }


    // Функция плавного перехода к главе
    function scrollToChapter(chapterId) {
        const bookId = window.location.pathname.split("/")[2]; // Получаем ID книги

        const chapterElement = document.getElementById(chapterId);
        if (chapterElement) {
            console.log(`🔎 Глава найдена в текущем тексте: ${chapterId}`);
            chapterElement.scrollIntoView({behavior: "smooth"}); // Плавный скролл
        } else {
            console.log(`🔄 Глава ${chapterId} не найдена, загружаем страницу...`);
            loadPage(`/book/${bookId}?chapter=${chapterId}`); // Загружаем нужную страницу
        }
    }





    window.highlightNote = highlightNote;


    function highlightNote(page) {
        const reader = document.getElementById("reader");
        if (!reader) {
            console.error("Ошибка: элемент #reader не найден!");
            return;
        }

        console.log("highlightNote вызвана, страница:", page);

        // Получаем текст заметки
        const savedText = localStorage.getItem("highlightFragment");
        if (!savedText) {
            console.warn("highlightNote: Текст заметки не найден в localStorage");
            return;
        }

        console.log("Текст для подсветки:", savedText);

        function escapeRegExp(string) {
            return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, match => match === "-" ? "-" : `\\${match}`);
        }

        // Разбиваем текст на абзацы, удаляем пустые строки
        const paragraphs = savedText.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
        console.log("Абзацы для поиска:", paragraphs);

        let firstHighlightedElement = null; // Для перехода к первому выделенному элементу

        function processNode(node) {
            if (node.nodeType === 3) { // Если это текстовый узел
                let parent = node.parentNode;
                if (parent.classList.contains("highlight")) return; // Пропускаем уже выделенные

                let newText = node.nodeValue;
                paragraphs.forEach(para => {
                    const escapedPara = escapeRegExp(para);
                    try {
                        const regex = new RegExp(`(${escapedPara})`, "giu");
                        newText = newText.replace(regex, (match) => `<span class="highlight">${match}</span>`);
                    } catch (e) {
                        console.error("Ошибка в регулярном выражении:", e, "Текст:", para);
                    }
                });

                if (newText !== node.nodeValue) {
                    const span = document.createElement("span");
                    span.innerHTML = newText;
                    node.replaceWith(span);

                    if (!firstHighlightedElement) {
                        firstHighlightedElement = span; // Запоминаем первый найденный элемент
                    }
                }
            } else if (node.nodeType === 1 && node.closest("#reader")) {
                node.childNodes.forEach(processNode);
            }
        }

        // Очищаем старую подсветку ТОЛЬКО в книге
        reader.querySelectorAll(".highlight").forEach(el => {
            el.outerHTML = el.innerText;
        });

        // Обрабатываем текст ТОЛЬКО внутри книги
        // Добавляем "em" к селектору, чтобы обрабатывать и элементы <em>
        reader.querySelectorAll("p, span, em").forEach(element => {
            element.childNodes.forEach(processNode);
        });

        // Прокручиваем к первому выделенному фрагменту
        if (firstHighlightedElement) {
            setTimeout(() => {
                firstHighlightedElement.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 200); // Небольшая задержка для плавного перехода
        }
    }


    document.addEventListener("click", function (event) {
        if (!event.target.classList.contains("highlight")) {
            console.log("Очищаем подсветку");
            highlightText("");  // Убираем подсветку
        }
    });

    searchIcon.addEventListener("click", function (event) {
        event.preventDefault();
        searchIcon.style.display = "none";
        searchInput.style.display = "inline-block";
        clearSearch.style.display = "inline-block";
        searchInput.focus();
    });

    document.addEventListener("click", function (event) {
        if (!searchInput.contains(event.target) && !searchIcon.contains(event.target) && !clearSearch.contains(event.target)) {
            searchInput.style.display = "none";
            clearSearch.style.display = "none";
            searchIcon.style.display = "inline-block";
        }
    });

    searchInput.addEventListener("input", function (event) {
        event.preventDefault();
        highlightText(this.value);
    });

    clearSearch.addEventListener("click", function (event) {
        event.preventDefault();
        searchInput.value = "";
        highlightText("");
    });

});









    function setTheme(theme) {
    let body = document.body;
    body.className = "";
    body.classList.add("theme-" + theme);

    // Убираем активный класс у всех тем
    document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));

    // Добавляем активный класс выбранной теме
    document.querySelector('.theme-' + theme).classList.add('active');

    // Сохраняем выбор в localStorage
    localStorage.setItem("selectedTheme", theme);
}

    // При загрузке страницы применяем сохраненную тему

    function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

    function changeFontSize(delta) {
    let content = document.getElementById("reader");
    let fontSizeDisplay = document.getElementById("fontSizeDisplay");

    let currentSize = parseInt(fontSizeDisplay.textContent); // Берём текущее значение без px
    let newSize = Math.max(12, Math.min(32, currentSize + delta)); // Ограничиваем от 12px до 32px

    content.style.fontSize = newSize + "px";
    fontSizeDisplay.textContent = newSize; // Обновляем без px
}
document.addEventListener("DOMContentLoaded", function () {
    const reader = document.getElementById("reader");
    const pageInput = document.getElementById("pageInput");
    const addNotePopup = document.getElementById("addNotePopup");

    let lastPage = window.location.href; // Запоминаем текущий URL

    function scrollToHighlighted() {
        const highlighted = document.querySelector(".highlight");
        if (highlighted) {
            highlighted.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    function loadPage(url) {
        if (url === lastPage) {
            console.log("✅ Остаемся на текущей странице, прокручиваем к заметке");
            scrollToHighlighted();
            return;
        }

        lastPage = url;

        fetch(url)
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const newContent = doc.getElementById("reader").innerHTML;
                reader.innerHTML = newContent;

                document.querySelectorAll("emphasis").forEach(el => {
                    let em = document.createElement("em");
                    em.innerHTML = el.innerHTML;
                    el.replaceWith(em);
                });
                // Обновляем номер страницы
                const newPageNumber = doc.querySelector("#pageInput").value;
                pageInput.value = newPageNumber;

                // Обновляем кнопки Вперед / Назад
                updateNavigation(doc);

                // Обновляем URL
                window.history.pushState({}, "", url);

                // Закрываем окно заметок при смене страницы
                addNotePopup.style.display = "none";

                // Только если переходим на новую страницу - скроллим вверх
                window.scrollTo({ top: 0, behavior: "instant" });

                // После загрузки страницы плавно скроллим к заметке (если она есть)
                setTimeout(scrollToHighlighted, 200);

                // 🔥 Загружаем главы после загрузки новой страницы
                setTimeout(loadChapters, 500);
            })
            .catch(error => console.error("Ошибка загрузки страницы:", error));
    }



// Добавляем событие на кнопки "Следующая" и "Предыдущая" страница




    function updateNavigation(doc) {
        let prevPage = document.getElementById("prevPage");
        let nextPage = document.getElementById("nextPage");

        let newPrev = doc.querySelector("#prevPage");
        let newNext = doc.querySelector("#nextPage");

        console.log("Обновляем навигацию:", { newPrev, newNext });

        // 🛑 Проверяем, есть ли новая кнопка "Назад"
        if (newPrev) {
            if (!prevPage) {
                prevPage = document.createElement("a");
                prevPage.id = "prevPage";
                prevPage.textContent = "Назад";
                prevPage.style.marginRight = "10px";
                document.querySelector(".navigation").prepend(prevPage);
            }
            prevPage.href = newPrev.href;
            prevPage.style.display = "inline";

            prevPage.replaceWith(prevPage.cloneNode(true));
            document.getElementById("prevPage").addEventListener("click", function (event) {
                event.preventDefault();
                loadPage(this.href);
            });
        } else if (prevPage) {
            prevPage.style.display = "none";
        }

        // ✅ Проверяем, есть ли новая кнопка "Вперед"
        if (newNext) {
            if (!nextPage) {
                nextPage = document.createElement("a");
                nextPage.id = "nextPage";
                nextPage.textContent = "Вперед";
                nextPage.style.marginLeft = "10px";
                document.querySelector(".navigation").appendChild(nextPage);
            }
            nextPage.href = newNext.href;
            nextPage.style.display = "inline";

            nextPage.replaceWith(nextPage.cloneNode(true));
            document.getElementById("nextPage").addEventListener("click", function (event) {
                event.preventDefault();
                loadPage(this.href);
            });
        } else if (nextPage) {
            nextPage.style.display = "none";
        }
    }



    const fontSelectIcon = document.getElementById("fontSelectIcon");
    const fontDropdown = document.getElementById("fontDropdown");
    const fontOptions = document.querySelectorAll(".font-option");


    // Загружаем сохранённый шрифт
    const savedFont = localStorage.getItem("selectedFont");
    if (savedFont) {
        reader.style.fontFamily = savedFont;
    }

    // Показываем/скрываем окно выбора шрифта
    fontSelectIcon.addEventListener("click", function (event) {
        event.stopPropagation();
        fontDropdown.style.display = (fontDropdown.style.display === "block") ? "none" : "block";
        positionFontDropdown();
    });

    // Устанавливаем координаты окна
    function positionFontDropdown() {
        const rect = fontSelectIcon.getBoundingClientRect();
        fontDropdown.style.position = "absolute";
        fontDropdown.style.left = `${rect.left}px`;
        fontDropdown.style.top = `${rect.bottom + window.scrollY + 5}px`;
    }

    // Выбираем шрифт при клике на опцию
    fontOptions.forEach(option => {
        option.addEventListener("click", function () {
            const selectedFont = this.getAttribute("data-font");
            reader.style.fontFamily = selectedFont;
            localStorage.setItem("selectedFont", selectedFont);
            fontDropdown.style.display = "none"; // Закрываем окно после выбора
        });
    });

    // Закрываем окно при клике вне него
    document.addEventListener("click", function (event) {
        if (!fontSelectIcon.contains(event.target) && !fontDropdown.contains(event.target)) {
            fontDropdown.style.display = "none";
        }
    });







    function attachNavigationHandlers() {
        const prevPage = document.getElementById("prevPage");
        const nextPage = document.getElementById("nextPage");

        // Удаляем старые обработчики перед добавлением новых
        prevPage?.removeEventListener("click", handlePrevClick);
        nextPage?.removeEventListener("click", handleNextClick);

        prevPage?.addEventListener("click", handlePrevClick);
        nextPage?.addEventListener("click", handleNextClick);

        console.log("Обработчики событий обновлены!");
    }

    function handlePrevClick(event) {
        event.preventDefault();
        console.log("Клик по Назад:", event.target.href);
        loadPage(event.target.href);
    }

    function handleNextClick(event) {
        event.preventDefault();
        console.log("Клик по Вперед:", event.target.href);
        loadPage(event.target.href);
    }

    // Обработка ввода номера страницы вручную
    pageInput.addEventListener("change", function () {
        const newPage = parseInt(this.value);
        const totalPages = parseInt(pageInput.getAttribute("max"));
        const bookId = window.location.pathname.split("/")[2];

        if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
            console.log("Переход на страницу:", newPage);
            loadPage(`/book/${bookId}?page=${newPage}`);
        } else {
            console.warn("Некорректный номер страницы:", newPage);
            this.value = pageInput.getAttribute("value");
        }
    });

    window.loadPage = loadPage;
    attachNavigationHandlers();

    document.getElementById("toggleSidebarRight").addEventListener("click", function () {
        document.getElementById("sidebarRight").classList.toggle("open");
    });


    // Функция создания списка глав







    // Загружаем главы при старте

});



