package com.skillvault.controller;

import com.skillvault.model.Bookmark;
import com.skillvault.model.Progress;
import com.skillvault.security.UserPrincipal;
import com.skillvault.service.ProgressService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    private String resolveUserIdentifier(UserPrincipal principal, Authentication authentication) {
        if (principal != null && principal.getEmail() != null) {
            return principal.getEmail();
        }
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getName())) {
            return authentication.getName();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to manage progress");
    }

    @PostMapping("/toggle/{courseSlug}/{lessonSlug}")
    public ResponseEntity<Progress> toggleLesson(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @AuthenticationPrincipal UserPrincipal principal,
            Authentication authentication) {
        String userIdentifier = resolveUserIdentifier(principal, authentication);
        return ResponseEntity.ok(progressService.toggleLessonCompletion(courseSlug, lessonSlug, userIdentifier));
    }

    @GetMapping
    public ResponseEntity<List<Progress>> getProgress(
            @RequestParam(required = false) String courseSlug,
            @AuthenticationPrincipal UserPrincipal principal,
            Authentication authentication) {
        String userIdentifier = resolveUserIdentifier(principal, authentication);
        return ResponseEntity.ok(progressService.getUserProgress(userIdentifier, courseSlug));
    }

    @PostMapping("/bookmark/{courseSlug}/{lessonSlug}")
    public ResponseEntity<Map<String, Object>> toggleBookmark(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal,
            Authentication authentication) {
        String userIdentifier = resolveUserIdentifier(principal, authentication);
        String title = body != null && body.containsKey("title") ? body.get("title") : lessonSlug;
        boolean bookmarked = progressService.toggleBookmark(courseSlug, lessonSlug, title, userIdentifier);
        return ResponseEntity.ok(Map.of("bookmarked", bookmarked, "lessonSlug", lessonSlug));
    }

    @GetMapping("/bookmarks")
    public ResponseEntity<List<Bookmark>> getBookmarks(
            @AuthenticationPrincipal UserPrincipal principal,
            Authentication authentication) {
        String userIdentifier = resolveUserIdentifier(principal, authentication);
        return ResponseEntity.ok(progressService.getUserBookmarks(userIdentifier));
    }
}
