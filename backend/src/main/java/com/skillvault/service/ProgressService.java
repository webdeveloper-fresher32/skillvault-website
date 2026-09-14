package com.skillvault.service;

import com.skillvault.model.Bookmark;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ProgressService {

    private final ProgressRepository progressRepository;
    private final CourseRepository courseRepository;
    private final BookmarkRepository bookmarkRepository;

    public ProgressService(ProgressRepository progressRepository,
                           CourseRepository courseRepository,
                           BookmarkRepository bookmarkRepository) {
        this.progressRepository = progressRepository;
        this.courseRepository = courseRepository;
        this.bookmarkRepository = bookmarkRepository;
    }

    @Transactional
    public Progress toggleLessonCompletion(String courseSlug, String lessonSlug, String userIdentifier) {
        Course course = courseRepository.findBySlug(courseSlug.toLowerCase())
                .orElseThrow(() -> new RuntimeException("Course not found: " + courseSlug));

        Lesson targetLesson = null;
        for (CourseModule m : course.getModules()) {
            for (Lesson l : m.getLessons()) {
                if (l.getSlug().equalsIgnoreCase(lessonSlug)) {
                    targetLesson = l;
                    break;
                }
            }
            if (targetLesson != null) break;
        }

        if (targetLesson == null) {
            throw new RuntimeException("Lesson not found: " + lessonSlug);
        }

        Optional<Progress> existing = progressRepository.findByUserIdentifierAndLessonId(userIdentifier, targetLesson.getId());
        Progress progress;
        if (existing.isPresent()) {
            progress = existing.get();
            progress.setCompleted(!progress.isCompleted());
            if (progress.isCompleted()) {
                progress.setCompletedAt(LocalDateTime.now());
            }
        } else {
            progress = new Progress(userIdentifier, targetLesson, courseSlug.toLowerCase(), true);
        }
        progress.setLastAccessedAt(LocalDateTime.now());
        return progressRepository.save(progress);
    }

    public List<Progress> getUserProgress(String userIdentifier, String courseSlug) {
        if (courseSlug != null && !courseSlug.isEmpty()) {
            return progressRepository.findByUserIdentifierAndCourseSlug(userIdentifier, courseSlug.toLowerCase());
        }
        return progressRepository.findByUserIdentifier(userIdentifier);
    }

    @Transactional
    public boolean toggleBookmark(String courseSlug, String lessonSlug, String title, String userIdentifier) {
        Optional<Bookmark> existing = bookmarkRepository.findByUserIdentifierAndCourseSlugAndLessonSlug(
                userIdentifier, courseSlug.toLowerCase(), lessonSlug.toLowerCase());

        if (existing.isPresent()) {
            bookmarkRepository.delete(existing.get());
            return false;
        } else {
            Bookmark bookmark = new Bookmark(userIdentifier, courseSlug.toLowerCase(), lessonSlug.toLowerCase(), title);
            bookmarkRepository.save(bookmark);
            return true;
        }
    }

    public List<Bookmark> getUserBookmarks(String userIdentifier) {
        return bookmarkRepository.findByUserIdentifierOrderByCreatedAtDesc(userIdentifier);
    }
}
