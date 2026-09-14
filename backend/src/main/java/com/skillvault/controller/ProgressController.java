package com.skillvault.controller;

import com.skillvault.model.Bookmark;
import com.skillvault.model.Progress;
import com.skillvault.service.ProgressService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    @PostMapping("/toggle/{courseSlug}/{lessonSlug}")
    public ResponseEntity<Progress> toggleLesson(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String userIdentifier) {
        return ResponseEntity.ok(progressService.toggleLessonCompletion(courseSlug, lessonSlug, userIdentifier));
    }

    @GetMapping
    public ResponseEntity<List<Progress>> getProgress(
            @RequestParam(required = false) String courseSlug,
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String userIdentifier) {
        return ResponseEntity.ok(progressService.getUserProgress(userIdentifier, courseSlug));
    }

    @PostMapping("/bookmark/{courseSlug}/{lessonSlug}")
    public ResponseEntity<Map<String, Object>> toggleBookmark(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @RequestBody(required = false) Map<String, String> body,
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String userIdentifier) {
        String title = body != null && body.containsKey("title") ? body.get("title") : lessonSlug;
        boolean bookmarked = progressService.toggleBookmark(courseSlug, lessonSlug, title, userIdentifier);
        return ResponseEntity.ok(Map.of("bookmarked", bookmarked, "lessonSlug", lessonSlug));
    }

    @GetMapping("/bookmarks")
    public ResponseEntity<List<Bookmark>> getBookmarks(
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String userIdentifier) {
        return ResponseEntity.ok(progressService.getUserBookmarks(userIdentifier));
    }
}
