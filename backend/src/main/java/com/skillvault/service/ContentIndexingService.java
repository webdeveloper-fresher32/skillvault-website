package com.skillvault.service;

import com.skillvault.model.Course;
import com.skillvault.model.CourseModule;
import com.skillvault.model.Lesson;
import com.skillvault.repository.CourseModuleRepository;
import com.skillvault.repository.CourseRepository;
import com.skillvault.repository.LessonRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.*;

@Service
public class ContentIndexingService {

    private static final Logger log = LoggerFactory.getLogger(ContentIndexingService.class);

    private final CourseRepository courseRepository;
    private final CourseModuleRepository moduleRepository;
    private final LessonRepository lessonRepository;

    @Value("${skillvault.content.path:../content}")
    private String contentBasePath;

    public ContentIndexingService(CourseRepository courseRepository,
                                  CourseModuleRepository moduleRepository,
                                  LessonRepository lessonRepository) {
        this.courseRepository = courseRepository;
        this.moduleRepository = moduleRepository;
        this.lessonRepository = lessonRepository;
    }

    @PostConstruct
    public void init() {
        new Thread(() -> {
            try {
                Thread.sleep(1500);
                indexContent();
            } catch (Exception e) {
                log.error("Error during background content indexing", e);
            }
        }).start();
    }

    @Transactional
    public void indexContent() {
        File contentDir = new File(contentBasePath);
        if (!contentDir.exists() || !contentDir.isDirectory()) {
            contentDir = new File("content");
        }
        if (!contentDir.exists()) {
            log.warn("Content directory not found at: " + contentBasePath);
            return;
        }

        log.info("Starting SkillVault content indexing from: {}", contentDir.getAbsolutePath());

        File[] courseDirs = contentDir.listFiles(File::isDirectory);
        if (courseDirs == null) return;

        Arrays.sort(courseDirs, Comparator.comparing(File::getName));

        Set<String> activeSlugs = new HashSet<>();
        for (File courseDir : courseDirs) {
            String dirName = courseDir.getName();
            if (dirName.startsWith(".") || dirName.equalsIgnoreCase("docs") || dirName.equalsIgnoreCase("CareerPaths") || dirName.equalsIgnoreCase("ProjectsCatalog")) continue;
            activeSlugs.add(courseDir.getName().toLowerCase());

            try {
                indexSingleCourse(courseDir);
            } catch (Exception e) {
                log.error("Failed indexing course: " + dirName, e);
            }
        }

        // Clean up stale or deleted courses from database
        List<Course> allInDb = courseRepository.findAll();
        for (Course c : allInDb) {
            if (!activeSlugs.contains(c.getSlug()) || c.getTotalLessons() == 0) {
                log.info("Removing obsolete or empty course from DB: {}", c.getSlug());
                courseRepository.delete(c);
            }
        }

        log.info("SkillVault content indexing complete! Total courses in DB: {}", courseRepository.count());
    }

