package com.skillvault.repository;

import com.skillvault.model.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseRepository extends JpaRepository<Course, Long> {
    Optional<Course> findBySlug(String slug);
    List<Course> findByCategoryIgnoreCase(String category);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM courses ORDER BY id DESC LIMIT 4", nativeQuery = true)
    List<Course> findRecentCourses();
}
