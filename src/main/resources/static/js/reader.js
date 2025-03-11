document.addEventListener("DOMContentLoaded", function () {
    // ===== Инициализация =====
    const searchInput = document.getElementById("searchInput");
    const searchIcon = document.getElementById("searchIcon");
    const clearSearch = document.getElementById("clearSearch");
    const reader = document.getElementById("reader");
    let isPageLoading = false;

    setTimeout(() => {
        loadChapters();
    }, 500);

    // ===== Функция загрузки страницы (основная) =====
    window.loadPage = async function(url, chapterId = null) {
        if (isPageLoading) {
            console.log("⚠️ Page loading already in progress, ignoring new request");
            return Promise.reject("Page is already loading");
        }

        console.log(`🔄 Loading page: ${url}`);
        isPageLoading = true;

        // Добавляем индикатор загрузки
        const loader = document.createElement('div');
        loader.className = 'page-loader';
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);

        try {
            // Загружаем страницу через AJAX
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const newReader = doc.getElementById("reader");
            const currentReader = document.getElementById("reader");

            // Обновляем содержимое
            if (currentReader && newReader) {
                const fragment = document.createDocumentFragment();
                Array.from(newReader.childNodes).forEach(node => {
                    fragment.appendChild(node.cloneNode(true));
                });

                currentReader.innerHTML = '';
                currentReader.appendChild(fragment);
            }

            // Обновляем URL без перезагрузки
            window.history.pushState({}, '', url);

            // Запускаем обновление UI после перерисовки
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (typeof forceApplyLineHeight === 'function') forceApplyLineHeight();
                        updateNavigation(doc);
                        updateChapterIds();
                        resolve();
                    });
                });
            });

            // Загружаем главы, если еще не загружены
            if (!chapterCache.isLoaded && !chapterCache.isLoading) {
                await loadChapters().catch(error => {
                    console.error("Error during initial chapter loading:", error);
                });
            }

            // Прокручиваем к главе, если указана
            if (chapterId) {
                await new Promise(resolve => {
                    setTimeout(() => {
                        const element = document.getElementById(chapterId);
                        if (element) {
                            element.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                        resolve();
                    }, 200);
                });
            }

            // Применяем сохраненные стили
            if (typeof applyBookFontSize === 'function') applyBookFontSize();
            if (typeof forceApplyLineHeight === 'function') forceApplyLineHeight();

            // Сообщаем о полной загрузке
            const pageLoadedEvent = new Event('pageFullyLoaded');
            document.dispatchEvent(pageLoadedEvent);

            return Promise.resolve();

        } catch (error) {
            console.error("❌ Error loading page:", error);
            throw error;
        } finally {
            isPageLoading = false;
            if (document.querySelector('.page-loader')) {
                document.querySelector('.page-loader').remove();
            }
        }
    };

    // ===== Переключатель режима двух страниц =====
    const toggleTwoPageMode = document.getElementById("toggleTwoPageMode");
    if (toggleTwoPageMode) {
        toggleTwoPageMode.addEventListener("click", function() {
            const loader = document.createElement('div');
            loader.className = 'page-loader';
            loader.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(loader);

            try {
                const currentUrl = new URL(window.location.href);
                const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
                const bookId = window.location.pathname.split("/")[2];

                const newUrl = new URL(`/book/${bookId}`, window.location.origin);

                const newTwoPageMode = !isTwoPageMode;

                newUrl.searchParams.set("twoPageMode", newTwoPageMode.toString());
                newUrl.searchParams.set("page", newTwoPageMode ? "0" : "1");
                const newWordsPerScreen = newTwoPageMode ? 750 : 1500;
                newUrl.searchParams.set("wordsPerScreen", newWordsPerScreen.toString());

                // Сохраняем настройку двухстраничного режима
                fetch('/setBookTwoPageMode', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `bookId=${bookId}&twoPageMode=${newTwoPageMode}`,
                    credentials: 'same-origin'
                }).then(response => {
                    if (response.ok) {
                        // Перенаправляем только после успешного сохранения
                        window.location.href = newUrl.toString();
                    } else {
                        throw new Error('Не удалось сохранить режим');
                    }
                }).catch(error => {
                    console.error('Ошибка:', error);
                    document.body.removeChild(loader);
                    alert('Произошла ошибка.');
                });
            } catch (error) {
                console.error('Error during mode switch:', error);
                document.body.removeChild(loader);
                alert('Произошла ошибка.');
            }
        });
    }

    // ===== Вспомогательные функции =====
    function getWordsPerScreen() {
        const reader = document.getElementById("reader");
        if (!reader) return 1500;


        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";

        return isTwoPageMode ? 750 : 1500;
    }
    window.getWordsPerScreen = getWordsPerScreen;

    function highlightText(query) {
        const contentEl = document.getElementById("reader");

        contentEl.querySelectorAll(".highlight").forEach(el => {
            const parent = el.parentNode;

            while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
            }

            parent.removeChild(el);
        });
        if (!query.trim()) return;

        const fullText = contentEl.textContent;
        const lowerFullText = fullText.toLowerCase();
        const lowerQuery = query.toLowerCase();

        let startPos = 0;
        let occurrences = [];

        while (true) {
            const matchIndex = lowerFullText.indexOf(lowerQuery, startPos);
            if (matchIndex === -1) break;
            occurrences.push({ start: matchIndex, end: matchIndex + query.length });
            startPos = matchIndex + query.length;
        }

        if (occurrences.length === 0) return;

        for (let i = occurrences.length - 1; i >= 0; i--) {
            const { start, end } = occurrences[i];
            let currentPos = 0;
            const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, null);
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
    }

    // ===== Кэш глав =====
    class ChapterCache {
        constructor() {
            this.chapters = new Map();
            this.isLoaded = false;
            this.isLoading = false;
            this.wordsPerScreen = null;
        }

        set(chapterId, chapterData, wordsPerScreen) {
            const key = this.generateKey(chapterId, wordsPerScreen);
            this.chapters.set(key, chapterData);
        }

        get(chapterId, wordsPerScreen) {
            const key = this.generateKey(chapterId, wordsPerScreen);
            return this.chapters.get(key);
        }

        has(chapterId, wordsPerScreen) {
            const key = this.generateKey(chapterId, wordsPerScreen);
            return this.chapters.has(key);
        }

        generateKey(chapterId, wordsPerScreen) {
            return `${chapterId}-${wordsPerScreen}`;
        }

        clear() {
            this.chapters.clear();
            this.isLoaded = false;
            this.wordsPerScreen = null;
        }

        getAllSorted(wordsPerScreen) {
            const chapters = Array.from(this.chapters.entries())
                .filter(([key]) => key.endsWith(`-${wordsPerScreen}`))
                .map(([_, value]) => value)
                .sort((a, b) => a.page - b.page);
            return chapters;
        }
    }

    const chapterCache = new ChapterCache();

    // ===== Загрузка глав =====
    async function loadChapters() {
        try {
            const currentUrl = new URL(window.location.href);
            const currentWordsPerScreen = currentUrl.searchParams.get("wordsPerScreen") || getWordsPerScreen();

            // Если главы уже загружены с текущим wordsPerScreen, используем кэш
            if (chapterCache.isLoaded && chapterCache.wordsPerScreen === currentWordsPerScreen) {
                console.log("✅ Using cached chapters for wordsPerScreen:", currentWordsPerScreen);
                updateChapterList(currentWordsPerScreen);
                return;
            }

            if (chapterCache.isLoading) {
                console.log("⚠️ Loading in progress...");
                return;
            }

            console.log("⏳ Loading chapters for wordsPerScreen:", currentWordsPerScreen);
            chapterCache.isLoading = true;
            chapterCache.wordsPerScreen = currentWordsPerScreen;

            const totalPages = parseInt(document.getElementById("pageInput").max);
            const bookId = window.location.pathname.split("/")[2];
            const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";

            const initialPages = [1, Math.floor(totalPages / 2), totalPages];
            await Promise.all(
                initialPages.map(page => loadPageChapters(page, bookId, isTwoPageMode, currentWordsPerScreen))
            );

            updateChapterList(currentWordsPerScreen);
            loadRemainingChapters(totalPages, bookId, isTwoPageMode, currentWordsPerScreen);

            chapterCache.isLoaded = true;

        } catch (error) {
            console.error("❌ Error loading chapters:", error);
            chapterCache.clear();
        } finally {
            chapterCache.isLoading = false;
        }
    }

    async function loadPageChapters(page, bookId, isTwoPageMode, wordsPerScreen) {
        try {
            const pageUrl = new URL(`/book/${bookId}`, window.location.origin);
            pageUrl.searchParams.set("page", page.toString());
            pageUrl.searchParams.set("twoPageMode", isTwoPageMode.toString());
            pageUrl.searchParams.set("wordsPerScreen", wordsPerScreen.toString());

            const response = await fetch(pageUrl.toString());
            if (!response.ok) return;

            const text = await response.text();
            const doc = new DOMParser().parseFromString(text, "text/html");

            const headings = doc.querySelectorAll("section h3");
            console.log(`📖 Page ${page}: found ${headings.length} headers`);

            headings.forEach((heading) => {
                const chapterText = heading.textContent.trim();
                const chapterId = generateChapterId(chapterText);

                if (!chapterCache.has(chapterId, wordsPerScreen)) {
                    let chapterPage = page;

                    if (isTwoPageMode) {
                        chapterPage = page;
                    }

                    const match = chapterText.match(/\d+/);
                    const number = match ? parseInt(match[0]) : null;

                    chapterCache.set(chapterId, {
                        id: chapterId,
                        page: chapterPage,
                        title: chapterText,
                        index: page,
                        number: number
                    }, wordsPerScreen);

                    console.log(`✅ Added chapter ${number}: "${chapterText}" on page ${chapterPage}`);
                }
            });
        } catch (error) {
            console.error(`Error on page ${page}:`, error);
        }
    }

    async function loadRemainingChapters(totalPages, bookId, isTwoPageMode, wordsPerScreen) {
        const batchSize = 10;
        const batches = [];

        for (let page = 2; page < totalPages; page += batchSize) {
            const batch = [];
            for (let i = 0; i < batchSize && (page + i) < totalPages; i++) {
                batch.push(loadPageChapters(page + i, bookId, isTwoPageMode, wordsPerScreen));
            }
            batches.push(batch);
        }

        try {
            for (const batch of batches) {
                await Promise.all(batch);
                updateChapterList(wordsPerScreen);
            }
        } catch (error) {
            console.error("Error loading chapters batch:", error);
        }
    }

    function updateChapterList(wordsPerScreen) {
        const chapterList = document.getElementById("chapterList");
        if (!chapterList) return;

        chapterList.innerHTML = "";

        const sortedChapters = chapterCache.getAllSorted(wordsPerScreen);

        sortedChapters.forEach(chapter => {
            const li = document.createElement("li");
            li.textContent = chapter.title;
            li.dataset.target = chapter.id;
            li.dataset.page = chapter.page;
            li.dataset.number = chapter.number;
            li.addEventListener("click", () => goToChapter(chapter.id));
            chapterList.appendChild(li);
        });
    }

    function updateChapterIds() {
        document.querySelectorAll("section h3").forEach(heading => {
            const chapterText = heading.textContent.trim();
            const chapterId = generateChapterId(chapterText);
            heading.setAttribute("id", chapterId);
        });
    }

    function generateChapterId(title) {
        const match = title.match(/\d+/);
        if (match) {
            return `chapter-${match[0]}`;
        }

        return `chapter-${title.toLowerCase()
            .replace(/[^а-яёa-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')}`;
    }

    // ===== Функция перехода к главе =====
    async function goToChapter(chapterId) {
        console.log(`🎯 Going to chapter: ${chapterId}`);

        const currentUrl = new URL(window.location.href);
        const wordsPerScreen = currentUrl.searchParams.get("wordsPerScreen") || getWordsPerScreen();

        const chapterData = chapterCache.get(chapterId, wordsPerScreen);
        if (!chapterData) {
            console.error(`❌ Chapter not found: ${chapterId}`);
            return;
        }
        if (window.innerWidth <= 1024) {
            const sidebarRight = document.getElementById('sidebarRight');
            if (sidebarRight) {
                sidebarRight.classList.remove('open');
            }
        }
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
        const bookId = window.location.pathname.split("/")[2];

        let targetPage = chapterData.page;

        const fullUrl = new URL(`${window.location.origin}/book/${bookId}`);
        fullUrl.searchParams.set("page", targetPage.toString());
        fullUrl.searchParams.set("twoPageMode", isTwoPageMode.toString());
        fullUrl.searchParams.set("wordsPerScreen", wordsPerScreen.toString());

        try {
            await saveCurrentPage(targetPage);
            await loadPage(fullUrl.toString());

            setTimeout(() => {
                updateChapterIds();

                const element = document.getElementById(chapterId);
                if (element) {
                    const headerHeight = document.querySelector('.navigation')?.offsetHeight || 0;
                    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;

                    window.scrollTo({
                        top: elementPosition - headerHeight - 20,
                        behavior: 'smooth'
                    });
                }
            }, 150);
        } catch (error) {
            console.error("❌ Error navigating to chapter:", error);
        }
    }
    window.goToChapter = goToChapter;

    // ===== Функция подсветки заметок =====
    // Функция для подсветки текста заметки в книге
    function highlightNote(page, specificText, context) {
        const reader = document.getElementById("reader");
        if (!reader) {
            console.error("Ошибка: элемент reader не найден!");
            return false;
        }

        // Получаем текст заметки из параметра или из localStorage
        const noteText = specificText || localStorage.getItem("highlightFragment");
        if (!noteText) {
            console.warn("Текст для подсветки не найден");
            return false;
        }

        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
        const currentPage = parseInt(document.getElementById("pageInput").value);

        // Если на обложке в двухстраничном режиме, переходим на нужную страницу
        if (isTwoPageMode && currentPage === 0 && page > 0) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("page", page.toString());

            if (typeof loadPage === "function") {
                loadPage(newUrl.toString()).then(() => {
                    setTimeout(() => highlightNote(page, noteText, context), 300);
                });
                return false;
            } else {
                window.location.href = newUrl.toString();
                return false;
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

        // Стратегия 1: Пытаемся найти точное совпадение
        let occurrences = findExactMatches(reader, noteText);

        // Стратегия 2: Если точных совпадений нет, пробуем найти по частям
        if (occurrences.length === 0) {
            occurrences = findPartialMatches(reader, noteText);
        }

        // Стратегия 3: Если и это не помогло, пробуем использовать контекст (если доступен)
        if (occurrences.length === 0 && context) {
            occurrences = findMatchesByContext(reader, noteText, context);
        }

        // Если нашли совпадения, подсвечиваем их
        if (occurrences.length > 0) {
            // Сортируем по позиции
            occurrences.sort((a, b) => a.start - b.start);

            // Применяем подсветку
            applyHighlights(reader, occurrences);

            // Прокручиваем к первой подсветке
            const firstHighlight = reader.querySelector(".highlight");
            if (firstHighlight) {
                setTimeout(() => {
                    firstHighlight.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 200);
            }

            return true;
        }

        // Если на текущей странице нет совпадений и мы не на нужной странице,
        // переходим на страницу из параметра
        if (page !== currentPage) {
            console.warn(`Текст не найден на текущей странице (${currentPage}), переходим на страницу ${page}`);

            const bookId = window.location.pathname.split("/")[2];
            const newUrl = new URL(`/book/${bookId}`, window.location.origin);
            newUrl.searchParams.set("page", page.toString());
            newUrl.searchParams.set("twoPageMode", isTwoPageMode.toString());
            newUrl.searchParams.set("wordsPerScreen", currentUrl.searchParams.get("wordsPerScreen") || "1500");

            if (typeof loadPage === "function") {
                loadPage(newUrl.toString()).then(() => {
                    setTimeout(() => highlightNote(page, noteText, context), 300);
                });
            } else {
                window.location.href = newUrl.toString();
            }
        } else {
            console.warn(`Текст не найден на странице ${page}`);
        }

        return false;
    }

    /**
     * Ищет точные совпадения текста заметки в содержимом
     */
    function findExactMatches(container, text) {
        const fullText = container.textContent;
        const lowerFullText = fullText.toLowerCase();
        const lowerText = text.toLowerCase();

        let occurrences = [];
        let startPos = 0;

        while (true) {
            const index = lowerFullText.indexOf(lowerText, startPos);
            if (index === -1) break;
            occurrences.push({ start: index, end: index + text.length });
            startPos = index + text.length;
        }

        return occurrences;
    }

    /**
     * Ищет частичные совпадения, разбивая текст заметки на параграфы или предложения
     */
    function findPartialMatches(container, text) {
        const fullText = container.textContent;
        const lowerFullText = fullText.toLowerCase();

        // Разбиваем на параграфы
        const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 15);
        if (paragraphs.length === 0) {
            // Если нет параграфов, разбиваем на предложения
            const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
            paragraphs.push(...sentences);
        }

        // Ищем каждый параграф
        let occurrences = [];
        paragraphs.forEach(para => {
            const lowerPara = para.toLowerCase();
            let startPos = 0;
            while (true) {
                const index = lowerFullText.indexOf(lowerPara, startPos);
                if (index === -1) break;
                occurrences.push({ start: index, end: index + para.length });
                startPos = index + para.length;
            }
        });

        return occurrences;
    }

    /**
     * Ищет совпадения с использованием контекста до и после текста заметки
     */
    function findMatchesByContext(container, text, context) {
        if (!context || !context.before || !context.after) return [];

        const fullText = container.textContent;
        const lowerFullText = fullText.toLowerCase();
        const lowerBefore = context.before.toLowerCase();
        const lowerAfter = context.after.toLowerCase();

        // Ищем по контексту
        let occurrences = [];
        let pos = 0;

        while (true) {
            // Находим начало контекста
            const beforeIndex = lowerFullText.indexOf(lowerBefore, pos);
            if (beforeIndex === -1) break;

            // Ищем конец контекста после найденного начала
            const afterSearchStart = beforeIndex + lowerBefore.length;
            const afterIndex = lowerFullText.indexOf(lowerAfter, afterSearchStart);

            if (afterIndex !== -1 && afterIndex - afterSearchStart < text.length * 1.5) {
                // Вероятная позиция текста между найденными фрагментами контекста
                const start = beforeIndex + lowerBefore.length;
                const end = afterIndex;

                occurrences.push({ start, end });
            }

            pos = beforeIndex + lowerBefore.length;
        }

        return occurrences;
    }

    /**
     * Применяет подсветку к найденным фрагментам
     */
    function applyHighlights(container, occurrences) {
        for (let i = occurrences.length - 1; i >= 0; i--) {
            const { start, end } = occurrences[i];
            let currentPos = 0;
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
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
    }

// Делаем функцию доступной глобально
    window.highlightNote = highlightNote;

    // ===== Обработчики событий для различных элементов UI =====
    document.addEventListener("click", function (event) {
        if (!event.target.classList.contains("highlight")) {
            console.log("Очищаем подсветку");
            highlightText("");
        }
    });

    if (searchIcon) {
        searchIcon.addEventListener("click", function (event) {
            event.preventDefault();

            if (window.innerWidth <= 1024) {
                searchInput.classList.add("show");
                searchInput.style.display = "block";
                searchInput.focus();
            } else {
                searchIcon.style.display = "none";
                searchInput.style.display = "inline-block";
                clearSearch.style.display = "inline-block";
                searchInput.focus();
            }
        });
    }

    document.addEventListener("click", function (event) {
        if (window.innerWidth <= 1024) {
            if (searchInput && !searchInput.contains(event.target) &&
                searchIcon && !searchIcon.contains(event.target)) {
                searchInput.classList.remove("show");
                setTimeout(() => searchInput.style.display = "none", 300);
            }
        } else {
            if (searchInput && !searchInput.contains(event.target) &&
                searchIcon && !searchIcon.contains(event.target) &&
                clearSearch && !clearSearch.contains(event.target)) {
                searchInput.style.display = "none";
                clearSearch.style.display = "none";
                searchIcon.style.display = "inline-block";
            }
        }
    });

    if (searchInput) {
        searchInput.addEventListener("input", function (event) {
            event.preventDefault();
            highlightText(this.value);
        });
    }

    if (clearSearch) {
        clearSearch.addEventListener("click", function (event) {
            event.preventDefault();
            searchInput.value = "";
            highlightText("");
        });
    }

    // ===== Навигация =====
    let totalPagesGlobal = null;

    document.addEventListener("DOMContentLoaded", function() {
        const pageInput = document.getElementById("pageInput");
        if (pageInput) {
            totalPagesGlobal = parseInt(pageInput.max);
        }
    });

    function updateNavigation(doc) {
        // Пытаемся получить элемент #pageInput из полученного документа
        const existingPageInput = doc.querySelector("#pageInput");
        let pageValue, pageMax;
        if (existingPageInput) {
            pageValue = existingPageInput.value;
            pageMax = existingPageInput.max;
            // Обновляем глобальное значение, если оно еще не установлено
            if (!totalPagesGlobal) {
                totalPagesGlobal = parseInt(pageMax);
            }
        } else {
            const currentUrl = new URL(window.location.href);
            // Если элемент не найден, используем параметры URL или дефолтные значения
            pageValue = currentUrl.searchParams.get("page") || (currentUrl.searchParams.get("twoPageMode") === "true" ? "0" : "1");
            pageMax = totalPagesGlobal ? totalPagesGlobal.toString() : "100";
        }

        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";

        // Если включён двухстраничный режим, уменьшаем максимальное число страниц на 1
        pageMax = parseInt(pageMax);
        if (isTwoPageMode && !isNaN(pageMax)) {
            pageMax = (pageMax - 1).toString();
        } else {
            pageMax = pageMax.toString();
        }

        // Если какие-то значения отсутствуют, устанавливаем их по умолчанию
        if (!pageValue) {
            pageValue = currentUrl.searchParams.get("page") || (isTwoPageMode ? "0" : "1");
        }

        // Удаляем старую навигацию
        document.querySelectorAll('.navigation').forEach(nav => nav.remove());

        // Создаём контейнер для новой навигации
        let navigationElement = document.createElement("div");
        navigationElement.className = "navigation";
        const readerContainer = document.querySelector(".reader-container");
        if (readerContainer) {
            readerContainer.prepend(navigationElement);
        } else {
            const reader = document.getElementById("reader");
            if (reader) {
                reader.parentNode.insertBefore(navigationElement, reader);
            }
        }
        navigationElement.innerHTML = '';

        // Определяем текущую страницу из URL
        const currentPage = currentUrl.searchParams.has("page")
            ? parseInt(currentUrl.searchParams.get("page"))
            : (isTwoPageMode ? 0 : 1);

        // Кнопка "Назад"
        const prevPage = document.createElement("a");
        prevPage.id = "prevPage";
        prevPage.innerHTML = `<i class="fa-solid fa-chevron-left"></i>`;
        prevPage.style.marginRight = "8px";

        if ((isTwoPageMode && currentPage > 0) || (!isTwoPageMode && currentPage > 1)) {
            prevPage.style.display = "inline";
            const prevPageNum = (isTwoPageMode && currentPage === 1) ? 0 : currentPage - 1;
            let prevUrl = new URL(currentUrl);
            prevUrl.searchParams.set("page", prevPageNum.toString());
            prevUrl.searchParams.set("twoPageMode", isTwoPageMode.toString());
            prevPage.href = prevUrl.toString();
            navigationElement.appendChild(prevPage);

            prevPage.addEventListener("click", function(event) {
                event.preventDefault();
                if (!isPageLoading) {
                    // Сохраняем выбранную страницу
                    saveCurrentPage(prevPageNum);
                    loadPage(this.href);
                }
            });
        }

        // Поле ввода страницы и отображение максимума
        const pageInput = document.createElement("input");
        pageInput.type = "number";
        pageInput.id = "pageInput";
        pageInput.className = "page-input";
        pageInput.min = isTwoPageMode ? "0" : "1";
        pageInput.max = pageMax;
        pageInput.value = pageValue;

        const pageDisplay = document.createElement("span");
        pageDisplay.className = "page-display";
        pageDisplay.textContent = ` / ${pageMax}`;

        // Привязываем обработчик изменения сразу при создании элемента
        pageInput.addEventListener("change", function() {
            const newPage = parseInt(this.value);
            const totalPages = parseInt(this.max);
            const minPage = isTwoPageMode ? 0 : 1;
            if (!isNaN(newPage) && newPage >= minPage && newPage <= totalPages) {
                // Сохраняем страницу
                saveCurrentPage(newPage);
                // Делаем задержку, чтобы запрос успел выполниться
                setTimeout(() => {
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set("page", newPage.toString());
                    loadPage(newUrl.toString());
                }, 200);
            } else {
                console.warn("⚠️ Некорректный номер страницы:", newPage);
                this.value = pageValue;
            }
        });

        navigationElement.appendChild(pageInput);
        navigationElement.appendChild(pageDisplay);

        // Кнопка "Вперёд"
        const maxPageInt = parseInt(pageMax);
        if (currentPage < maxPageInt) {
            const nextPage = document.createElement("a");
            nextPage.id = "nextPage";
            nextPage.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
            nextPage.style.marginLeft = "8px";

            const nextPageNum = isTwoPageMode && currentPage === 0 ? 1 : currentPage + 1;
            let nextUrl = new URL(currentUrl);
            nextUrl.searchParams.set("page", nextPageNum.toString());
            nextUrl.searchParams.set("twoPageMode", isTwoPageMode.toString());
            nextPage.href = nextUrl.toString();

            navigationElement.appendChild(nextPage);
            nextPage.addEventListener("click", function(event) {
                event.preventDefault();
                if (!isPageLoading) {
                    // Сохраняем выбранную страницу
                    saveCurrentPage(nextPageNum);
                    loadPage(this.href);
                }
            });
        }
    }

    function saveCurrentPage(page) {
        const bookId = window.location.pathname.split("/")[2];
        fetch('/savePage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            credentials: 'same-origin',
            body: 'page=' + encodeURIComponent(page) + '&bookId=' + encodeURIComponent(bookId),
            keepalive: true
        }).then(response => {
            if (!response.ok) {
                console.error("Ошибка сохранения страницы");
            }
        }).catch(error => {
            console.error("Ошибка запроса:", error);
        });
    }

    // Инициализация при загрузке
    document.addEventListener("DOMContentLoaded", function() {
        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
        updateNavigation(document);
    });

    // Панель боковой навигации
    const toggleSidebarRight = document.getElementById("toggleSidebarRight");
    if (toggleSidebarRight) {
        toggleSidebarRight.addEventListener("click", function() {
            const sidebarRight = document.getElementById("sidebarRight");
            if (sidebarRight) {
                sidebarRight.classList.toggle("open");
            }
        });
    }

    // Инициализируем навигацию
    updateNavigation(document);
});

