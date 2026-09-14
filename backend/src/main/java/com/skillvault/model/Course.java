package com.skillvault.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "courses")
public class Course {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String category;
    private String level;
    private String icon;
    private Integer totalLessons = 0;
    private Integer estimatedHours = 20;

    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<CourseModule> modules = new ArrayList<>();

    public Course() {}

    public Course(String slug, String title, String description, String category, String level, String icon) {
        this.slug = slug;
        this.title = title;
        this.description = description;
        this.category = category;
        this.level = level;
        this.icon = icon;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public Integer getTotalLessons() { return totalLessons; }
    public void setTotalLessons(Integer totalLessons) { this.totalLessons = totalLessons; }
    public Integer getEstimatedHours() { return estimatedHours; }
    public void setEstimatedHours(Integer estimatedHours) { this.estimatedHours = estimatedHours; }
    public List<CourseModule> getModules() { return modules; }
    public void setModules(List<CourseModule> modules) { this.modules = modules; }
}
