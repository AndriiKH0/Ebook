document.addEventListener("DOMContentLoaded", function () {

    const searchInput = document.getElementById("searchInput");
    const searchIcon = document.getElementById("searchIcon");
    const clearSearch = document.getElementById("clearSearch");
    const reader = document.getElementById("reader");
    let isPageLoading = false;

    setTimeout(() => {
        loadChapters();
    }, 500);


    window.loadPage = async function(url, chapterId = null) {
        if (isPageLoading) {
            console.log("Page loading already in progress, ignoring new request");
            return Promise.reject("Page is already loading");
        }

        console.log(`🔄 Loading page: ${url}`);
        isPageLoading = true;


        const loader = document.createElement('div');
        loader.className = 'page-loader';
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);

        try {

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const newReader = doc.getElementById("reader");
            const currentReader = document.getElementById("reader");


            if (currentReader && newReader) {
                const fragment = document.createDocumentFragment();
                Array.from(newReader.childNodes).forEach(node => {
                    fragment.appendChild(node.cloneNode(true));
                });

                currentReader.innerHTML = '';
                currentReader.appendChild(fragment);
            }


            window.history.pushState({}, '', url);


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


            if (!chapterCache.isLoaded && !chapterCache.isLoading) {
                await loadChapters().catch(error => {
                    console.error("Error during initial chapter loading:", error);
                });
            }


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


            if (typeof applyBookFontSize === 'function') applyBookFontSize();
            if (typeof forceApplyLineHeight === 'function') forceApplyLineHeight();


            const pageLoadedEvent = new Event('pageFullyLoaded');
            document.dispatchEvent(pageLoadedEvent);

            return Promise.resolve();

        } catch (error) {
            console.error(" Error loading page:", error);
            throw error;
        } finally {
            isPageLoading = false;
            if (document.querySelector('.page-loader')) {
                document.querySelector('.page-loader').remove();
            }
        }
    };

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
                const newWordsPerScreen = newTwoPageMode ? 250 : 1500;
                newUrl.searchParams.set("wordsPerScreen", newWordsPerScreen.toString());


                fetch('/setBookTwoPageMode', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `bookId=${bookId}&twoPageMode=${newTwoPageMode}`,
                    credentials: 'same-origin'
                }).then(response => {
                    if (response.ok) {

                        window.location.href = newUrl.toString();
                    } else {
                        throw new Error('Failed to save mode');
                    }
                }).catch(error => {
                    console.error('Ошибка:', error);
                    document.body.removeChild(loader);
                    alert('An error occurred');
                });
            } catch (error) {
                console.error('Error during mode switch:', error);
                document.body.removeChild(loader);
                alert('An error occurred.');
            }
        });
    }


    function getWordsPerScreen() {
        const reader = document.getElementById("reader");
        if (!reader) return 1500;


        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";

        return isTwoPageMode ? 250 : 1500;
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


    async function loadChapters() {
        try {
            const currentUrl = new URL(window.location.href);
            const currentWordsPerScreen = currentUrl.searchParams.get("wordsPerScreen") || getWordsPerScreen();


            if (chapterCache.isLoaded && chapterCache.wordsPerScreen === currentWordsPerScreen) {
                console.log(" Using cached chapters for wordsPerScreen:", currentWordsPerScreen);
                updateChapterList(currentWordsPerScreen);
                return;
            }

            if (chapterCache.isLoading) {
                console.log("Loading in progress...");
                return;
            }

            console.log("Loading chapters for wordsPerScreen:", currentWordsPerScreen);
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
            console.error("Error loading chapters:", error);
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

                    console.log(`Added chapter ${number}: "${chapterText}" on page ${chapterPage}`);
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


    async function goToChapter(chapterId) {
        console.log(`Going to chapter: ${chapterId}`);

        const currentUrl = new URL(window.location.href);
        const wordsPerScreen = currentUrl.searchParams.get("wordsPerScreen") || getWordsPerScreen();

        const chapterData = chapterCache.get(chapterId, wordsPerScreen);
        if (!chapterData) {
            console.error(`Chapter not found: ${chapterId}`);
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



    function highlightNote(page, specificText, context) {
        const reader = document.getElementById("reader");
        if (!reader) {
            console.error("Error: Element reader not found!");
            return false;
        }


        const noteText = specificText || localStorage.getItem("highlightFragment");
        if (!noteText) {
            console.warn("Highlight text not found");
            return false;
        }

        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
        const currentPage = parseInt(document.getElementById("pageInput").value);


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


        reader.querySelectorAll(".highlight").forEach(el => {
            const parent = el.parentNode;
            while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
        });


        let occurrences = findExactMatches(reader, noteText);


        if (occurrences.length === 0) {
            occurrences = findPartialMatches(reader, noteText);
        }


        if (occurrences.length === 0 && context) {
            occurrences = findMatchesByContext(reader, noteText, context);
        }


        if (occurrences.length > 0) {

            occurrences.sort((a, b) => a.start - b.start);


            applyHighlights(reader, occurrences);


            const firstHighlight = reader.querySelector(".highlight");
            if (firstHighlight) {
                setTimeout(() => {
                    firstHighlight.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 200);
            }

            return true;
        }



        if (page !== currentPage) {
            console.warn(`Text not found on current page (${currentPage}), go to the page ${page}`);

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
            console.warn(`Text not found on page ${page}`);
        }

        return false;
    }


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


    function findPartialMatches(container, text) {
        const fullText = container.textContent;
        const lowerFullText = fullText.toLowerCase();


        const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 15);
        if (paragraphs.length === 0) {

            const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
            paragraphs.push(...sentences);
        }


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


    function findMatchesByContext(container, text, context) {
        if (!context || !context.before || !context.after) return [];

        const fullText = container.textContent;
        const lowerFullText = fullText.toLowerCase();
        const lowerBefore = context.before.toLowerCase();
        const lowerAfter = context.after.toLowerCase();


        let occurrences = [];
        let pos = 0;

        while (true) {

            const beforeIndex = lowerFullText.indexOf(lowerBefore, pos);
            if (beforeIndex === -1) break;


            const afterSearchStart = beforeIndex + lowerBefore.length;
            const afterIndex = lowerFullText.indexOf(lowerAfter, afterSearchStart);

            if (afterIndex !== -1 && afterIndex - afterSearchStart < text.length * 1.5) {

                const start = beforeIndex + lowerBefore.length;
                const end = afterIndex;

                occurrences.push({ start, end });
            }

            pos = beforeIndex + lowerBefore.length;
        }

        return occurrences;
    }


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


    window.highlightNote = highlightNote;


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


    let totalPagesGlobal = null;

    document.addEventListener("DOMContentLoaded", function() {
        const pageInput = document.getElementById("pageInput");
        if (pageInput) {
            totalPagesGlobal = parseInt(pageInput.max);
        }
    });

    function updateNavigation(doc) {

        const existingPageInput = doc.querySelector("#pageInput");
        let pageValue, pageMax;
        if (existingPageInput) {
            pageValue = existingPageInput.value;
            pageMax = existingPageInput.max;

            if (!totalPagesGlobal) {
                totalPagesGlobal = parseInt(pageMax);
            }
        } else {
            const currentUrl = new URL(window.location.href);

            pageValue = currentUrl.searchParams.get("page") || (currentUrl.searchParams.get("twoPageMode") === "true" ? "0" : "1");
            pageMax = totalPagesGlobal ? totalPagesGlobal.toString() : "100";
        }

        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";


        pageMax = parseInt(pageMax);
        if (isTwoPageMode && !isNaN(pageMax)) {
            pageMax = (pageMax - 1).toString();
        } else {
            pageMax = pageMax.toString();
        }


        if (!pageValue) {
            pageValue = currentUrl.searchParams.get("page") || (isTwoPageMode ? "0" : "1");
        }


        document.querySelectorAll('.navigation').forEach(nav => nav.remove());


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


        const currentPage = currentUrl.searchParams.has("page")
            ? parseInt(currentUrl.searchParams.get("page"))
            : (isTwoPageMode ? 0 : 1);


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

                    saveCurrentPage(prevPageNum);
                    loadPage(this.href);
                }
            });
        }


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


        pageInput.addEventListener("change", function() {
            const newPage = parseInt(this.value);
            const totalPages = parseInt(this.max);
            const minPage = isTwoPageMode ? 0 : 1;
            if (!isNaN(newPage) && newPage >= minPage && newPage <= totalPages) {

                saveCurrentPage(newPage);

                setTimeout(() => {
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set("page", newPage.toString());
                    loadPage(newUrl.toString());
                }, 200);
            } else {
                console.warn("Incorrect page number:", newPage);
                this.value = pageValue;
            }
        });

        navigationElement.appendChild(pageInput);
        navigationElement.appendChild(pageDisplay);


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
                console.error("Error saving page");
            }
        }).catch(error => {
            console.error("Request error:", error);
        });
    }


    document.addEventListener("DOMContentLoaded", function() {
        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
        updateNavigation(document);
    });


    const toggleSidebarRight = document.getElementById("toggleSidebarRight");
    if (toggleSidebarRight) {
        toggleSidebarRight.addEventListener("click", function() {
            const sidebarRight = document.getElementById("sidebarRight");
            if (sidebarRight) {
                sidebarRight.classList.toggle("open");
            }
        });
    }


    updateNavigation(document);
});