// ===== Функции темы =====
function setTheme(theme) {
    let body = document.body;
    body.className = "";
    body.classList.add("theme-" + theme);

    document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));

    const themeElement = document.querySelector('.theme-' + theme);
    if (themeElement) {
        themeElement.classList.add('active');
    }

    // Получаем ID книги из URL
    const bookId = window.location.pathname.split("/")[2];

    // Сохраняем тему в localStorage с учетом книги и пользователя
    localStorage.setItem(`selectedTheme_${bookId}`, theme);

    // Отправляем запрос на сервер для сохранения темы книги
    fetch('/setBookTheme', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `bookId=${bookId}&theme=${theme}`,
        credentials: 'same-origin'
    }).then(response => {
        if (!response.ok) {
            console.error('Не удалось сохранить тему книги');
        }
    }).catch(error => {
        console.error('Ошибка при сохранении темы книги:', error);
    });
}

// Применяем тему при загрузке страницы
document.addEventListener("DOMContentLoaded", function() {
    const bookId = window.location.pathname.split("/")[2];
    const localStorageTheme = localStorage.getItem(`selectedTheme_${bookId}`);
    const serverTheme = document.body.getAttribute('data-book-theme');
    const themeToApply = localStorageTheme || serverTheme || 'original';
    setTheme(themeToApply);
});

