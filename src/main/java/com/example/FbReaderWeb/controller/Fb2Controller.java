package com.example.FbReaderWeb.controller;

import com.example.FbReaderWeb.model.Ebook;
import com.example.FbReaderWeb.model.User;
import com.example.FbReaderWeb.repository.UserRepository;
import com.example.FbReaderWeb.service.Fb2Service;
import com.example.FbReaderWeb.repository.EbookRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Controller
public class Fb2Controller {

    private final Fb2Service fb2Service;
    private final EbookRepository ebookRepository;
    private final UserRepository userRepository;
    @Autowired
    public Fb2Controller(Fb2Service fb2Service, EbookRepository ebookRepository, UserRepository userRepository) {
        this.fb2Service = fb2Service;
        this.ebookRepository = ebookRepository;
        this.userRepository = userRepository;
    }


    @GetMapping("/")
    public String home() {
        return "upload";
    }


    @PostMapping("/upload")
    public String uploadFile(@RequestParam("file") MultipartFile file, Principal principal) {
        try {
            fb2Service.processFb2File(file, principal.getName());
            return "redirect:/library";
        } catch (Exception e) {
            e.printStackTrace();
            return "redirect:/?error=Ошибка при загрузке файла";
        }
    }


    @GetMapping("/library")
    public String viewLibrary(Principal principal, Model model) {
        List<Ebook> ebooks = ebookRepository.findByUserUsername(principal.getName());
        model.addAttribute("ebooks", ebooks);
        return "library";
    }
    private int getTotalPages(String content, int wordsPerScreen, boolean twoPageMode) {
        List<String> pages = twoPageMode
                ? fb2Service.paginateTwoPageMode(content, wordsPerScreen)
                : fb2Service.paginateContent(content, wordsPerScreen,twoPageMode);
        return pages.size();
    }
    @PostMapping("/setBookTwoPageMode")
    @Transactional
    public ResponseEntity<Void> setBookTwoPageMode(
            @RequestParam("bookId") Long bookId,
            @RequestParam("twoPageMode") boolean twoPageMode,
            Principal principal
    ) {
        Optional<Ebook> ebookOptional = ebookRepository.findByIdAndUserUsername(bookId, principal.getName());

        if (ebookOptional.isPresent()) {
            Ebook ebook = ebookOptional.get();
            ebook.setTwoPageMode(twoPageMode);
            ebookRepository.save(ebook);
            return ResponseEntity.ok().build();
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    @PostMapping("/setBookLineHeight")
    @Transactional
    public ResponseEntity<Void> setBookLineHeight(
            @RequestParam("bookId") Long bookId,
            @RequestParam("lineHeight") Double lineHeight,
            Principal principal
    ) {
        Optional<Ebook> ebookOptional = ebookRepository.findByIdAndUserUsername(bookId, principal.getName());

        if (ebookOptional.isPresent()) {
            Ebook ebook = ebookOptional.get();
            ebook.setBookLineHeight(lineHeight);
            ebookRepository.save(ebook);
            return ResponseEntity.ok().build();
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    @PostMapping("/setBookFontSize")
    @Transactional
    public ResponseEntity<Void> setBookFontSize(
            @RequestParam("bookId") Long bookId,
            @RequestParam("fontSize") Integer fontSize,
            Principal principal
    ) {
        Optional<Ebook> ebookOptional = ebookRepository.findByIdAndUserUsername(bookId, principal.getName());

        if (ebookOptional.isPresent()) {
            Ebook ebook = ebookOptional.get();
            ebook.setBookFontSize(fontSize);
            ebookRepository.save(ebook);
            return ResponseEntity.ok().build();
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    @PostMapping("/setBookFont")
    @Transactional
    public ResponseEntity<Void> setBookFont(
            @RequestParam("bookId") Long bookId,
            @RequestParam("font") String font,
            Principal principal
    ) {
        Optional<Ebook> ebookOptional = ebookRepository.findByIdAndUserUsername(bookId, principal.getName());

        if (ebookOptional.isPresent()) {
            Ebook ebook = ebookOptional.get();
            ebook.setBookFont(font);
            ebookRepository.save(ebook);
            return ResponseEntity.ok().build();
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    @PostMapping("/setBookTheme")
    @Transactional
    public ResponseEntity<Void> setBookTheme(
            @RequestParam("bookId") Long bookId,
            @RequestParam("theme") String theme,
            Principal principal
    ) {
        Optional<Ebook> ebookOptional = ebookRepository.findByIdAndUserUsername(bookId, principal.getName());

        if (ebookOptional.isPresent()) {
            Ebook ebook = ebookOptional.get();
            ebook.setBookTheme(theme);
            ebookRepository.save(ebook);
            return ResponseEntity.ok().build();
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    @GetMapping("/book/{id}")
    public String viewBook(@PathVariable Long id,
                           @RequestParam(value = "page", required = false) Integer page,
                           @RequestParam(value = "twoPageMode", defaultValue = "false") boolean twoPageMode,
                           @RequestParam(value = "wordsPerScreen", defaultValue = "1500") int wordsPerScreen,
                           Principal principal,
                           Model model) {
        int correctWordsPerScreen = twoPageMode ? 750 : 1500;

        var ebookOptional = ebookRepository.findByIdAndUserUsername(id, principal.getName());
        if (ebookOptional.isPresent()) {
            Ebook book = ebookOptional.get();
            int savedPage = book.getLastPage();

            // Если параметр page не задан, используем сохранённое значение
            boolean finalTwoPageMode = twoPageMode || book.isTwoPageMode();
            if (page == null || wordsPerScreen != correctWordsPerScreen) {
                return "redirect:/book/" + id
                        + "?page=" + savedPage
                        + "&twoPageMode=" + finalTwoPageMode
                        + "&wordsPerScreen=" + correctWordsPerScreen;
            }

            // Устанавливаем тему книги, по умолчанию "original"
            String bookTheme = book.getBookTheme() != null ? book.getBookTheme() : "original";
            model.addAttribute("bookTheme", bookTheme);

            String bookFont = book.getBookFont() != null ? book.getBookFont() : "Georgia";
            model.addAttribute("bookFont", bookFont);

            Integer bookFontSize = book.getBookFontSize();
            if (bookFontSize == null || bookFontSize < 12 || bookFontSize > 32) {
                bookFontSize = 16; // Значение по умолчанию
                book.setBookFontSize(bookFontSize);
                ebookRepository.save(book);
            }
            model.addAttribute("bookFontSize", bookFontSize);
            Double bookLineHeight = book.getBookLineHeight();
            if (bookLineHeight == null || bookLineHeight < 1.0 || bookLineHeight > 3.0) {
                bookLineHeight = 1.5; // Значение по умолчанию
                book.setBookLineHeight(bookLineHeight);
                ebookRepository.save(book);
            }
            model.addAttribute("bookLineHeight", bookLineHeight);
            // Остальной код без изменений...
            if (twoPageMode && page == 0) {
                String coverContent = String.format(
                        "<div class='cover-page'>" +
                                "<img src='/images/%s' alt='Обложка' class='cover-image'>" +
                                "<h1 class='book-title'>%s</h1>" +
                                "<h2 class='book-author'>%s</h2>" +
                                "</div>",
                        book.getCoverFilename(), book.getTitle(), book.getAuthor()
                );
                model.addAttribute("twoPageMode", finalTwoPageMode);
                model.addAttribute("pageContent", coverContent);
                model.addAttribute("currentPage", 0);
                model.addAttribute("hasPrevious", false);
                model.addAttribute("hasNext", true);
                model.addAttribute("totalPages", getTotalPages(book.getContent(), wordsPerScreen, twoPageMode) + 1);
                model.addAttribute("ebook", book);
                model.addAttribute("wordsPerScreen", wordsPerScreen);
                return "book";
            }

            int effectiveWordsPerScreen =wordsPerScreen;
            List<String> pages = twoPageMode
                    ? fb2Service.paginateTwoPageMode(book.getContent(), effectiveWordsPerScreen)
                    : fb2Service.paginateContent(book.getContent(), effectiveWordsPerScreen, twoPageMode);

            if (page < 1) page = 1;
            if (page > pages.size()) page = pages.size();

            String currentPageContent = pages.get(page - 1);
            int wordCount = fb2Service.countWords(currentPageContent);
            int totalPages = twoPageMode ? pages.size() + 1 : pages.size();

            model.addAttribute("pageContent", currentPageContent);
            model.addAttribute("wordCount", wordCount);
            model.addAttribute("totalPages", totalPages);
            model.addAttribute("currentPage", page);
            model.addAttribute("hasPrevious", twoPageMode ? page > 0 : page > 1);
            model.addAttribute("hasNext", page < pages.size());
            model.addAttribute("twoPageMode", finalTwoPageMode);
            model.addAttribute("ebook", book);
            model.addAttribute("wordsPerScreen", wordsPerScreen);

            return "book";
        } else {
            model.addAttribute("error", "Книга не найдена.");
            return "library";
        }
    }





    @PostMapping("/savePage")
    @Transactional
    public ResponseEntity<Void> savePage(@RequestParam("page") int page, @RequestParam("bookId") Long bookId, Principal principal) {
        Optional<Ebook> ebookOpt = ebookRepository.findByIdAndUserUsername(bookId, principal.getName());
        if (ebookOpt.isPresent()) {
            Ebook ebook = ebookOpt.get();
            ebook.setLastPage(page);
            ebookRepository.save(ebook);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }








    // Удаление книги
    @PostMapping("/delete/{id}")
    public String deleteBook(@PathVariable Long id, Principal principal, Model model) {
        var ebookOptional = ebookRepository.findById(id);
        if (ebookOptional.isPresent()) {
            Ebook book = ebookOptional.get();
            if (!book.getUser().getUsername().equals(principal.getName())) {
                model.addAttribute("error", "Вы не можете удалить эту книгу.");
                return "library";
            }
            ebookRepository.delete(book);
        }
        return "redirect:/library";
    }

    // Редактирование книги
    @GetMapping("/edit/{id}")
    public String editBook(@PathVariable Long id, Principal principal, Model model) {
        var ebookOptional = ebookRepository.findById(id);
        if (ebookOptional.isPresent()) {
            Ebook ebook = ebookOptional.get();
            if (!ebook.getUser().getUsername().equals(principal.getName())) {
                model.addAttribute("error", "Вы не можете редактировать эту книгу.");
                return "library";
            }
            // Преобразуем genres в строку, разделённую запятыми
            String genresAsString = String.join(", ", ebook.getGenres());
            model.addAttribute("ebook", ebook);
            model.addAttribute("genresAsString", genresAsString); // Передаём строку жанров
            return "edit";
        } else {
            model.addAttribute("error", "Книга не найдена.");
            return "library";
        }
    }

    @PostMapping("/edit/{id}")
    public String saveEditedBook(@PathVariable Long id,
                                 @RequestParam("title") String title,
                                 @RequestParam("author") String author,
                                 @RequestParam("genres") String genres,
                                 Principal principal,
                                 Model model) {
        var ebookOptional = ebookRepository.findById(id);
        if (ebookOptional.isPresent()) {
            Ebook ebook = ebookOptional.get();
            if (!ebook.getUser().getUsername().equals(principal.getName())) {
                model.addAttribute("error", "Вы не можете редактировать эту книгу.");
                return "library";
            }
            ebook.setTitle(stripTags(title));
            ebook.setAuthor(stripTags(author));

            // Обновление списка жанров
            ebook.getGenres().clear(); // Очистить текущий список
            List<String> genreList = Arrays.asList(genres.split("\\s*,\\s*")); // Преобразуем строку в список
            ebook.getGenres().addAll(genreList); // Добавляем новые жанры

            ebookRepository.save(ebook);
        }
        return "redirect:/library";
    }

    // Поиск книг
    @GetMapping("/search")
    public String searchBooks(@RequestParam(value = "query", required = false) String query,
                              @RequestParam(value = "filter", required = false) String filter,
                              Principal principal,
                              Model model) {
        List<Ebook> results;
        if ("title".equalsIgnoreCase(filter)) {
            results = ebookRepository.findByUserAndTitleContainingIgnoreCase(principal.getName(), query);
        } else if ("author".equalsIgnoreCase(filter)) {
            results = ebookRepository.findByUserAndAuthorContainingIgnoreCase(principal.getName(), query);
        } else if ("genre".equalsIgnoreCase(filter)) {
            results = ebookRepository.findByUserAndGenreContainingIgnoreCase(principal.getName(), query);
        } else {
            results = new ArrayList<>(); // Пустой список, если фильтр не указан
        }

        model.addAttribute("results", results);
        model.addAttribute("query", query);
        model.addAttribute("filter", filter);
        return "search"; // Шаблон для отображения результатов
    }

    private String stripTags(String input) {
        return input.replaceAll("<[^>]+>", "").trim();
    }




}
