package com.skillvault.controller;

import com.skillvault.model.Course;
import com.skillvault.model.Lesson;
import com.skillvault.repository.CourseRepository;
import com.skillvault.repository.LessonRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final CourseRepository courseRepository;
    private final LessonRepository lessonRepository;

    public SearchController(CourseRepository courseRepository, LessonRepository lessonRepository) {
        this.courseRepository = courseRepository;
        this.lessonRepository = lessonRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> search(@RequestParam String q) {
        String query = q.trim();
        List<Course> courses = courseRepository.findAll().stream()
                .filter(c -> c.getTitle().toLowerCase().contains(query.toLowerCase()) || 
                             c.getCategory().toLowerCase().contains(query.toLowerCase()))
                .limit(5)
                .toList();

        List<Lesson> lessons = lessonRepository.searchByTitle(query).stream()
                .limit(10)
                .toList();

        List<Map<String, String>> lessonResults = lessons.stream().map(l -> {
            Map<String, String> m = new HashMap<>();
            m.put("title", l.getTitle());
            m.put("lessonSlug", l.getSlug());
            m.put("courseSlug", l.getModule().getCourse().getSlug());
            m.put("courseTitle", l.getModule().getCourse().getTitle());
            m.put("moduleTitle", l.getModule().getTitle());
            return m;
        }).toList();

        Map<String, Object> result = new HashMap<>();
        result.put("query", query);
        result.put("courses", courses);
        result.put("lessons", lessonResults);
        return ResponseEntity.ok(result);
    }
}
