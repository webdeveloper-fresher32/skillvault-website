package com.skillvault.repository;

import com.skillvault.model.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LessonRepository extends JpaRepository<Lesson, Long> {
    @Query("SELECT l FROM Lesson l WHERE LOWER(l.title) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Lesson> searchByTitle(String query);
}
