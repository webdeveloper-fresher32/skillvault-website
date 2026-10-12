package com.skillvault.service;

import com.skillvault.model.LessonNote;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
public class NotePrivacyTest {

    @Autowired
    private LessonNoteService lessonNoteService;

    @Test
    @DisplayName("User notes must be strictly private and isolated between accounts")
    void testNotesPrivacyAndIsolation() {
        String userAlice = "alice_" + UUID.randomUUID().toString().substring(0, 8) + "@skillvault.dev";
        String userBob = "bob_" + UUID.randomUUID().toString().substring(0, 8) + "@skillvault.dev";

        String courseSlug = "angular";
        String lessonSlug = "signals-deep-dive";

        // Alice writes confidential notes
        String aliceSecretNote = "Alice's private architectural thoughts on Signal computed caching";
        lessonNoteService.saveNote(courseSlug, lessonSlug, "Signals Deep Dive", aliceSecretNote, userAlice);

        // Verify Alice can read her own note
        Optional<LessonNote> aliceRead = lessonNoteService.getNote(courseSlug, lessonSlug, userAlice);
        assertThat(aliceRead).isPresent();
        assertThat(aliceRead.get().getContent()).isEqualTo(aliceSecretNote);

        // Verify Bob CANNOT see Alice's note for the exact same course and lesson
        Optional<LessonNote> bobRead = lessonNoteService.getNote(courseSlug, lessonSlug, userBob);
        assertThat(bobRead).isEmpty();

        // Verify Bob's all notes list is empty
        List<LessonNote> bobAllNotes = lessonNoteService.getAllNotes(userBob);
        assertThat(bobAllNotes).isEmpty();

        // Bob writes his own note for the same lesson
        String bobNote = "Bob's private notes on effect() cleanup functions";
        lessonNoteService.saveNote(courseSlug, lessonSlug, "Signals Deep Dive", bobNote, userBob);

        // Verify Bob sees only his note and Alice still sees only her note
        Optional<LessonNote> bobReadAfter = lessonNoteService.getNote(courseSlug, lessonSlug, userBob);
        assertThat(bobReadAfter).isPresent();
        assertThat(bobReadAfter.get().getContent()).isEqualTo(bobNote);

        Optional<LessonNote> aliceReadAfter = lessonNoteService.getNote(courseSlug, lessonSlug, userAlice);
        assertThat(aliceReadAfter).isPresent();
        assertThat(aliceReadAfter.get().getContent()).isEqualTo(aliceSecretNote);
        assertThat(aliceReadAfter.get().getContent()).isNotEqualTo(bobReadAfter.get().getContent());

        // Alice deletes her note -> only Alice's note is deleted, Bob's remains untouched
        lessonNoteService.deleteNote(courseSlug, lessonSlug, userAlice);
        assertThat(lessonNoteService.getNote(courseSlug, lessonSlug, userAlice)).isEmpty();
        assertThat(lessonNoteService.getNote(courseSlug, lessonSlug, userBob)).isPresent();
    }
}
