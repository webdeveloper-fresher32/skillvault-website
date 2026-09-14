package com.skillvault.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "lessons")
public class Lesson {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String slug;

    @Column(nullable = false)
    private String filePath;

    private Integer sortOrder = 0;
    private Integer estimatedMinutes = 15;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "module_id")
    @JsonIgnore
    private CourseModule module;

    public Lesson() {}

    public Lesson(String title, String slug, String filePath, Integer sortOrder, Integer estimatedMinutes, CourseModule module) {
        this.title = title;
        this.slug = slug;
        this.filePath = filePath;
        this.sortOrder = sortOrder;
        this.estimatedMinutes = estimatedMinutes;
        this.module = module;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public Integer getEstimatedMinutes() { return estimatedMinutes; }
    public void setEstimatedMinutes(Integer estimatedMinutes) { this.estimatedMinutes = estimatedMinutes; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public CourseModule getModule() { return module; }
    public void setModule(CourseModule module) { this.module = module; }
}
