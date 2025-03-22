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

    private static final int MIN_NOTE_LENGTH = 30;
    private static final int MAX_CONTEXT_LENGTH = 100;

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


            if (text.length() < MIN_NOTE_LENGTH) {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "The text of the note should contain a minimum of " + MIN_NOTE_LENGTH + " symbols")
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

            note.setTextSignature(generateTextSignature(text));

            setNoteContext(note, ebook.getContent(), text);


            note.setPosition((double) page / totalPages);

            Note savedNote = noteRepository.save(note);


            return ResponseEntity.ok(savedNote);
        }


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


            List<String> currentPages = fb2Service.paginateContent(ebook.getContent(), wordsPerScreen, twoPageMode);
            int currentTotalPages = twoPageMode ? currentPages.size() + 1 : currentPages.size();

            List<Note> notes = noteRepository.findByEbookIdOrderByPageAsc(bookId);

            notes = notes.stream()
                    .map(note -> {

                        int foundPage = fb2Service.findPageByTextFragmentInRange(
                                ebook.getContent(),
                                note.getText(),
                                wordsPerScreen,
                                twoPageMode,
                                note.getPage(),
                                1
                        );

                        if (foundPage != -1) {
                            note.setPage(foundPage);
                        } else {

                            note = recalculateNotePageProportionally(note, currentTotalPages, twoPageMode);
                        }

                        return note;
                    })
                    .collect(Collectors.toList());

            return ResponseEntity.ok(notes);
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }


    private void setNoteContext(Note note, String bookContent, String noteText) {

        String plainBookContent = bookContent.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();
        String plainNoteText = noteText.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        int notePosition = plainBookContent.indexOf(plainNoteText);
        if (notePosition >= 0) {

            note.setAbsolutePosition(notePosition);


            int beforeStart = Math.max(0, notePosition - MAX_CONTEXT_LENGTH);
            note.setContextBefore(plainBookContent.substring(beforeStart, notePosition));


            int afterEnd = Math.min(plainBookContent.length(),
                    notePosition + plainNoteText.length() + MAX_CONTEXT_LENGTH);
            note.setContextAfter(plainBookContent.substring(
                    notePosition + plainNoteText.length(), afterEnd));
        }
    }

    private String generateTextSignature(String text) {
        try {

            String normalizedText = text.replaceAll("<[^>]+>", " ")
                    .replaceAll("\\s+", " ")
                    .trim()
                    .toLowerCase();


            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hashBytes = md.digest(normalizedText.getBytes(StandardCharsets.UTF_8));


            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {

            return String.valueOf(text.hashCode());
        }
    }


    private Note recalculateNotePageProportionally(Note note, int currentTotalPages, boolean twoPageMode) {
        int originalPage = note.getPage();
        int originalTotalPages = note.getTotalPages();


        double position = (double) originalPage / originalTotalPages;
        int adjustedPage = (int) Math.round(position * currentTotalPages);


        if (twoPageMode && adjustedPage == 0) {
            adjustedPage = 0;
        } else if (!twoPageMode && adjustedPage == 0) {
            adjustedPage = 1;
        }


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
            if (note.getEbook().getUser().getUsername().equals(principal.getName())) {
                noteRepository.delete(note);
                return ResponseEntity.ok().build();
            }
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
}