// ===== Функции шрифта =====
document.addEventListener("DOMContentLoaded", function () {
    const fontSelectIcon = document.getElementById("fontSelectIcon");
    const fontDropdown = document.getElementById("fontDropdown");
    const fontOptions = document.querySelectorAll(".font-option");
    const reader = document.getElementById("reader");
    const bookId = window.location.pathname.split("/")[2];

    if (!fontSelectIcon || !fontDropdown || !reader) return;

    fontSelectIcon.addEventListener("click", function (event) {
        event.stopPropagation();
        fontDropdown.style.display = (fontDropdown.style.display === "block") ? "none" : "block";
        positionFontDropdown();
    });

    function positionFontDropdown() {
        const rect = fontSelectIcon.getBoundingClientRect();
        fontDropdown.style.position = "absolute";
        fontDropdown.style.left = `${rect.left}px`;

        if (window.innerWidth <= 1024) {
            fontDropdown.style.top = `${rect.top + window.scrollY - fontDropdown.offsetHeight - 5}px`;
        } else {
            fontDropdown.style.top = `${rect.bottom + window.scrollY + 5}px`;
        }
    }

    fontOptions.forEach(option => {
        option.addEventListener("click", function () {
            const selectedFont = this.getAttribute("data-font");

            // Применяем шрифт к читателю
            reader.style.fontFamily = selectedFont;

            // Сохраняем шрифт в localStorage с учетом книги
            localStorage.setItem(`selectedFont_${bookId}`, selectedFont);

            // Отправляем запрос на сервер для сохранения шрифта книги
            fetch('/setBookFont', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `bookId=${bookId}&font=${selectedFont}`,
                credentials: 'same-origin'
            }).then(response => {
                if (!response.ok) {
                    console.error('Не удалось сохранить шрифт книги');
                }
            }).catch(error => {
                console.error('Ошибка при сохранении шрифта книги:', error);
            });

            fontDropdown.style.display = "none";
        });
    });

    document.addEventListener("click", function (event) {
        if (!fontSelectIcon.contains(event.target) && !fontDropdown.contains(event.target)) {
            fontDropdown.style.display = "none";
        }
    });

    // Применяем шрифт при загрузке страницы
    function applyBookFont() {
        // Приоритет:
        // 1. Шрифт из localStorage для конкретной книги
        // 2. Шрифт книги, полученный с сервера
        // 3. Дефолтный шрифт "Georgia"

        const localStorageFont = localStorage.getItem(`selectedFont_${bookId}`);
        const serverFont = document.body.getAttribute('data-book-font');

        const fontToApply = localStorageFont || serverFont || 'Georgia';

        reader.style.fontFamily = fontToApply;

        // Обновляем активный шрифт в выпадающем списке
        fontOptions.forEach(option => {
            const font = option.getAttribute('data-font');
            if (font === fontToApply) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    applyBookFont();
});

// ===== Функции размера шрифта =====
function changeFontSize(delta) {
    const bookId = window.location.pathname.split("/")[2];
    const reader = document.getElementById("reader");
    const fontSizeDisplay = document.getElementById("fontSizeDisplay");

    if (!reader || !fontSizeDisplay) return;

    let currentSize = parseInt(fontSizeDisplay.textContent);
    let newSize = Math.max(12, Math.min(32, currentSize + delta));

    // Применяем размер шрифта
    reader.style.fontSize = newSize + "px";
    fontSizeDisplay.textContent = newSize;

    // Сохраняем размер шрифта в localStorage
    localStorage.setItem(`selectedFontSize_${bookId}`, newSize);

    // Отправляем запрос на сервер для сохранения размера шрифта книги
    fetch('/setBookFontSize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `bookId=${bookId}&fontSize=${newSize}`,
        credentials: 'same-origin'
    }).then(response => {
        if (!response.ok) {
            console.error('Не удалось сохранить размер шрифта книги');
        }
    }).catch(error => {
        console.error('Ошибка при сохранении размера шрифта книги:', error);
    });
}

function applyBookFontSize() {
    const bookId = window.location.pathname.split("/")[2];
    const reader = document.getElementById("reader");
    const fontSizeDisplay = document.getElementById("fontSizeDisplay");

    if (!reader) return;

    // Приоритет:
    // 1. Размер шрифта из localStorage для конкретной книги
    // 2. Размер шрифта книги, полученный с сервера
    // 3. Дефолтный размер 16

    const localStorageFontSize = localStorage.getItem(`selectedFontSize_${bookId}`);
    const serverFontSize = document.body.getAttribute('data-book-font-size');

    const fontSizeToApply = localStorageFontSize || serverFontSize || '16';
    const fontSizeNum = parseInt(fontSizeToApply);

    // Применяем размер шрифта
    reader.style.fontSize = `${fontSizeNum}px`;

    // Обновляем отображение размера шрифта
    if (fontSizeDisplay) {
        fontSizeDisplay.textContent = fontSizeNum;
    }
}

// Применяем размер шрифта при загрузке страницы
document.addEventListener("DOMContentLoaded", function() {
    applyBookFontSize();
});

// Делаем функции глобально доступными
window.applyBookFontSize = applyBookFontSize;
window.changeFontSize = changeFontSize;

// ===== Функции боковой панели =====
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    let touchStartY = 0;
    let touchEndY = 0;

    window.toggleSidebar = function() {
        const sidebarRight = document.getElementById('sidebarRight');
        const mobileMenuOptions = document.getElementById('mobileMenuOptions');

        if (sidebarRight) sidebarRight.classList.remove('open');
        sidebar.classList.toggle('open');

        if (window.innerWidth <= 1024 && mobileMenuOptions) {
            mobileMenuOptions.classList.remove('show');
            const mobileMenuButton = document.getElementById('mobileMenuButton');
            if (mobileMenuButton) mobileMenuButton.classList.remove('active');
        }
    };

    sidebar.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
    }, false);

    sidebar.addEventListener('touchmove', function(e) {
        touchEndY = e.touches[0].clientY;

        if (touchEndY > touchStartY) {
            const diff = touchEndY - touchStartY;
            if (diff > 50) {
                sidebar.classList.remove('open');
            }
        }
    }, false);
});

