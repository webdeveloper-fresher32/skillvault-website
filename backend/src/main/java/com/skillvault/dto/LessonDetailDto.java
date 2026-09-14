package com.skillvault.dto;

import java.util.List;

public class LessonDetailDto {
    private Long id;
    private String title;
    private String slug;
    private String courseSlug;
    private String courseTitle;
    private String moduleTitle;
    private Integer sortOrder;
    private Integer estimatedMinutes;
    private String markdownContent;
    private String overviewContent;
    private List<SubtopicSectionDto> subtopics;
    private boolean completed;
    private boolean bookmarked;
    private String prevLessonSlug;
    private String nextLessonSlug;

    public LessonDetailDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getCourseSlug() { return courseSlug; }
    public void setCourseSlug(String courseSlug) { this.courseSlug = courseSlug; }
    public String getCourseTitle() { return courseTitle; }
    public void setCourseTitle(String courseTitle) { this.courseTitle = courseTitle; }
    public String getModuleTitle() { return moduleTitle; }
    public void setModuleTitle(String moduleTitle) { this.moduleTitle = moduleTitle; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public Integer getEstimatedMinutes() { return estimatedMinutes; }
    public void setEstimatedMinutes(Integer estimatedMinutes) { this.estimatedMinutes = estimatedMinutes; }
    public String getMarkdownContent() { return markdownContent; }
    public void setMarkdownContent(String markdownContent) { this.markdownContent = markdownContent; }
    public String getOverviewContent() { return overviewContent; }
    public void setOverviewContent(String overviewContent) { this.overviewContent = overviewContent; }
    public List<SubtopicSectionDto> getSubtopics() { return subtopics; }
    public void setSubtopics(List<SubtopicSectionDto> subtopics) { this.subtopics = subtopics; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public boolean isBookmarked() { return bookmarked; }
    public void setBookmarked(boolean bookmarked) { this.bookmarked = bookmarked; }
    public String getPrevLessonSlug() { return prevLessonSlug; }
    public void setPrevLessonSlug(String prevLessonSlug) { this.prevLessonSlug = prevLessonSlug; }
    public String getNextLessonSlug() { return nextLessonSlug; }
    public void setNextLessonSlug(String nextLessonSlug) { this.nextLessonSlug = nextLessonSlug; }
}