function setTheme(theme) {
    let body = document.body;
    body.className = "";
    body.classList.add("theme-" + theme);

    document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));

    const themeElement = document.querySelector('.theme-' + theme);
    if (themeElement) {
        themeElement.classList.add('active');
    }


    const bookId = window.location.pathname.split("/")[2];


    localStorage.setItem(`selectedTheme_${bookId}`, theme);


    fetch('/setBookTheme', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `bookId=${bookId}&theme=${theme}`,
        credentials: 'same-origin'
    }).then(response => {
        if (!response.ok) {
            console.error('Failed to save book theme');
        }
    }).catch(error => {
        console.error('Error saving book theme:', error);
    });
}


document.addEventListener("DOMContentLoaded", function() {
    const bookId = window.location.pathname.split("/")[2];
    const localStorageTheme = localStorage.getItem(`selectedTheme_${bookId}`);
    const serverTheme = document.body.getAttribute('data-book-theme');
    const themeToApply = localStorageTheme || serverTheme || 'original';
    setTheme(themeToApply);
});


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


            reader.style.fontFamily = selectedFont;


            localStorage.setItem(`selectedFont_${bookId}`, selectedFont);


            fetch('/setBookFont', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `bookId=${bookId}&font=${selectedFont}`,
                credentials: 'same-origin'
            }).then(response => {
                if (!response.ok) {
                    console.error('Failed to save book font');
                }
            }).catch(error => {
                console.error('Error saving book font:', error);
            });

            fontDropdown.style.display = "none";
        });
    });

    document.addEventListener("click", function (event) {
        if (!fontSelectIcon.contains(event.target) && !fontDropdown.contains(event.target)) {
            fontDropdown.style.display = "none";
        }
    });


    function applyBookFont() {





        const localStorageFont = localStorage.getItem(`selectedFont_${bookId}`);
        const serverFont = document.body.getAttribute('data-book-font');

        const fontToApply = localStorageFont || serverFont || 'Georgia';

        reader.style.fontFamily = fontToApply;


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


function changeFontSize(delta) {
    const bookId = window.location.pathname.split("/")[2];
    const reader = document.getElementById("reader");
    const fontSizeDisplay = document.getElementById("fontSizeDisplay");

    if (!reader || !fontSizeDisplay) return;

    let currentSize = parseInt(fontSizeDisplay.textContent);
    let newSize = Math.max(12, Math.min(32, currentSize + delta));


    reader.style.fontSize = newSize + "px";
    fontSizeDisplay.textContent = newSize;


    localStorage.setItem(`selectedFontSize_${bookId}`, newSize);


    fetch('/setBookFontSize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `bookId=${bookId}&fontSize=${newSize}`,
        credentials: 'same-origin'
    }).then(response => {
        if (!response.ok) {
            console.error('Failed to save book font size');
        }
    }).catch(error => {
        console.error('Error saving book font size:', error);
    });
}

