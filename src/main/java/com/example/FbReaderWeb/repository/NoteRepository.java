package com.example.FbReaderWeb.repository;

import com.example.FbReaderWeb.model.Note;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {
    List<Note> findByEbookIdOrderByPageAsc(Long ebookId);
}