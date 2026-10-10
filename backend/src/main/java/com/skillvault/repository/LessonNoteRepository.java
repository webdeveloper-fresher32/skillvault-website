package com.skillvault.repository;

import com.skillvault.model.LessonNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LessonNoteRepository extends JpaRepository<LessonNote, Long> {
    Optional<LessonNote> findByUserIdentifierAndCourseSlugAndLessonSlug(String userIdentifier, String courseSlug, String lessonSlug);
    List<LessonNote> findByUserIdentifierOrderByUpdatedAtDesc(String userIdentifier);
    List<LessonNote> findByUserIdentifierAndCourseSlugOrderByUpdatedAtDesc(String userIdentifier, String courseSlug);
    void deleteByUserIdentifierAndCourseSlugAndLessonSlug(String userIdentifier, String courseSlug, String lessonSlug);
}
