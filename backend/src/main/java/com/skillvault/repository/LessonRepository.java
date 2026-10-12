package com.skillvault.repository;

import com.skillvault.dto.InterviewGuideDto;
import com.skillvault.model.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LessonRepository extends JpaRepository<Lesson, Long> {
    @Query("SELECT l FROM Lesson l WHERE LOWER(l.title) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Lesson> searchByTitle(String query);

    @Query("""
        SELECT new com.skillvault.dto.InterviewGuideDto(
            l.id,
            l.title,
            l.slug,
            c.slug,
            c.title,
            c.category,
            c.icon,
            l.estimatedMinutes,
            l.summary,
            CONCAT('/courses/', c.slug, '/', l.slug)
        )
        FROM Lesson l
        JOIN l.module m
        JOIN m.course c
        WHERE LOWER(l.slug) LIKE '%interview%' 
           OR LOWER(l.title) LIKE '%interview%'
           OR LOWER(l.slug) LIKE '%50-interview%'
        ORDER BY c.category ASC, c.title ASC, l.sortOrder ASC
    """)
    List<InterviewGuideDto> findAllInterviewGuides();
}

