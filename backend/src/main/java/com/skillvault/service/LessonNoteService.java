package com.skillvault.service;

import com.skillvault.model.LessonNote;
import com.skillvault.repository.LessonNoteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class LessonNoteService {

    private final LessonNoteRepository noteRepository;

    public LessonNoteService(LessonNoteRepository noteRepository) {
        this.noteRepository = noteRepository;
    }

    public Optional<LessonNote> getNote(String courseSlug, String lessonSlug, String userIdentifier) {
        return noteRepository.findByUserIdentifierAndCourseSlugAndLessonSlug(userIdentifier, courseSlug, lessonSlug);
    }

    @Transactional
    public LessonNote saveNote(String courseSlug, String lessonSlug, String lessonTitle, String content, String userIdentifier) {
        Optional<LessonNote> existing = noteRepository.findByUserIdentifierAndCourseSlugAndLessonSlug(userIdentifier, courseSlug, lessonSlug);
        LessonNote note;
        if (existing.isPresent()) {
            note = existing.get();
            note.setContent(content);
            if (lessonTitle != null && !lessonTitle.isBlank()) {
                note.setLessonTitle(lessonTitle);
            }
            note.setUpdatedAt(LocalDateTime.now());
        } else {
            note = new LessonNote(userIdentifier, courseSlug, lessonSlug, lessonTitle, content);
        }
        return noteRepository.save(note);
    }

    @Transactional
    public void deleteNote(String courseSlug, String lessonSlug, String userIdentifier) {
        noteRepository.deleteByUserIdentifierAndCourseSlugAndLessonSlug(userIdentifier, courseSlug, lessonSlug);
    }

    public List<LessonNote> getAllNotes(String userIdentifier) {
        return noteRepository.findByUserIdentifierOrderByUpdatedAtDesc(userIdentifier);
    }
}