    private void indexSingleCourse(File courseDir) {
        String slug = courseDir.getName().toLowerCase();
        String title = formatCourseTitle(courseDir.getName());
        String category = categorizeCourse(courseDir.getName());
        String level = "Intermediate";
        String icon = getCourseIcon(slug);

        Course course = courseRepository.findBySlug(slug).orElse(new Course());
        course.setSlug(slug);
        course.setTitle(title);
        course.setCategory(category);
        course.setLevel(level);
        course.setIcon(icon);

        File readme = new File(courseDir, "README.md");
        if (readme.exists()) {
            try {
                String firstLines = extractDescriptionFromReadme(readme);
                course.setDescription(firstLines);
            } catch (Exception ignored) {}
        } else {
            course.setDescription("Comprehensive production-grade mastery course on " + title + ".");
        }

        course = courseRepository.save(course);

        File[] subFiles = courseDir.listFiles();
        if (subFiles == null) return;

        Arrays.sort(subFiles, Comparator.comparing(File::getName));

        int moduleOrder = 0;
        int totalLessonCount = 0;

        List<CourseModule> existingModules = course.getModules();
        Map<String, CourseModule> moduleMap = new HashMap<>();
        for (CourseModule m : existingModules) {
            moduleMap.put(m.getSlug(), m);
        }

        List<File> standaloneMdFiles = new ArrayList<>();
        Set<String> discoveredModuleSlugs = new HashSet<>();

        for (File file : subFiles) {
            if (file.getName().startsWith(".")) continue;

            if (file.isDirectory()) {
                String modName = file.getName();
                if (modName.equalsIgnoreCase("0.Assets") || 
                    modName.equalsIgnoreCase("assets") || 
                    modName.equalsIgnoreCase("images") || 
                    modName.equalsIgnoreCase("img") ||
                    modName.equalsIgnoreCase("Reference-Code")) {
                    continue;
                }

                String modSlug = modName.toLowerCase();
                String modTitle = formatModuleTitle(modName);

                CourseModule module = moduleMap.getOrDefault(modSlug, new CourseModule());
                module.setCourse(course);
                module.setSlug(modSlug);
                module.setTitle(modTitle);
                module.setSortOrder(++moduleOrder);
                module = moduleRepository.save(module);

                int lessonCount = indexLessonsInModule(file, module, course);
                if (lessonCount == 0) {
                    moduleRepository.delete(module);
                } else {
                    discoveredModuleSlugs.add(modSlug);
                    totalLessonCount += lessonCount;
                }
            } else if (file.getName().endsWith(".md") && !file.getName().equalsIgnoreCase("README.md")) {
                standaloneMdFiles.add(file);
            }
        }

        if (!standaloneMdFiles.isEmpty()) {
            discoveredModuleSlugs.add("core-material");
            CourseModule generalModule = moduleMap.getOrDefault("core-material", new CourseModule());
            generalModule.setCourse(course);
            generalModule.setSlug("core-material");
            generalModule.setTitle("Core Guides & Materials");
            generalModule.setSortOrder(++moduleOrder);
            generalModule = moduleRepository.save(generalModule);

            Map<String, Lesson> existingLessons = new HashMap<>();
            for (Lesson l : generalModule.getLessons()) {
                existingLessons.put(l.getSlug(), l);
            }

            int order = 0;
            Set<String> standaloneSlugs = new HashSet<>();
            for (File mdFile : standaloneMdFiles) {
                String lessonSlug = mdFile.getName().replace(".md", "").toLowerCase();
                standaloneSlugs.add(lessonSlug);
                String lessonTitle = formatLessonTitle(mdFile.getName().replace(".md", ""));
                Lesson lesson = existingLessons.getOrDefault(lessonSlug, new Lesson());
                lesson.setTitle(lessonTitle);
                lesson.setSlug(lessonSlug);
                lesson.setFilePath(mdFile.getAbsolutePath());
                lesson.setSortOrder(++order);
                lesson.setEstimatedMinutes(20);
                lesson.setModule(generalModule);
                lessonRepository.save(lesson);
                totalLessonCount++;
            }

            for (Lesson l : new ArrayList<>(generalModule.getLessons())) {
                if (!standaloneSlugs.contains(l.getSlug())) {
                    lessonRepository.delete(l);
                }
            }
        }

        // Delete any modules that no longer exist on disk (e.g. renamed folders)
        for (CourseModule m : new ArrayList<>(existingModules)) {
            if (!discoveredModuleSlugs.contains(m.getSlug())) {
                moduleRepository.delete(m);
            }
        }

        course.setTotalLessons(totalLessonCount);
        course.setEstimatedHours(Math.max(10, totalLessonCount * 45 / 60));
        courseRepository.save(course);
    }

