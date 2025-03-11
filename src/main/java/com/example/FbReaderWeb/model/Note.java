package com.example.FbReaderWeb.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
public class Note {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "ebook_id")
    @JsonIgnore
    private Ebook ebook;

    @Column(nullable = false, length = 5000)
    private String text;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String color;

    @Column(nullable = false)
    private Integer page;

    @Column(nullable = false)
    private Integer totalPages;

    @Column(nullable = true)
    private Boolean twoPageMode;

    @Column(nullable = true)
    private Integer wordsPerScreen;

    // Новые поля для улучшенной навигации
    @Column(length = 100, nullable = true)
    private String textSignature;

    @Column(length = 2000, nullable = true)
    private String contextBefore;

    @Column(length = 2000, nullable = true)
    private String contextAfter;

    @Column(nullable = true)
    private Integer absolutePosition;

    // Позиция в книге (от 0.0 до 1.0) - полезно для точного позиционирования
    @Column(nullable = true)
    private Double position;

    // Геттеры и сеттеры для новых полей
    public String getTextSignature() {
        return textSignature;
    }

    public void setTextSignature(String textSignature) {
        this.textSignature = textSignature;
    }

    public String getContextBefore() {
        return contextBefore;
    }

    public void setContextBefore(String contextBefore) {
        this.contextBefore = contextBefore;
    }

    public String getContextAfter() {
        return contextAfter;
    }

    public void setContextAfter(String contextAfter) {
        this.contextAfter = contextAfter;
    }

    public Integer getAbsolutePosition() {
        return absolutePosition;
    }

    public void setAbsolutePosition(Integer absolutePosition) {
        this.absolutePosition = absolutePosition;
    }

    // Существующие геттеры и сеттеры
    public Boolean getTwoPageMode() {
        return twoPageMode;
    }

    public void setTwoPageMode(Boolean twoPageMode) {
        this.twoPageMode = twoPageMode;
    }

    public Integer getWordsPerScreen() {
        return wordsPerScreen;
    }

    public void setWordsPerScreen(Integer wordsPerScreen) {
        this.wordsPerScreen = wordsPerScreen;
    }

    public Double getPosition() {
        return position;
    }

    public void setPosition(Double position) {
        this.position = position;
    }

    public Integer getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(Integer totalPages) {
        this.totalPages = totalPages;
    }

    // Геттеры
    public Long getId() {
        return id;
    }

    public Ebook getEbook() {
        return ebook;
    }

    public String getText() {
        return text;
    }

    public String getTitle() {
        return title;
    }

    public String getColor() {
        return color;
    }

    public Integer getPage() {
        return page;
    }

    // Сеттеры
    public void setId(Long id) {
        this.id = id;
    }

    public void setEbook(Ebook ebook) {
        this.ebook = ebook;
    }

    public void setText(String text) {
        this.text = text;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public void setPage(Integer page) {
        this.page = page;
    }
}