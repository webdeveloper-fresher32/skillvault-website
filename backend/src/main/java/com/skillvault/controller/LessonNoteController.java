package com.skillvault.controller;

import com.skillvault.model.LessonNote;
import com.skillvault.service.LessonNoteService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notes")
public class LessonNoteController {

    private final LessonNoteService noteService;

    public LessonNoteController(LessonNoteService noteService) {
        this.noteService = noteService;
    }

    @GetMapping("/{courseSlug}/{lessonSlug}")
    public ResponseEntity<LessonNote> getNote(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String userIdentifier) {
        return noteService.getNote(courseSlug, lessonSlug, userIdentifier)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/{courseSlug}/{lessonSlug}")
    public ResponseEntity<LessonNote> saveNote(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String userIdentifier) {
        String content = body != null ? body.getOrDefault("content", "") : "";
        String lessonTitle = body != null ? body.getOrDefault("lessonTitle", "") : "";
        LessonNote saved = noteService.saveNote(courseSlug, lessonSlug, lessonTitle, content, userIdentifier);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{courseSlug}/{lessonSlug}")
    public ResponseEntity<Map<String, Object>> deleteNote(
            @PathVariable String courseSlug,
            @PathVariable String lessonSlug,
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String userIdentifier) {
        noteService.deleteNote(courseSlug, lessonSlug, userIdentifier);
        return ResponseEntity.ok(Map.of("success", true, "lessonSlug", lessonSlug));
    }

    @GetMapping
    public ResponseEntity<List<LessonNote>> getAllNotes(
            @RequestHeader(value = "X-User-Id", defaultValue = "default-dev") String userIdentifier) {
        return ResponseEntity.ok(noteService.getAllNotes(userIdentifier));
    }
}