    private int indexLessonsInModule(File moduleDir, CourseModule module, Course course) {
        File[] files = moduleDir.listFiles((dir, name) -> name.endsWith(".md") && !name.equalsIgnoreCase("README.md"));
        if (files == null || files.length == 0) return 0;

        Arrays.sort(files, Comparator.comparing(File::getName));
        
        Map<String, Lesson> existingLessons = new HashMap<>();
        for (Lesson l : module.getLessons()) {
            existingLessons.put(l.getSlug(), l);
        }

        int order = 0;
        Set<String> discoveredLessonSlugs = new HashSet<>();
        for (File f : files) {
            String lessonSlug = f.getName().replace(".md", "").toLowerCase();
            discoveredLessonSlugs.add(lessonSlug);
            String lessonTitle = formatLessonTitle(f.getName().replace(".md", ""));
            
            Lesson lesson = existingLessons.getOrDefault(lessonSlug, new Lesson());
            lesson.setTitle(lessonTitle);
            lesson.setSlug(lessonSlug);
            lesson.setFilePath(f.getAbsolutePath());
            lesson.setSortOrder(++order);
            lesson.setEstimatedMinutes(20);
            lesson.setModule(module);
            lessonRepository.save(lesson);
        }

        // Delete any lessons that no longer exist on disk
        for (Lesson l : new ArrayList<>(module.getLessons())) {
            if (!discoveredLessonSlugs.contains(l.getSlug())) {
                lessonRepository.delete(l);
            }
        }

        return files.length;
    }

    private String formatCourseTitle(String name) {
        if ("AWS".equalsIgnoreCase(name)) return "Amazon Web Services (AWS)";
        if ("AWS-Local".equalsIgnoreCase(name)) return "AWS Local Development";
        if ("DSA".equalsIgnoreCase(name)) return "Data Structures & Algorithms";
        if ("HLD".equalsIgnoreCase(name)) return "High-Level Design (HLD)";
        if ("LLD".equalsIgnoreCase(name)) return "Low-Level Design (LLD)";
        if ("RAG".equalsIgnoreCase(name)) return "Retrieval-Augmented Generation (RAG)";
        if ("SpringBoot".equalsIgnoreCase(name)) return "Spring Boot 3 & 4 Backend";
        if ("NextJS".equalsIgnoreCase(name)) return "Next.js Full Stack";
        if ("NodeJS".equalsIgnoreCase(name)) return "Node.js Architecture";
        if ("NestJS".equalsIgnoreCase(name)) return "NestJS Enterprise Microservices";
        if ("MachineLearning".equalsIgnoreCase(name)) return "Machine Learning & Deep Learning";
        if ("GenAI".equalsIgnoreCase(name)) return "Generative AI & LLM Systems";
        if ("DatabasesFundamentals".equalsIgnoreCase(name)) return "Database Systems & Internals";
        if ("MongoDB".equalsIgnoreCase(name)) return "MongoDB Architecture & Modeling";
        if ("MySQL".equalsIgnoreCase(name)) return "MySQL & Relational Design";
        if ("PostgreSQL".equalsIgnoreCase(name) || "Postgres".equalsIgnoreCase(name)) return "PostgreSQL Architecture & Mastery";
        if ("Redis".equalsIgnoreCase(name)) return "Redis In-Memory & Caching";
        if ("JavaScript".equalsIgnoreCase(name)) return "Modern JavaScript Full Stack";
        if ("Java".equalsIgnoreCase(name)) return "Java Core & Concurrency Masterclass";
        if ("Git".equalsIgnoreCase(name)) return "Git Architecture & Enterprise Workflows";
        if ("GithubActions".equalsIgnoreCase(name)) return "GitHub Actions CI/CD";
        if ("ShellScripting".equalsIgnoreCase(name)) return "Linux Shell Scripting & Automation";
        if ("ComputerFundamentals".equalsIgnoreCase(name)) return "Computer Science Fundamentals";
        if ("OperatingSystems".equalsIgnoreCase(name)) return "Operating Systems & Architecture";
        if ("Networking".equalsIgnoreCase(name)) return "Computer Networking & Protocols";
        if ("Microservices-and-Cloud".equalsIgnoreCase(name)) return "Microservices & Cloud Patterns";
        if ("PaymentGateways".equalsIgnoreCase(name)) return "Payment Gateways & Subscriptions";
        if ("Aptitude".equalsIgnoreCase(name)) return "Quantitative & Logical Aptitude";
        if ("LangChain".equalsIgnoreCase(name)) return "LangChain Orchestration";
        if ("LangGraph".equalsIgnoreCase(name)) return "LangGraph Multi-Agent Workflows";
        return name.replaceAll("([a-z])([A-Z])", "$1 $2");
    }

