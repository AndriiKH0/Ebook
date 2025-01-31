package com.example.FbReaderWeb.model;

import jakarta.persistence.ElementCollection;
import jakarta.persistence.Column;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.*;

@Entity
public class Ebook {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }


    private String title;
    private String author;

    @Lob
    private String content;

    @Column
    @ElementCollection(fetch = FetchType.EAGER) // Убедитесь, что здесь используется EAGER для загрузки коллекции.
    private List<String> genres = new ArrayList<>();

    public Ebook() {}

    public Ebook(String title, String author, String content) {
        this.title = title;
        this.author = author;
        this.content = content;
    }

    // Геттеры и сеттеры
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public List<String> getGenres() {
        return genres;
    }

    public void setGenres(List<String> genres) {
        this.genres = genres;
    }
}
