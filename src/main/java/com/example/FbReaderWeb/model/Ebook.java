package com.example.FbReaderWeb.model;

import jakarta.persistence.ElementCollection;
import jakarta.persistence.Column;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import jakarta.persistence.*;

@Entity
public class Ebook {
    @Column(name = "last_page", nullable = false)
    private int lastPage = 1;
    @Column(name = "book_theme")
    private String bookTheme;

    public String getBookTheme() {
        return bookTheme;
    }

    public void setBookTheme(String bookTheme) {
        this.bookTheme = bookTheme;
    }

    @Temporal(TemporalType.TIMESTAMP)
    @Column(nullable = true) // временно!
    private Date createdAt;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;


    @Column(name = "words_per_screen", nullable = false)
    private int wordsPerScreen = 2000;

    @Column(name = "book_font")
    private String bookFont;

    @Column(name = "book_font_size")
    private Integer bookFontSize;
    @Column(name = "book_line_height")
    private Double bookLineHeight;

    @Column(name = "two_page_mode", nullable = false)
    private boolean twoPageMode = false;


    @Column(nullable = true)
    private String coverFilename;

    @Column(columnDefinition = "TEXT")
    private String title;
    private String author;


    @Lob
    private String content;

    @Column
    @ElementCollection(fetch = FetchType.EAGER)
    private List<String> genres = new ArrayList<>();
    @PrePersist
    protected void onCreate() {
        this.createdAt = new Date();
    }
    public Ebook() {}

    public Ebook(String title, String author, String content) {
        this.title = title;
        this.author = author;
        this.content = content;
    }

    public String getBookFont() {
        return bookFont;
    }

    @OneToMany(mappedBy = "ebook", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Note> notes = new ArrayList<>();


    public List<Note> getNotes() {
        return notes;
    }

    public void setNotes(List<Note> notes) {
        this.notes = notes;
    }

    public void setBookFont(String bookFont) {
        this.bookFont = bookFont;
    }
    public Double getBookLineHeight() {
        return bookLineHeight;
    }

    public void setBookLineHeight(Double bookLineHeight) {
        this.bookLineHeight = bookLineHeight;
    }
    public Integer getBookFontSize() {
        return bookFontSize;
    }

    public void setBookFontSize(Integer bookFontSize) {
        this.bookFontSize = bookFontSize;
    }

    public int getLastPage() {
        return lastPage;
    }

    public void setLastPage(int lastPage) {
        this.lastPage = lastPage;
    }

    public boolean isTwoPageMode() {
        return twoPageMode;
    }

    public void setTwoPageMode(boolean twoPageMode) {
        this.twoPageMode = twoPageMode;
    }
    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
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

    public String getCoverFilename() {
        return coverFilename;
    }

    public void setCoverFilename(String coverFilename) {
        this.coverFilename = coverFilename;
    }

}