    private String formatModuleTitle(String name) {
        String cleaned = name.replaceAll("^Phase-\\d+-?", "");
        cleaned = cleaned.replace("-", " ");
        return cleaned.isEmpty() ? name : cleaned;
    }

    private String formatLessonTitle(String name) {
        String cleaned = name.replaceAll("^\\d+-?", "");
        cleaned = cleaned.replace("-", " ");
        return cleaned.isEmpty() ? name : cleaned;
    }

    private String categorizeCourse(String name) {
        String n = name.toLowerCase();
        // Frontend
        if (n.equals("javascript") || n.equals("react") || n.equals("nextjs") || n.equals("angular") || n.equals("typescript")) {
            return "Frontend";
        }
        // Backend
        if (n.equals("java") || n.equals("springboot") || n.equals("nodejs") || n.equals("nestjs") || n.equals("paymentgateways")) {
            return "Backend";
        }
        // Databases
        if (n.contains("database") || n.contains("sql") || n.contains("redis") || n.contains("mongo") || n.contains("postgres")) {
            return "Databases";
        }
        // AI & LLMs
        if (n.contains("genai") || n.contains("machinelearning") || n.contains("rag") || n.contains("langchain") || n.contains("langgraph")) {
            return "AI & LLMs";
        }
        // Cloud & DevOps
        if (n.contains("aws") || n.contains("cloud") || n.contains("terraform") || n.contains("microservices")) {
            return "Cloud & DevOps";
        }
        // DevOps
        if (n.equals("docker") || n.equals("kubernetes") || n.equals("git") || n.equals("githubactions")) {
            return "DevOps";
        }
        // System Design
        if (n.equals("hld") || n.equals("lld")) {
            return "System Design";
        }
        // Computer Science
        if (n.contains("operating") || n.contains("network") || n.contains("fundamental") || n.contains("shell")) {
            return "Computer Science";
        }
        // Interview Prep
        if (n.equals("dsa") || n.equals("aptitude")) {
            return "Interview Prep";
        }
        return "Software Engineering";
    }

    private String getCourseIcon(String slug) {
        if (slug.contains("aws")) return "cloud";
        if (slug.contains("spring")) return "leaf";
        if (slug.contains("java")) return "coffee";
        if (slug.contains("react") || slug.contains("next")) return "atom";
        if (slug.contains("docker") || slug.contains("kube")) return "box";
        if (slug.contains("data") || slug.contains("sql") || slug.contains("postgres")) return "database";
        if (slug.contains("ai") || slug.contains("rag") || slug.contains("lang")) return "brain";
        if (slug.contains("hld") || slug.contains("lld")) return "layers";
        return "terminal";
    }

    private String extractDescriptionFromReadme(File readme) throws IOException {
        List<String> lines = Files.readAllLines(readme.toPath());
        StringBuilder sb = new StringBuilder();
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.startsWith("#") || trimmed.startsWith("---") || trimmed.startsWith("```") || trimmed.isEmpty()) {
                continue;
            }
            sb.append(trimmed).append(" ");
            if (sb.length() > 220) break;
        }
        return sb.toString().trim();
    }
}