// ===== Функции межстрочного интервала =====
document.addEventListener("DOMContentLoaded", function () {
    const lineHeightIcon = document.getElementById("lineHeightIcon");
    const lineHeightContainer = document.getElementById("lineHeightContainer");
    const lineHeightSlider = document.getElementById("lineHeightSlider");
    const lineHeightValue = document.getElementById("lineHeightValue");
    const bookId = window.location.pathname.split("/")[2];

    if (!lineHeightIcon || !lineHeightContainer) return;

    // Функция для применения межстрочного интервала
    function applyLineHeight(value) {
        // Применяем к параграфам во всех контейнерах
        document.querySelectorAll(".container p, .reader-container p").forEach(p => {
            p.style.lineHeight = value;
        });

        // Обновляем слайдер и значение
        if (lineHeightSlider) lineHeightSlider.value = value;
        if (lineHeightValue) lineHeightValue.textContent = value;

        // Сохраняем в localStorage с учетом книги
        localStorage.setItem(`selectedLineHeight_${bookId}`, value);

        // Отправляем запрос на сервер для сохранения межстрочного интервала
        fetch('/setBookLineHeight', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `bookId=${bookId}&lineHeight=${value}`,
            credentials: 'same-origin'
        }).then(response => {
            if (!response.ok) {
                console.error('Не удалось сохранить межстрочный интервал');
            }
        }).catch(error => {
            console.error('Ошибка при сохранении межстрочного интервала:', error);
        });

        // Принудительное обновление высоты контейнера для двухстраничного режима
        const readerContainer = document.querySelector(".reader-container");
        if (readerContainer && readerContainer.classList.contains("two-page-mode")) {
            requestAnimationFrame(() => {
                const reader = document.getElementById("reader");
                const navigationHeight = document.querySelector(".navigation")?.offsetHeight || 0;
                const padding = 40;
                const viewportHeight = window.innerHeight;
                const availableHeight = viewportHeight - navigationHeight - padding;

                readerContainer.style.maxHeight = `${Math.max(availableHeight, reader.scrollHeight)}px`;
                readerContainer.style.overflowY = 'auto';
            });
        }
    }

    // Глобальная функция для немедленного применения межстрочного интервала
    function forceApplyLineHeight() {
        const bookId = window.location.pathname.split("/")[2];
        const localStorageLineHeight = localStorage.getItem(`selectedLineHeight_${bookId}`);
        const serverLineHeight = document.body.getAttribute('data-book-line-height');

        const lineHeightToApply = localStorageLineHeight || serverLineHeight || '1.5';

        applyLineHeight(lineHeightToApply);
    }

    // Первичное применение межстрочного интервала
    forceApplyLineHeight();

    // Обработчик колеса мыши для изменения межстрочного интервала
    lineHeightContainer.addEventListener('wheel', function(event) {
        event.preventDefault();

        const currentValue = parseFloat(lineHeightSlider.value);
        const delta = event.deltaY < 0 ? 0.1 : -0.1;

        const newValue = Math.min(Math.max(currentValue + delta, 1), 3);
        const roundedValue = Math.round(newValue * 10) / 10;

        applyLineHeight(roundedValue.toString());
    }, { passive: false });

    // Обработчик слайдера
    if (lineHeightSlider) {
        lineHeightSlider.addEventListener("input", function() {
            applyLineHeight(this.value);
        });
    }

    // Показ/скрытие контейнера настройки межстрочного интервала
    lineHeightIcon.addEventListener("click", function(event) {
        event.stopPropagation();
        lineHeightContainer.classList.toggle("active");
    });

    // Закрытие контейнера при клике вне его
    document.addEventListener("click", function(event) {
        if (!lineHeightContainer.contains(event.target) &&
            !lineHeightIcon.contains(event.target)) {
            lineHeightContainer.classList.remove("active");
        }
    });

    // Обработчик изменения размера окна
    window.addEventListener('resize', forceApplyLineHeight);

    // Экспортируем функции в глобальную область видимости
    window.forceApplyLineHeight = forceApplyLineHeight;
    window.applyLineHeight = applyLineHeight;
});

