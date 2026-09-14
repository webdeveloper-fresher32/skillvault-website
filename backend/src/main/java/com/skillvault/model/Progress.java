package com.skillvault.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_progress", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_identifier", "lesson_id"})
})
public class Progress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_identifier", nullable = false)
    private String userIdentifier = "default-dev";

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "lesson_id", nullable = false)
    private Lesson lesson;

    @Column(name = "course_slug", nullable = false)
    private String courseSlug;

    private boolean completed = false;

    private LocalDateTime completedAt;
    private LocalDateTime lastAccessedAt = LocalDateTime.now();

    public Progress() {}

    public Progress(String userIdentifier, Lesson lesson, String courseSlug, boolean completed) {
        this.userIdentifier = userIdentifier;
        this.lesson = lesson;
        this.courseSlug = courseSlug;
        this.completed = completed;
        if (completed) {
            this.completedAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUserIdentifier() { return userIdentifier; }
    public void setUserIdentifier(String userIdentifier) { this.userIdentifier = userIdentifier; }
    public Lesson getLesson() { return lesson; }
    public void setLesson(Lesson lesson) { this.lesson = lesson; }
    public String getCourseSlug() { return courseSlug; }
    public void setCourseSlug(String courseSlug) { this.courseSlug = courseSlug; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { 
        this.completed = completed;
        if (completed && this.completedAt == null) {
            this.completedAt = LocalDateTime.now();
        }
    }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public LocalDateTime getLastAccessedAt() { return lastAccessedAt; }
    public void setLastAccessedAt(LocalDateTime lastAccessedAt) { this.lastAccessedAt = lastAccessedAt; }
}
