package com.skillvault.repository;

import com.skillvault.model.Bookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookmarkRepository extends JpaRepository<Bookmark, Long> {
    List<Bookmark> findByUserIdentifierOrderByCreatedAtDesc(String userIdentifier);
    Optional<Bookmark> findByUserIdentifierAndCourseSlugAndLessonSlug(String userIdentifier, String courseSlug, String lessonSlug);
    void deleteByUserIdentifierAndCourseSlugAndLessonSlug(String userIdentifier, String courseSlug, String lessonSlug);
}
