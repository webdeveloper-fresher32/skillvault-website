package com.skillvault.dto;

public record InterviewGuideDto(
    Long id,
    String title,
    String lessonSlug,
    String courseSlug,
    String courseTitle,
    String category,
    String courseIcon,
    Integer estimatedMinutes,
    String summary,
    String url
) {}
