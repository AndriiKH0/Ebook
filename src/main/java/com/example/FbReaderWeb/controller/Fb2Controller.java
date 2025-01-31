package com.example.FbReaderWeb.controller;

import com.example.FbReaderWeb.model.Ebook;
import com.example.FbReaderWeb.service.Fb2Service;
import com.example.FbReaderWeb.repository.EbookRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Controller
public class Fb2Controller {

    private final Fb2Service fb2Service;
    private final EbookRepository ebookRepository;

    @Autowired
    public Fb2Controller(Fb2Service fb2Service, EbookRepository ebookRepository) {
        this.fb2Service = fb2Service;
        this.ebookRepository = ebookRepository;
    }

    // Главная страница загрузки
    @GetMapping("/")
    public String home() {
        return "upload"; // Возвращаем HTML-шаблон upload.html
    }

    // Загрузка файла
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

    // Библиотека книг
    @GetMapping("/library")
    public String viewLibrary(Principal principal, Model model) {
        List<Ebook> ebooks = ebookRepository.findByUserUsername(principal.getName());
        model.addAttribute("ebooks", ebooks);
        return "library";
    }

    // Просмотр книги
    @GetMapping("/book/{id}")
    public String viewBook(@PathVariable Long id,
                           @RequestParam(value = "page", defaultValue = "1") int page,
                           Model model) {
        var ebookOptional = ebookRepository.findById(id);
        if (ebookOptional.isPresent()) {
            Ebook book = ebookOptional.get();

            // Лимит для одной колонки
            int targetWordCount = 3000; // Желаемое количество слов на странице

            List<String> pages = fb2Service.paginateContent(book.getContent(), targetWordCount);
            String currentPageContent = (page - 1 < pages.size()) ? pages.get(page - 1) : "";
            int wordCount = fb2Service.countWords(currentPageContent);

            model.addAttribute("pageContent", currentPageContent);
            model.addAttribute("wordCount", wordCount); // Передаём количество слов в шаблон
            model.addAttribute("totalPages", pages.size());
            model.addAttribute("currentPage", page);
            model.addAttribute("hasPrevious", page > 1);
            model.addAttribute("hasNext", page < pages.size());

            model.addAttribute("ebook", book);


            // Преобразование totalPages в int


            return "book";
        } else {
            model.addAttribute("error", "Книга не найдена.");
            return "library";
        }
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
