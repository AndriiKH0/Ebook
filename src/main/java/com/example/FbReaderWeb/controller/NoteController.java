package com.example.FbReaderWeb.controller;

import com.example.FbReaderWeb.model.Ebook;
import com.example.FbReaderWeb.model.Note;
import com.example.FbReaderWeb.repository.EbookRepository;
import com.example.FbReaderWeb.repository.NoteRepository;
import com.example.FbReaderWeb.service.Fb2Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.*;
import java.util.stream.Collectors;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    @Autowired
    private NoteRepository noteRepository;
    @Autowired
    private EbookRepository ebookRepository;
    @Autowired
    private Fb2Service fb2Service;

    private static final int MIN_NOTE_LENGTH = 30; // Минимальная длина заметки
    private static final int MAX_CONTEXT_LENGTH = 100; // Длина контекста до/после заметки

    public NoteController() {
        System.out.println("NoteController instantiated");
    }

    @PostMapping("/save")
    public ResponseEntity<?> saveNote(
            @RequestParam Long bookId,
            @RequestParam String text,
            @RequestParam String title,
            @RequestParam String color,
            @RequestParam Integer page,
            @RequestParam Integer totalPages,
            @RequestParam Integer wordsPerScreen,
            @RequestParam(required = false) Boolean twoPageMode,
            Principal principal
    ) {
        Optional<Ebook> ebookOptional = ebookRepository.findByIdAndUserUsername(bookId, principal.getName());

        if (ebookOptional.isPresent()) {
            Ebook ebook = ebookOptional.get();

            // Проверка минимальной длины текста заметки
            if (text.length() < MIN_NOTE_LENGTH) {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "Текст заметки должен содержать минимум " + MIN_NOTE_LENGTH + " символов")
                );
            }

            Note note = new Note();
            note.setEbook(ebook);
            note.setText(text);
            note.setTitle(title);
            note.setColor(color);
            note.setPage(page);
            note.setTotalPages(totalPages);
            note.setWordsPerScreen(wordsPerScreen);
            note.setTwoPageMode(twoPageMode);

            // Генерируем уникальную сигнатуру текста
            note.setTextSignature(generateTextSignature(text));

            // Ищем контекст заметки в книге
            setNoteContext(note, ebook.getContent(), text);

            // Вычисляем относительную позицию заметки в книге
            note.setPosition((double) page / totalPages);

            Note savedNote = noteRepository.save(note);

            // Возвращаем полную информацию о заметке
            return ResponseEntity.ok(savedNote);
        }

        // Возвращаем 401 (Unauthorized), если книга не найдена
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    @GetMapping("/book/{bookId}")
    public ResponseEntity<List<Note>> getNotes(
            @PathVariable Long bookId,
            @RequestParam(value = "twoPageMode", defaultValue = "false") boolean twoPageMode,
            @RequestParam(value = "wordsPerScreen", defaultValue = "1500") int wordsPerScreen,
            Principal principal
    ) {
        Optional<Ebook> ebookOptional = ebookRepository.findByIdAndUserUsername(bookId, principal.getName());

        if (ebookOptional.isPresent()) {
            Ebook ebook = ebookOptional.get();
            String ebookContent = ebook.getContent();

            // Получаем страницы в текущем режиме
            List<String> currentPages = fb2Service.paginateContent(ebook.getContent(), wordsPerScreen, twoPageMode);
            int currentTotalPages = twoPageMode ? currentPages.size() + 1 : currentPages.size();

            List<Note> notes = noteRepository.findByEbookIdOrderByPageAsc(bookId);

            notes = notes.stream()
                    .map(note -> {
                        // Здесь сейчас использовался поиск по точному тексту
                        // Заменяем его на поиск с проверкой соседних страниц
                        int foundPage = fb2Service.findPageByTextFragmentInRange(
                                ebook.getContent(),
                                note.getText(),
                                wordsPerScreen,
                                twoPageMode,
                                note.getPage(), // Целевая страница
                                1              // Диапазон поиска (±1 страница)
                        );

                        if (foundPage != -1) {
                            note.setPage(foundPage);
                        } else {
                            // Если поиск не удался, используем пропорциональный пересчет
                            note = recalculateNotePageProportionally(note, currentTotalPages, twoPageMode);
                        }

                        return note;
                    })
                    .collect(Collectors.toList());

            return ResponseEntity.ok(notes);
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    /**
     * Пытается найти страницу заметки по тексту
     */
    private int findNotePageByText(String noteText, List<String> pages) {
        if (noteText == null || noteText.length() < MIN_NOTE_LENGTH) {
            return -1;
        }

        // Для более надежного поиска очищаем HTML и используем нормализацию
        String searchText = noteText.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        // Берем подходящую длину текста для поиска
        int searchLength = Math.min(Math.max(MIN_NOTE_LENGTH, searchText.length() / 3), 200);
        String searchFragment = searchText.substring(0, searchLength);

        for (int i = 0; i < pages.size(); i++) {
            String pageContent = pages.get(i).replaceAll("<[^>]+>", " ")
                    .replaceAll("\\s+", " ")
                    .trim();

            if (pageContent.contains(searchFragment)) {
                return i + 1; // +1 потому что страницы начинаются с 1
            }
        }

        return -1; // Не нашли
    }

    /**
     * Ищет страницу заметки с использованием контекста до и после
     */
    private int findNotePageByContext(Note note, List<String> pages) {
        if (note.getContextBefore() == null || note.getContextAfter() == null) {
            return -1;
        }

        // Очищаем HTML в контексте
        String beforeContext = note.getContextBefore().replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();
        String afterContext = note.getContextAfter().replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        // Берем последние слова из контекста "до"
        String[] beforeWords = beforeContext.split("\\s+");
        String beforeFragment = "";
        if (beforeWords.length >= 5) {
            beforeFragment = String.join(" ", Arrays.copyOfRange(beforeWords,
                    beforeWords.length - 5, beforeWords.length));
        } else {
            beforeFragment = beforeContext;
        }

        // Берем первые слова из контекста "после"
        String[] afterWords = afterContext.split("\\s+");
        String afterFragment = "";
        if (afterWords.length >= 5) {
            afterFragment = String.join(" ", Arrays.copyOfRange(afterWords, 0, 5));
        } else {
            afterFragment = afterContext;
        }

        for (int i = 0; i < pages.size(); i++) {
            String pageContent = pages.get(i).replaceAll("<[^>]+>", " ")
                    .replaceAll("\\s+", " ")
                    .trim();

            if (pageContent.contains(beforeFragment) && pageContent.contains(afterFragment)) {
                return i + 1;
            }
        }

        return -1;
    }

    /**
     * Устанавливает контекст для заметки (текст до и после)
     */
    private void setNoteContext(Note note, String bookContent, String noteText) {
        // Очищаем HTML-теги из текста книги и заметки
        String plainBookContent = bookContent.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();
        String plainNoteText = noteText.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        int notePosition = plainBookContent.indexOf(plainNoteText);
        if (notePosition >= 0) {
            // Сохраняем абсолютную позицию
            note.setAbsolutePosition(notePosition);

            // Сохраняем контекст до заметки
            int beforeStart = Math.max(0, notePosition - MAX_CONTEXT_LENGTH);
            note.setContextBefore(plainBookContent.substring(beforeStart, notePosition));

            // Сохраняем контекст после заметки
            int afterEnd = Math.min(plainBookContent.length(),
                    notePosition + plainNoteText.length() + MAX_CONTEXT_LENGTH);
            note.setContextAfter(plainBookContent.substring(
                    notePosition + plainNoteText.length(), afterEnd));
        }
    }

    /**
     * Генерирует уникальную сигнатуру текста заметки
     */
    private String generateTextSignature(String text) {
        try {
            // Очищаем HTML и нормализуем текст
            String normalizedText = text.replaceAll("<[^>]+>", " ")
                    .replaceAll("\\s+", " ")
                    .trim()
                    .toLowerCase();

            // Создаем MD5 хеш
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hashBytes = md.digest(normalizedText.getBytes(StandardCharsets.UTF_8));

            // Преобразуем в hex-строку
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // Если MD5 недоступен, просто используем хеш
            return String.valueOf(text.hashCode());
        }
    }

    // Вспомогательный метод для пропорционального пересчета
    private Note recalculateNotePageProportionally(Note note, int currentTotalPages, boolean twoPageMode) {
        int originalPage = note.getPage();
        int originalTotalPages = note.getTotalPages();

        // Простая пропорция
        double position = (double) originalPage / originalTotalPages;
        int adjustedPage = (int) Math.round(position * currentTotalPages);

        // Обрабатываем особые случаи
        if (twoPageMode && adjustedPage == 0) {
            adjustedPage = 0; // Обложка в двухстраничном режиме
        } else if (!twoPageMode && adjustedPage == 0) {
            adjustedPage = 1; // В одностраничном режиме нет страницы 0
        }

        // Проверяем диапазон
        adjustedPage = Math.max(twoPageMode ? 0 : 1,
                Math.min(adjustedPage, currentTotalPages - 1));

        note.setPage(adjustedPage);
        return note;
    }

    @DeleteMapping("/book/{bookId}/clear")
    public ResponseEntity<Void> clearNotes(
            @PathVariable Long bookId,
            Principal principal
    ) {
        Optional<Ebook> ebookOptional = ebookRepository.findByIdAndUserUsername(bookId, principal.getName());

        if (ebookOptional.isPresent()) {
            // Находим и удаляем все заметки для этой книги
            List<Note> notes = noteRepository.findByEbookIdOrderByPageAsc(bookId);
            noteRepository.deleteAll(notes);

            return ResponseEntity.ok().build();
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    @DeleteMapping("/{noteId}")
    public ResponseEntity<Void> deleteNote(
            @PathVariable Long noteId,
            Principal principal
    ) {
        Optional<Note> noteOptional = noteRepository.findById(noteId);

        if (noteOptional.isPresent()) {
            Note note = noteOptional.get();
            // Проверяем, принадлежит ли заметка текущему пользователю
            if (note.getEbook().getUser().getUsername().equals(principal.getName())) {
                noteRepository.delete(note);
                return ResponseEntity.ok().build();
            }
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
}