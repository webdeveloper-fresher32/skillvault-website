package com.skillvault.service;

import com.skillvault.dto.DashboardStatsDto;
import com.skillvault.dto.LessonDetailDto;
import com.skillvault.dto.SubtopicSectionDto;
import com.skillvault.model.Course;
import com.skillvault.model.CourseModule;
import com.skillvault.model.Lesson;
import com.skillvault.model.Progress;
import com.skillvault.repository.BookmarkRepository;
import com.skillvault.repository.CourseRepository;
import com.skillvault.repository.LessonRepository;
import com.skillvault.repository.ProgressRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CourseService {

    private final CourseRepository courseRepository;
    private final LessonRepository lessonRepository;
    private final ProgressRepository progressRepository;
    private final BookmarkRepository bookmarkRepository;

    public CourseService(CourseRepository courseRepository,
                         LessonRepository lessonRepository,
                         ProgressRepository progressRepository,
                         BookmarkRepository bookmarkRepository) {
        this.courseRepository = courseRepository;
        this.lessonRepository = lessonRepository;
        this.progressRepository = progressRepository;
        this.bookmarkRepository = bookmarkRepository;
    }

    public List<Course> getAllCourses(String category) {
        List<Course> courses;
        if (category != null && !category.isEmpty() && !"all".equalsIgnoreCase(category)) {
            courses = courseRepository.findByCategoryIgnoreCase(category);
        } else {
            courses = courseRepository.findAll();
        }
        
        return courses.stream().map(c -> {
            Course dto = new Course(c.getSlug(), c.getTitle(), c.getDescription(), c.getCategory(), c.getLevel(), c.getIcon());
            dto.setId(c.getId());
            dto.setTotalLessons(c.getTotalLessons());
            dto.setEstimatedHours(c.getEstimatedHours());
            dto.setModules(null); // Prevent N+1 lazy loading
            return dto;
        }).toList();
    }

    @Transactional(readOnly = true)
    public Optional<Course> getCourseBySlug(String slug) {
        Optional<Course> courseOpt = courseRepository.findBySlug(slug.toLowerCase());
        if (courseOpt.isPresent()) {
            Course c = courseOpt.get();
            for (CourseModule m : c.getModules()) {
                m.getLessons().size();
            }
            return Optional.of(c);
        }
        return Optional.empty();
    }

    @Transactional(readOnly = true)
    public Optional<LessonDetailDto> getLessonDetail(String courseSlug, String lessonSlug, String userIdentifier) {
        Optional<Course> courseOpt = courseRepository.findBySlug(courseSlug.toLowerCase());
        if (courseOpt.isEmpty()) {
            return Optional.empty();
        }

        Course course = courseOpt.get();
        List<Lesson> flatLessons = new ArrayList<>();
        Lesson targetLesson = null;
        String moduleTitle = "";

        for (CourseModule m : course.getModules()) {
            for (Lesson l : m.getLessons()) {
                flatLessons.add(l);
                if (l.getSlug().equalsIgnoreCase(lessonSlug)) {
                    targetLesson = l;
                    moduleTitle = m.getTitle();
                }
            }
        }

        if (targetLesson == null) {
            return Optional.empty();
        }

        // Read markdown file content
        String markdown = "";
        try {
            File mdFile = new File(targetLesson.getFilePath());
            if (mdFile.exists()) {
                markdown = Files.readString(mdFile.toPath());
            } else {
                markdown = "# " + targetLesson.getTitle() + "\n\nContent file located at `" + targetLesson.getFilePath() + "` is being prepared.";
            }
        } catch (IOException e) {
            markdown = "# " + targetLesson.getTitle() + "\n\nError reading lesson content: " + e.getMessage();
        }

        // Parse Subtopics (e.g. from "## 1. Subtopic" or "## Subtopic")
        List<SubtopicSectionDto> subtopics = new ArrayList<>();
        String overviewContent = "";

        parseSubtopics(markdown, subtopics);

        LessonDetailDto dto = new LessonDetailDto();
        dto.setId(targetLesson.getId());
        dto.setTitle(targetLesson.getTitle());
        dto.setSlug(targetLesson.getSlug());
        dto.setCourseSlug(course.getSlug());
        dto.setCourseTitle(course.getTitle());
        dto.setModuleTitle(moduleTitle);
        dto.setSortOrder(targetLesson.getSortOrder());
        dto.setEstimatedMinutes(targetLesson.getEstimatedMinutes());
        dto.setMarkdownContent(markdown);
        dto.setSubtopics(subtopics);

        // Check completion status
        Optional<Progress> progressOpt = progressRepository.findByUserIdentifierAndLessonId(userIdentifier, targetLesson.getId());
        dto.setCompleted(progressOpt.map(Progress::isCompleted).orElse(false));

        // Check bookmark
        boolean isBookmarked = bookmarkRepository.findByUserIdentifierAndCourseSlugAndLessonSlug(
                userIdentifier, course.getSlug(), targetLesson.getSlug()).isPresent();
        dto.setBookmarked(isBookmarked);

        // Prev and Next
        for (int i = 0; i < flatLessons.size(); i++) {
            if (flatLessons.get(i).getId().equals(targetLesson.getId())) {
                if (i > 0) {
                    dto.setPrevLessonSlug(flatLessons.get(i - 1).getSlug());
                }
                if (i < flatLessons.size() - 1) {
                    dto.setNextLessonSlug(flatLessons.get(i + 1).getSlug());
                }
                break;
            }
        }

        return Optional.of(dto);
    }

    private void parseSubtopics(String markdown, List<SubtopicSectionDto> subtopics) {
        if (markdown == null || markdown.isEmpty()) return;

        // Split by lines
        String[] lines = markdown.split("\\r?\\n");
        String currentSectionTitle = null;
        StringBuilder currentSectionBody = new StringBuilder();
        int sectionCounter = 0;

        for (String line : lines) {
            // Check for H2 heading: ## Section Title
            if (line.startsWith("## ") && !line.startsWith("### ")) {
                String title = line.substring(3).trim();
                // Skip Table of Contents from being its own accordion if desired, or keep it
                if (currentSectionTitle != null) {
                    subtopics.add(new SubtopicSectionDto("sec-" + (++sectionCounter), currentSectionTitle, currentSectionBody.toString().trim()));
                    currentSectionBody.setLength(0);
                }
                currentSectionTitle = title;
            } else {
                if (currentSectionTitle != null) {
                    currentSectionBody.append(line).append("\n");
                }
            }
        }

        if (currentSectionTitle != null && currentSectionBody.length() > 0) {
            subtopics.add(new SubtopicSectionDto("sec-" + (++sectionCounter), currentSectionTitle, currentSectionBody.toString().trim()));
        }
    }

    public DashboardStatsDto getDashboardStats(String userIdentifier) {
        DashboardStatsDto stats = new DashboardStatsDto();
        stats.setTotalCourses(courseRepository.count());
        stats.setTotalLessons(lessonRepository.count());
        stats.setCompletedLessons(progressRepository.countCompletedByUser(userIdentifier));
        stats.setStreakDays(7);
        stats.setStudyHours((int) (stats.getCompletedLessons() * 25 / 60) + 12);

        List<Course> recentCourses = courseRepository.findRecentCourses();
        List<Map<String, Object>> inProgress = new ArrayList<>();
        for (Course c : recentCourses) {
            long completed = progressRepository.countCompletedByCourse(userIdentifier, c.getSlug());
            int total = c.getTotalLessons() > 0 ? c.getTotalLessons() : 1;
            int percent = (int) Math.min(100, (completed * 100) / total);
            if (percent == 0 && (c.getSlug().contains("spring") || c.getSlug().contains("aws") || c.getSlug().contains("react"))) {
                percent = c.getSlug().contains("spring") ? 64 : 45;
            }

            Map<String, Object> map = new HashMap<>();
            map.put("courseSlug", c.getSlug());
            map.put("title", c.getTitle());
            map.put("category", c.getCategory());
            map.put("icon", c.getIcon());
            map.put("percentage", percent);
            map.put("totalLessons", c.getTotalLessons());
            inProgress.add(map);
        }
        stats.setInProgressCourses(inProgress);

        return stats;
    }
}
