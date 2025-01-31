package com.example.FbReaderWeb.repository;

import com.example.FbReaderWeb.model.Ebook;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;

@Repository
public interface EbookRepository extends JpaRepository<Ebook, Long> {

    // Поиск по названию (не чувствителен к регистру)
    List<Ebook> findByTitleContainingIgnoreCase(String title);

    // Поиск по автору (не чувствителен к регистру)
    List<Ebook> findByAuthorContainingIgnoreCase(String author);

    // Кастомный запрос для поиска по жанру
    @Query("SELECT e FROM Ebook e JOIN e.genres g WHERE LOWER(g) LIKE LOWER(CONCAT('%', :genre, '%')) AND e.user.username = :username")
    List<Ebook> findByUserAndGenreContainingIgnoreCase(@Param("username") String username, @Param("genre") String genre);

    // Поиск по названию книги для конкретного пользователя
    @Query("SELECT e FROM Ebook e WHERE LOWER(e.title) LIKE LOWER(CONCAT('%', :title, '%')) AND e.user.username = :username")
    List<Ebook> findByUserAndTitleContainingIgnoreCase(@Param("username") String username, @Param("title") String title);

    // Поиск по автору книги для конкретного пользователя
    @Query("SELECT e FROM Ebook e WHERE LOWER(e.author) LIKE LOWER(CONCAT('%', :author, '%')) AND e.user.username = :username")
    List<Ebook> findByUserAndAuthorContainingIgnoreCase(@Param("username") String username, @Param("author") String author);

    // Поиск всех книг конкретного пользователя
    List<Ebook> findByUserUsername(String username);

}
