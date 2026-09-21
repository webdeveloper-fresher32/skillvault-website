package com.skillvault.controller;

import com.skillvault.dto.DashboardStatsDto;
import com.skillvault.dto.LessonDetailDto;
import com.skillvault.model.Course;
import com.skillvault.service.CourseService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;
    private final com.skillvault.service.ContentIndexingService contentIndexingService;

    public CourseController(CourseService courseService, com.skillvault.service.ContentIndexingService contentIndexingService) {
        this.courseService = courseService;
        this.contentIndexingService = contentIndexingService;
    }

    @PostMapping("/reindex")
    public ResponseEntity<String> reindex() {
        contentIndexingService.indexContent();
        return ResponseEntity.ok("Reindexing completed successfully");
    }

    @GetMapping
    public ResponseEntity<List<Course>> getAllCourses(@RequestParam(required = false) String category) {
        return ResponseEntity.ok(courseService.getAllCourses(category));
    }

    @GetMapping("/stats/dashboard")
    public ResponseEntity<DashboardStatsDto> getDashboardStats(
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String userIdentifier) {
        return ResponseEntity.ok(courseService.getDashboardStats(userIdentifier));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<Course> getCourseBySlug(@PathVariable String slug) {
        return courseService.getCourseBySlug(slug)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{courseSlug}/lessons/{lessonSlug}")
    public ResponseEntity<LessonDetailDto> getLessonDetail(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String userIdentifier) {
        return courseService.getLessonDetail(courseSlug, lessonSlug, userIdentifier)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