function applyBookFontSize() {
    const bookId = window.location.pathname.split("/")[2];
    const reader = document.getElementById("reader");
    const fontSizeDisplay = document.getElementById("fontSizeDisplay");

    if (!reader) return;






    const localStorageFontSize = localStorage.getItem(`selectedFontSize_${bookId}`);
    const serverFontSize = document.body.getAttribute('data-book-font-size');

    const fontSizeToApply = localStorageFontSize || serverFontSize || '18';
    const fontSizeNum = parseInt(fontSizeToApply);


    reader.style.fontSize = `${fontSizeNum}px`;


    if (fontSizeDisplay) {
        fontSizeDisplay.textContent = fontSizeNum;
    }
}


document.addEventListener("DOMContentLoaded", function() {
    applyBookFontSize();
});


window.applyBookFontSize = applyBookFontSize;
window.changeFontSize = changeFontSize;


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


document.addEventListener("DOMContentLoaded", function () {
    const lineHeightIcon = document.getElementById("lineHeightIcon");
    const lineHeightContainer = document.getElementById("lineHeightContainer");
    const lineHeightSlider = document.getElementById("lineHeightSlider");
    const lineHeightValue = document.getElementById("lineHeightValue");
    const bookId = window.location.pathname.split("/")[2];

    if (!lineHeightIcon || !lineHeightContainer) return;


    function applyLineHeight(value) {

        document.querySelectorAll(".container p, .reader-container p").forEach(p => {
            p.style.lineHeight = value;
        });


        if (lineHeightSlider) lineHeightSlider.value = value;
        if (lineHeightValue) lineHeightValue.textContent = value;


        localStorage.setItem(`selectedLineHeight_${bookId}`, value);


        fetch('/setBookLineHeight', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `bookId=${bookId}&lineHeight=${value}`,
            credentials: 'same-origin'
        }).then(response => {
            if (!response.ok) {
                console.error('Failed to save line spacing');
            }
        }).catch(error => {
            console.error('Error while saving line spacing:', error);
        });


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


    function forceApplyLineHeight() {
        const bookId = window.location.pathname.split("/")[2];
        const localStorageLineHeight = localStorage.getItem(`selectedLineHeight_${bookId}`);
        const serverLineHeight = document.body.getAttribute('data-book-line-height');

        const lineHeightToApply = localStorageLineHeight || serverLineHeight || '1.5';

        applyLineHeight(lineHeightToApply);
    }


    forceApplyLineHeight();


    lineHeightContainer.addEventListener('wheel', function(event) {
        event.preventDefault();

        const currentValue = parseFloat(lineHeightSlider.value);
        const delta = event.deltaY < 0 ? 0.1 : -0.1;

        const newValue = Math.min(Math.max(currentValue + delta, 1), 3);
        const roundedValue = Math.round(newValue * 10) / 10;

        applyLineHeight(roundedValue.toString());
    }, { passive: false });


    if (lineHeightSlider) {
        lineHeightSlider.addEventListener("input", function() {
            applyLineHeight(this.value);
        });
    }


    lineHeightIcon.addEventListener("click", function(event) {
        event.stopPropagation();
        lineHeightContainer.classList.toggle("active");
    });


    document.addEventListener("click", function(event) {
        if (!lineHeightContainer.contains(event.target) &&
            !lineHeightIcon.contains(event.target)) {
            lineHeightContainer.classList.remove("active");
        }
    });


    window.addEventListener('resize', forceApplyLineHeight);


    window.forceApplyLineHeight = forceApplyLineHeight;
    window.applyLineHeight = applyLineHeight;
});

