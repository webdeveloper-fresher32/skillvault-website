package com.skillvault.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_bookmarks")
public class Bookmark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String userIdentifier = "default-dev";
    private String courseSlug;
    private String lessonSlug;
    private String title;
    private LocalDateTime createdAt = LocalDateTime.now();

    public Bookmark() {}

    public Bookmark(String userIdentifier, String courseSlug, String lessonSlug, String title) {
        this.userIdentifier = userIdentifier;
        this.courseSlug = courseSlug;
        this.lessonSlug = lessonSlug;
        this.title = title;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUserIdentifier() { return userIdentifier; }
    public void setUserIdentifier(String userIdentifier) { this.userIdentifier = userIdentifier; }
    public String getCourseSlug() { return courseSlug; }
    public void setCourseSlug(String courseSlug) { this.courseSlug = courseSlug; }
    public String getLessonSlug() { return lessonSlug; }
    public void setLessonSlug(String lessonSlug) { this.lessonSlug = lessonSlug; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
