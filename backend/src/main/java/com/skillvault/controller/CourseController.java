package com.skillvault.controller;

import com.skillvault.dto.DashboardStatsDto;
import com.skillvault.dto.InterviewGuideDto;
import com.skillvault.dto.LessonDetailDto;
import com.skillvault.model.Course;
import com.skillvault.security.UserPrincipal;
import com.skillvault.service.CourseService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    private String resolveUserIdentifier(UserPrincipal principal, Authentication authentication, String defaultFallback) {
        if (principal != null && principal.getEmail() != null) {
            return principal.getEmail();
        }
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getName())) {
            return authentication.getName();
        }
        return (defaultFallback != null && !defaultFallback.isBlank()) ? defaultFallback : "default-dev";
    }

    @GetMapping("/interview-questions")
    public ResponseEntity<List<InterviewGuideDto>> getInterviewGuides() {
        return ResponseEntity.ok(courseService.getAllInterviewGuides());
    }

    @GetMapping
    public ResponseEntity<List<Course>> getAllCourses(@RequestParam(required = false) String category) {
        return ResponseEntity.ok(courseService.getAllCourses(category));
    }

    @GetMapping("/stats/dashboard")
    public ResponseEntity<DashboardStatsDto> getDashboardStats(
            @AuthenticationPrincipal UserPrincipal principal,
            Authentication authentication,
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String headerUser) {
        String userIdentifier = resolveUserIdentifier(principal, authentication, headerUser);
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
            @AuthenticationPrincipal UserPrincipal principal,
            Authentication authentication,
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String headerUser) {
        String userIdentifier = resolveUserIdentifier(principal, authentication, headerUser);
        return courseService.getLessonDetail(courseSlug, lessonSlug, userIdentifier)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
