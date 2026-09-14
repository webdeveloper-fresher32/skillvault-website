package com.skillvault.repository;

import com.skillvault.model.Progress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProgressRepository extends JpaRepository<Progress, Long> {
    List<Progress> findByUserIdentifier(String userIdentifier);
    List<Progress> findByUserIdentifierAndCourseSlug(String userIdentifier, String courseSlug);
    Optional<Progress> findByUserIdentifierAndLessonId(String userIdentifier, Long lessonId);

    @Query("SELECT COUNT(p) FROM Progress p WHERE p.userIdentifier = :userIdentifier AND p.completed = true")
    long countCompletedByUser(String userIdentifier);

    @Query("SELECT COUNT(p) FROM Progress p WHERE p.userIdentifier = :userIdentifier AND p.courseSlug = :courseSlug AND p.completed = true")
    long countCompletedByCourse(String userIdentifier, String courseSlug);
}
