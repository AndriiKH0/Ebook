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
    const bookId = window.location.pathname.split("/")[2];


    const MIN_NOTE_TEXT_LENGTH = 30;


    let selectedText = "";
    let selectionRange = null;
    let notesCache = [];


    if (!notesIcon || !notesPanel || !notesList) {
        console.error("Error: One of the note elements was not found.");
        return;
    }
    if (window.innerWidth <= 1024) {
        const closeBtn = document.createElement("button");
        closeBtn.id = "notesCloseBtn";
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.addEventListener("click", function() {
            notesPanel.classList.remove("mobile-open");
        });
        notesPanel.appendChild(closeBtn);
    }


    notesIcon.addEventListener("click", function () {
        if (window.innerWidth <= 1024) {

            notesPanel.style.display = "flex";
            notesPanel.classList.add("mobile-open");


            const sidebar = document.getElementById('sidebar');
            const sidebarRight = document.getElementById('sidebarRight');

            if (sidebar) sidebar.classList.remove('open');
            if (sidebarRight) sidebarRight.classList.remove('open');


            const mobileMenuOptions = document.getElementById('mobileMenuOptions');
            const mobileMenuButton = document.getElementById('mobileMenuButton');

            if (mobileMenuOptions && mobileMenuOptions.classList.contains('show')) {
                mobileMenuOptions.classList.remove('show');
                if (mobileMenuButton) mobileMenuButton.classList.remove('active');
            }
        } else {

            notesPanel.style.display = notesPanel.style.display === "flex" ? "none" : "flex";


            const rect = notesIcon.getBoundingClientRect();
            notesPanel.style.right = `${window.innerWidth - rect.right - 10}px`;
            notesPanel.style.top = `${rect.top}px`;
        }
    });


    document.addEventListener("click", function (event) {

        if (window.innerWidth > 1024) {
            if (!notesPanel.contains(event.target) &&
                !notesIcon.contains(event.target) &&
                notesPanel.style.display === "flex") {
                notesPanel.style.display = "none";
            }
        }
    });


    let touchStartY = 0;
    let touchEndY = 0;

    notesPanel.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
    }, false);

    notesPanel.addEventListener('touchmove', function(e) {
        touchEndY = e.touches[0].clientY;

        if (touchEndY > touchStartY) {
            const diff = touchEndY - touchStartY;
            if (diff > 50) {
                notesPanel.classList.remove("mobile-open");
            }
        }
    }, false);


    window.addEventListener('resize', function() {
        if (window.innerWidth <= 1024) {

            if (!document.getElementById("notesCloseBtn")) {
                const closeBtn = document.createElement("button");
                closeBtn.id = "notesCloseBtn";
                closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                closeBtn.addEventListener("click", function() {
                    notesPanel.classList.remove("mobile-open");
                });
                notesPanel.appendChild(closeBtn);
            }
        } else {

            notesPanel.classList.remove("mobile-open");


            const closeBtn = document.getElementById("notesCloseBtn");
            if (closeBtn) {
                closeBtn.remove();
            }
        }
    });

    function getTextColor(bgColor) {
        const r = parseInt(bgColor.substring(1, 3), 16);
        const g = parseInt(bgColor.substring(3, 5), 16);
        const b = parseInt(bgColor.substring(5, 7), 16);

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        return brightness < 128 ? "#ffffff" : "#000000";
    }


    function getTextContext(selectedText, range) {
        try {
            if (!range || !range.startContainer || !reader) return null;

            const readerContent = reader.textContent;
            const selectedTextNormalized = selectedText.replace(/\s+/g, ' ').trim();
            const readerContentNormalized = readerContent.replace(/\s+/g, ' ').trim();

            const textIndex = readerContentNormalized.indexOf(selectedTextNormalized);
            if (textIndex === -1) return null;


            const beforeLength = Math.min(100, textIndex);
            const beforeContext = readerContentNormalized.substring(textIndex - beforeLength, textIndex);


            const afterStart = textIndex + selectedTextNormalized.length;
            const afterLength = Math.min(100, readerContentNormalized.length - afterStart);
            const afterContext = readerContentNormalized.substring(afterStart, afterStart + afterLength);

            return {
                before: beforeContext,
                after: afterContext
            };
        } catch (e) {
            console.error("Error getting context:", e);
            return null;
        }
    }


    function openAddNotePopup() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        selectionRange = selection.getRangeAt(0);
        selectedText = selection.toString().trim();


        if (selectedText.length < MIN_NOTE_TEXT_LENGTH) {
            alert(`Select more text to create a note (minimum ${MIN_NOTE_TEXT_LENGTH} characters)`);
            return;
        }


        const endPosition = selection.focusNode;
        const endOffset = selection.focusOffset;


        const tempRange = document.createRange();
        tempRange.setStart(endPosition, endOffset);
        tempRange.setEnd(endPosition, endOffset);


        const cursorRect = tempRange.getBoundingClientRect();


        const rect = cursorRect.width === 0 && cursorRect.height === 0 ?
            selectionRange.getBoundingClientRect() : cursorRect;

        const popupWidth = addNotePopup.offsetWidth || 250;
        const popupHeight = addNotePopup.offsetHeight || 150;


        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;


        addNotePopup.classList.remove('arrow-left', 'arrow-right', 'arrow-top', 'arrow-bottom');


        let x, y;
        let arrowClass = '';


        const spaceRight = windowWidth - rect.right;
        const spaceLeft = rect.left;
        const spaceBottom = windowHeight - rect.bottom;
        const spaceTop = rect.top;


        if (spaceRight >= popupWidth + 20 && spaceRight >= spaceLeft) {

            x = rect.right + 15 + scrollLeft;
            y = rect.top + scrollTop;
            arrowClass = 'arrow-left';
        } else if (spaceLeft >= popupWidth + 20) {

            x = rect.left - popupWidth - 15 + scrollLeft;
            y = rect.top + scrollTop;
            arrowClass = 'arrow-right';
        } else if (spaceBottom >= popupHeight + 20 && spaceBottom >= spaceTop) {

            x = rect.left + scrollLeft;
            y = rect.bottom + 15 + scrollTop;
            arrowClass = 'arrow-top';
        } else if (spaceTop >= popupHeight + 20) {

            x = rect.left + scrollLeft;
            y = rect.top - popupHeight - 15 + scrollTop;
            arrowClass = 'arrow-bottom';
        } else {

            x = rect.left + scrollLeft;
            y = rect.bottom + 10 + scrollTop;
        }


        x = Math.max(20 + scrollLeft, Math.min(x, windowWidth - popupWidth - 20 + scrollLeft));
        y = Math.max(scrollTop + 20, Math.min(y, scrollTop + windowHeight - popupHeight - 20));


        if (arrowClass) {
            addNotePopup.classList.add(arrowClass);
        }


        addNotePopup.style.left = `${x}px`;
        addNotePopup.style.top = `${y}px`;
        addNotePopup.style.display = "block";


        addNotePopup.style.opacity = "0";
        addNotePopup.style.transform = "scale(0.9)";


        setTimeout(() => {
            addNotePopup.style.opacity = "1";
            addNotePopup.style.transform = "scale(1)";
        }, 10);


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


        deleteButton.addEventListener("click", function () {
            if (noteId) {
                fetch(`/api/notes/${noteId}`, {
                    method: 'DELETE',
                    credentials: 'same-origin'
                })
                    .then(response => {
                        if (response.ok) {
                            noteItem.remove();

                            notesCache = notesCache.filter(note => note.id !== noteId);
                        }
                    })
                    .catch(error => {
                        console.error('Error deleting note:', error);
                    });
            } else {
                noteItem.remove();
            }
        });


        pageLink.addEventListener("click", function (event) {
            event.preventDefault();
            navigateToNote(page, text);
        });

        notesList.appendChild(noteItem);
        return noteItem;
    }


    function navigateToNote(page, noteText) {
        if (window.innerWidth <= 1024) {
            notesPanel.style.display = "none";
            notesPanel.classList.remove("mobile-open");
        }
        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
        const currentWordsPerScreen = currentUrl.searchParams.get("wordsPerScreen");

        const newUrl = new URL(`/book/${bookId}`, window.location.origin);
        newUrl.searchParams.set("page", page.toString());
        newUrl.searchParams.set("twoPageMode", isTwoPageMode.toString());

        if (currentWordsPerScreen) {
            newUrl.searchParams.set("wordsPerScreen", currentWordsPerScreen);
        }


        localStorage.setItem("highlightFragment", noteText);

        if (typeof loadPage === "function") {
            loadPage(newUrl.toString()).then(() => {
                if (typeof highlightNote === "function") {

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            highlightNote(page);
                        });
                    });
                }
            }).catch(error => {
                console.error("Error navigating to note:", error);
            });
        } else {
            window.location.href = newUrl.toString();
        }
    }


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
                notesCache = notes;

                notes.forEach(note => {
                    createNote(note.title, note.text, note.color, note.page, note.id);
                });
            })
            .catch(error => {
                console.error('Error loading notes:', error);
            });
    }




    notesIcon.addEventListener("click", function () {
        if (window.innerWidth > 1024) {

            notesPanel.style.display = notesPanel.style.display === "block" ? "none" : "block";
            const rect = notesIcon.getBoundingClientRect();
            notesPanel.style.left = `${rect.right + 10}px`;
            notesPanel.style.top = `${rect.top}px`;
        } else {


            notesPanel.style.display = "flex";
            notesPanel.classList.add("mobile-open");
        }
    });


    reader.addEventListener("mouseup", function (event) {
        const selection = window.getSelection();
        if (selection.toString().trim()) {
            selectedText = selection.toString();
            selectionRange = selection.getRangeAt(0);
            openAddNotePopup();
        }
    });


    saveNote.addEventListener("click", function () {
        const title = noteTitleInput.value.trim();
        const color = noteColorInput.value;
        const page = document.getElementById("pageInput").value;
        const totalPages = parseInt(document.getElementById("pageInput").max);
        const wordsPerScreen = parseInt(new URL(window.location.href).searchParams.get("wordsPerScreen") || "1500");
        const isTwoPageMode = new URL(window.location.href).searchParams.get("twoPageMode") === "true";


        if (title && selectedText && selectedText.length >= MIN_NOTE_TEXT_LENGTH) {

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

                        return response.text().then(text => {
                            try {
                                const error = JSON.parse(text);
                                alert(error.error || 'Error saving note');
                            } catch (e) {
                                console.error('Response error:', text);
                                alert('Error saving note');
                            }
                            throw new Error('Error saving note');
                        });
                    }
                    return response.json();
                })
                .then(note => {
                    console.log('Note saved:', note);
                    createNote(note.title, note.text, note.color, note.page, note.id);
                    notesCache.push(note);

                    noteTitleInput.value = "";
                    selectedText = "";
                    closeAddNotePopup();



                })
                .catch(error => {
                    console.error('Error saving note:', error);
                });
        } else {
            alert(`Enter the note title and select the text (minimum ${MIN_NOTE_TEXT_LENGTH} characters).`);
        }
    });


    document.addEventListener("click", function (event) {
        if (!addNotePopup.contains(event.target) && !window.getSelection().toString()) {
            closeAddNotePopup();
        }


        if (!notesPanel.contains(event.target) && !notesIcon.contains(event.target)) {
            notesPanel.style.display = "none";
        }
    });


    document.addEventListener("scroll", closeAddNotePopup);


    cancelNote.addEventListener("click", closeAddNotePopup);


    clearNotes.addEventListener("click", function () {
        if (!confirm("Are you sure you want to delete all notes for this book?")) {
            return;
        }

        fetch(`/api/notes/book/${bookId}/clear`, {
            method: 'DELETE',
            credentials: 'same-origin'
        })
            .then(response => {
                if (response.ok) {

                    notesList.innerHTML = '';
                    notesCache = [];
                    alert("All notes have been successfully deleted.");
                } else {
                    console.error('Failed to clear notes');
                    alert("There was an error deleting notes");
                }
            })
            .catch(error => {
                console.error('Error clearing notes:', error);
                alert("There was an error deleting notes");
            });
    });


    colorPreview.addEventListener("click", function () {
        colorInput.click();
    });

    colorInput.addEventListener("input", function () {
        colorPreview.style.backgroundColor = colorInput.value;
    });


    colorPreview.style.backgroundColor = colorInput.value;


    noteTitleInput.addEventListener("focus", function () {
        if (!selectedText || selectedText.length < MIN_NOTE_TEXT_LENGTH) {
            alert(`First select the text (minimum ${MIN_NOTE_TEXT_LENGTH} characters) before entering the name!`);
        }
    });


    notesPanel.addEventListener("wheel", function (event) {
        if (notesPanel.scrollHeight > notesPanel.clientHeight) {
            event.preventDefault();
            notesPanel.scrollBy({top: event.deltaY, behavior: "smooth"});
        }
    }, {passive: false});




    window.highlightNote = function (page) {
        const reader = document.getElementById("reader");
        if (!reader) {
            console.error("Error: Element reader not found!");
            return;
        }


        const savedText = localStorage.getItem("highlightFragment");
        if (!savedText) {
            console.warn("Highlight text not found");
            return;
        }


        const currentUrl = new URL(window.location.href);
        const isTwoPageMode = currentUrl.searchParams.get("twoPageMode") === "true";
        const currentPage = parseInt(document.getElementById("pageInput").value);


        if (isTwoPageMode && currentPage === 0) {

            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("page", page.toString());


            if (typeof loadPage === "function") {
                loadPage(newUrl.toString()).then(() => {

                    setTimeout(() => highlightNote(page), 300);
                });
                return;
            } else {

                window.location.href = newUrl.toString();
                return;
            }
        }


        reader.querySelectorAll(".highlight").forEach(el => {
            const parent = el.parentNode;
            while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
        });


        const paragraphs = savedText.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);


        const fullText = reader.textContent;
        const lowerFullText = fullText.toLowerCase();


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


        if (occurrences.length === 0) {
            console.warn("The text of the note was not found on this page, searching in cache...");


            const noteMatch = notesCache.find(note => {
                return note.text.includes(savedText) || savedText.includes(note.text);
            });

            if (noteMatch && noteMatch.page !== currentPage) {
                console.log("Match found in cache, redirecting to page", noteMatch.page);
                navigateToNote(noteMatch.page, noteMatch.text);
                return;
            }


            console.log("Checking the adjacent pages...");


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


                    const cleanContent = pageContent.toLowerCase();
                    const cleanNoteText = noteText.toLowerCase();

                    if (cleanContent.includes(cleanNoteText)) {
                        if (confirm(`The text of the note was found on the page ${nearbyPage}. Go?`)) {
                            loadPage(nearbyUrl.toString()).then(() => {
                                setTimeout(() => highlightNote(nearbyPage, noteText), 300);
                            });
                            return true;
                        }
                    }
                    return false;
                } catch (error) {
                    console.error("Error checking adjacent page:", error);
                    return false;
                }
            };


            checkNearbyPage(currentPage + 1).then(found => {
                if (!found) {
                    checkNearbyPage(currentPage - 1);
                }
            });



            if (page !== currentPage) {
                const bookId = window.location.pathname.split("/")[2];
                const newUrl = new URL(`/book/${bookId}`, window.location.origin);
                newUrl.searchParams.set("page", page.toString());
                newUrl.searchParams.set("twoPageMode", isTwoPageMode.toString());
                newUrl.searchParams.set("wordsPerScreen",
                    currentUrl.searchParams.get("wordsPerScreen") || "1500");


                if (typeof loadPage === "function") {
                    loadPage(newUrl.toString()).then(() => {

                        setTimeout(() => highlightNote(page), 300);
                    });
                } else {
                    window.location.href = newUrl.toString();
                }
            }
            return;
        }


        occurrences.sort((a, b) => a.start - b.start);


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


        const firstHighlight = reader.querySelector(".highlight");
        if (firstHighlight) {
            setTimeout(() => {
                firstHighlight.scrollIntoView({behavior: "smooth", block: "center"});
            }, 200);
        }
    };


    loadNotes();
});