package com.skillvault.controller;

import com.skillvault.model.LessonNote;
import com.skillvault.security.UserPrincipal;
import com.skillvault.service.LessonNoteService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notes")
public class LessonNoteController {

    private final LessonNoteService noteService;

    public LessonNoteController(LessonNoteService noteService) {
        this.noteService = noteService;
    }

    private String resolveUserIdentifier(UserPrincipal principal, Authentication authentication) {
        if (principal != null && principal.getEmail() != null) {
            return principal.getEmail();
        }
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getName())) {
            return authentication.getName();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to access private notes");
    }

    @GetMapping("/{courseSlug}/{lessonSlug}")
    public ResponseEntity<LessonNote> getNote(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @AuthenticationPrincipal UserPrincipal principal,
            Authentication authentication) {
        String userIdentifier = resolveUserIdentifier(principal, authentication);
        return noteService.getNote(courseSlug, lessonSlug, userIdentifier)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/{courseSlug}/{lessonSlug}")
    public ResponseEntity<LessonNote> saveNote(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal,
            Authentication authentication) {
        String userIdentifier = resolveUserIdentifier(principal, authentication);
        String content = body != null ? body.getOrDefault("content", "") : "";
        String lessonTitle = body != null ? body.getOrDefault("lessonTitle", "") : "";
        LessonNote saved = noteService.saveNote(courseSlug, lessonSlug, lessonTitle, content, userIdentifier);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{courseSlug}/{lessonSlug}")
    public ResponseEntity<Map<String, Object>> deleteNote(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @AuthenticationPrincipal UserPrincipal principal,
            Authentication authentication) {
        String userIdentifier = resolveUserIdentifier(principal, authentication);
        noteService.deleteNote(courseSlug, lessonSlug, userIdentifier);
        return ResponseEntity.ok(Map.of("success", true, "lessonSlug", lessonSlug));
    }

    @GetMapping
    public ResponseEntity<List<LessonNote>> getAllNotes(
            @AuthenticationPrincipal UserPrincipal principal,
            Authentication authentication) {
        String userIdentifier = resolveUserIdentifier(principal, authentication);
        return ResponseEntity.ok(noteService.getAllNotes(userIdentifier));
    }
}
