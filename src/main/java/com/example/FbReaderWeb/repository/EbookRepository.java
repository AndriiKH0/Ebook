package com.example.FbReaderWeb.repository;

import com.example.FbReaderWeb.model.Ebook;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

@Repository
public interface EbookRepository extends JpaRepository<Ebook, Long> {
    Optional<Ebook> findByIdAndUserUsername(Long id, String username);

    List<Ebook> findByTitleContainingIgnoreCase(String title);


    List<Ebook> findByAuthorContainingIgnoreCase(String author);
    List<Ebook> findByUserUsernameOrderByTitleAsc(String username);
    List<Ebook> findByUserUsernameOrderByCreatedAtDesc(String username);
    List<Ebook> findByUserUsernameOrderByAuthorAsc(String username);

    @Query("SELECT e FROM Ebook e JOIN e.genres g WHERE LOWER(g) LIKE LOWER(CONCAT('%', :genre, '%')) AND e.user.username = :username")
    List<Ebook> findByUserAndGenreContainingIgnoreCase(@Param("username") String username, @Param("genre") String genre);


    @Query("SELECT e FROM Ebook e WHERE LOWER(e.title) LIKE LOWER(CONCAT('%', :title, '%')) AND e.user.username = :username")
    List<Ebook> findByUserAndTitleContainingIgnoreCase(@Param("username") String username, @Param("title") String title);


    @Query("SELECT e FROM Ebook e WHERE LOWER(e.author) LIKE LOWER(CONCAT('%', :author, '%')) AND e.user.username = :username")
    List<Ebook> findByUserAndAuthorContainingIgnoreCase(@Param("username") String username, @Param("author") String author);


    List<Ebook> findByUserUsername(String username);

}
