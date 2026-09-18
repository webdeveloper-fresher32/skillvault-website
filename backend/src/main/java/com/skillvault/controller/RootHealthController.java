package com.skillvault.controller;

import com.skillvault.repository.CourseRepository;
import com.skillvault.repository.LessonRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.RuntimeMXBean;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class RootHealthController {

    private final DataSource dataSource;
    private final CourseRepository courseRepository;
    private final LessonRepository lessonRepository;

    @Value("${skillvault.content.path:../content}")
    private String contentPath;

    public RootHealthController(DataSource dataSource,
                                CourseRepository courseRepository,
                                LessonRepository lessonRepository) {
        this.dataSource = dataSource;
        this.courseRepository = courseRepository;
        this.lessonRepository = lessonRepository;
    }

    @GetMapping(value = "/", produces = MediaType.TEXT_HTML_VALUE)
    public String renderHealthDashboard() {
        boolean dbConnected = false;
        String dbProduct = "Unknown";
        String dbVersion = "Unknown";
        String dbUser = "Unknown";
        String dbUrlSanitized = "Unknown";
        long pingMs = -1;
        String dbError = null;

        long startTime = System.currentTimeMillis();
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            dbProduct = meta.getDatabaseProductName();
            dbVersion = meta.getDatabaseProductVersion();
            dbUser = meta.getUserName();
            String rawUrl = meta.getURL();
            dbUrlSanitized = rawUrl != null ? rawUrl.replaceAll(":[^/@]+@", ":***@") : "Configured";

            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT 1")) {
                if (rs.next()) {
                    dbConnected = true;
                }
            }
            pingMs = System.currentTimeMillis() - startTime;
        } catch (Exception e) {
            dbError = e.getMessage();
        }

        long coursesCount = 0;
        long lessonsCount = 0;
        try {
            coursesCount = courseRepository.count();
            lessonsCount = lessonRepository.count();
        } catch (Exception ignored) {}

        File contentDir = new File(contentPath);
        boolean contentExists = contentDir.exists() && contentDir.isDirectory();
        int contentFolders = contentExists && contentDir.listFiles() != null 
                ? (int) java.util.Arrays.stream(contentDir.listFiles()).filter(File::isDirectory).count() 
                : 0;

        RuntimeMXBean runtime = ManagementFactory.getRuntimeMXBean();
        MemoryMXBean memory = ManagementFactory.getMemoryMXBean();
        long uptimeSeconds = runtime.getUptime() / 1000;
        long usedMemMb = (memory.getHeapMemoryUsage().getUsed()) / (1024 * 1024);
        long maxMemMb = (memory.getHeapMemoryUsage().getMax()) / (1024 * 1024);

        String statusBadgeClass = dbConnected 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : "bg-rose-500/10 text-rose-400 border-rose-500/20";
        String statusDotClass = dbConnected ? "bg-emerald-400" : "bg-rose-400";
        String statusText = dbConnected ? "ALL SYSTEMS OPERATIONAL" : "DATABASE CONNECTION DEGRADED";

        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SkillVault DevOS — API & Service Health Dashboard</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Inter', sans-serif; background-color: #030712; color: #f3f4f6; }
                .font-mono { font-family: 'JetBrains Mono', monospace; }
                .glow { box-shadow: 0 0 50px -10px rgba(59, 130, 246, 0.15); }
                .card { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(31, 41, 55, 0.8); }
            </style>
        </head>
        <body class="min-h-screen flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 selection:bg-blue-500 selection:text-white">
            
            <div class="max-w-5xl mx-auto w-full">
                <!-- Top Brand Header -->
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-8 border-b border-gray-800/80 gap-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-mono font-bold text-white shadow-lg shadow-blue-500/30 text-lg">
                            >_
                        </div>
                        <div>
                            <div class="flex items-center space-x-2">
                                <h1 class="text-xl font-extrabold tracking-tight text-white">SkillVault</h1>
                                <span class="bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">DEV OS ENGINE</span>
                            </div>
                            <p class="text-xs text-gray-400">Spring Boot Microservice & Database Health Monitor</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center space-x-3">
                        <div class="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-semibold %s">
                            <span class="w-2 h-2 rounded-full %s animate-pulse"></span>
                            <span>%s</span>
                        </div>
                        <a href="/api/courses" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-3 py-1.5 rounded-lg border border-gray-700 transition">
                            JSON Endpoints &rarr;
                        </a>
                    </div>
                </div>

                <!-- Main Grid -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
                    
                    <!-- PostgreSQL Status Card -->
                    <div class="card rounded-2xl p-6 glow flex flex-col justify-between md:col-span-2">
                        <div>
                            <div class="flex items-center justify-between pb-4 border-b border-gray-800/80">
                                <div class="flex items-center space-x-3">
                                    <div class="p-2.5 rounded-xl %s">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="font-bold text-white text-base">PostgreSQL Cluster</h3>
                                        <p class="text-xs text-gray-400 font-mono">%s</p>
                                    </div>
                                </div>
                                <span class="font-mono text-xs px-2.5 py-1 rounded-md %s">
                                    %s
                                </span>
                            </div>

                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
                                <div class="bg-gray-900/60 border border-gray-800/80 p-3 rounded-xl">
                                    <span class="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Latency</span>
                                    <span class="text-lg font-bold font-mono text-emerald-400">%d ms</span>
                                </div>
                                <div class="bg-gray-900/60 border border-gray-800/80 p-3 rounded-xl">
                                    <span class="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Active Courses</span>
                                    <span class="text-lg font-bold font-mono text-white">%d</span>
                                </div>
                                <div class="bg-gray-900/60 border border-gray-800/80 p-3 rounded-xl">
                                    <span class="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Indexed Lessons</span>
                                    <span class="text-lg font-bold font-mono text-white">%d</span>
                                </div>
                                <div class="bg-gray-900/60 border border-gray-800/80 p-3 rounded-xl">
                                    <span class="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">DB User</span>
                                    <span class="text-sm font-bold font-mono text-gray-300 truncate block mt-1">%s</span>
                                </div>
                            </div>

                            %s
                        </div>

                        <div class="mt-5 pt-4 border-t border-gray-800/60 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                            <span class="truncate max-w-md">Target: %s</span>
                            <span class="text-gray-500">Auto-pooler active</span>
                        </div>
                    </div>

                    <!-- System & Runtime Status -->
                    <div class="card rounded-2xl p-6 glow flex flex-col justify-between">
                        <div>
                            <div class="flex items-center space-x-3 pb-4 border-b border-gray-800/80">
                                <div class="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-bold text-white text-base">Backend Runtime</h3>
                                    <p class="text-xs text-gray-400 font-mono">Spring Boot v4.1 / JDK 17</p>
                                </div>
                            </div>

                            <div class="space-y-4 mt-5">
                                <div>
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="text-gray-400">JVM Heap Memory</span>
                                        <span class="font-mono text-gray-200">%d MB / %d MB</span>
                                    </div>
                                    <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                        <div class="bg-blue-500 h-1.5 rounded-full" style="width: %d%%"></div>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between py-2 border-b border-gray-800/60 text-xs">
                                    <span class="text-gray-400">Service Uptime</span>
                                    <span class="font-mono text-gray-200 font-semibold">%s</span>
                                </div>

                                <div class="flex items-center justify-between py-2 border-b border-gray-800/60 text-xs">
                                    <span class="text-gray-400">Content Directory</span>
                                    <span class="font-mono %s">%d Active Folders</span>
                                </div>

                                <div class="flex items-center justify-between py-2 text-xs">
                                    <span class="text-gray-400">Environment Port</span>
                                    <span class="font-mono text-blue-400 font-semibold">Ready</span>
                                </div>
                            </div>
                        </div>

                        <div class="mt-5 pt-4 border-t border-gray-800/60 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                            <span>Status: Healthy</span>
                            <span class="text-emerald-400 font-semibold">200 OK</span>
                        </div>
                    </div>
                </div>

                <!-- API Endpoints Quick Reference -->
                <div class="mt-6 card rounded-2xl p-6">
                    <h3 class="font-bold text-sm text-gray-300 uppercase tracking-wider mb-4 font-mono">Available API Endpoints</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                        <a href="/api/courses" class="bg-gray-900/80 hover:bg-gray-800 border border-gray-800 p-3 rounded-xl flex items-center justify-between transition group">
                            <div>
                                <span class="text-emerald-400 font-bold mr-2">GET</span>
                                <span class="text-gray-200 group-hover:text-blue-400">/api/courses</span>
                            </div>
                            <span class="text-gray-500">&rarr;</span>
                        </a>
                        <a href="/api/search?q=database" class="bg-gray-900/80 hover:bg-gray-800 border border-gray-800 p-3 rounded-xl flex items-center justify-between transition group">
                            <div>
                                <span class="text-emerald-400 font-bold mr-2">GET</span>
                                <span class="text-gray-200 group-hover:text-blue-400">/api/search</span>
                            </div>
                            <span class="text-gray-500">&rarr;</span>
                        </a>
                        <a href="/health" class="bg-gray-900/80 hover:bg-gray-800 border border-gray-800 p-3 rounded-xl flex items-center justify-between transition group">
                            <div>
                                <span class="text-emerald-400 font-bold mr-2">GET</span>
                                <span class="text-gray-200 group-hover:text-blue-400">/health (JSON)</span>
                            </div>
                            <span class="text-gray-500">&rarr;</span>
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div class="mt-8 text-center text-xs text-gray-500 font-mono">
                    SkillVault Platform &copy; 2026 &bull; Production Infrastructure Node
                </div>
            </div>
        </body>
        </html>
        """.formatted(
                statusBadgeClass, statusDotClass, statusText,
                dbConnected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20",
                dbConnected ? dbProduct + " " + dbVersion : "Offline / Unreachable",
                dbConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400",
                dbConnected ? "CONNECTED" : "DISCONNECTED",
                pingMs >= 0 ? pingMs : 0,
                coursesCount,
                lessonsCount,
                dbUser,
                dbError != null ? "<div class='mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs font-mono break-all'>Error: " + dbError + "</div>" : "",
                dbUrlSanitized,
                usedMemMb, maxMemMb > 0 ? maxMemMb : usedMemMb,
                maxMemMb > 0 ? Math.min(100, (int) ((usedMemMb * 100) / maxMemMb)) : 50,
                formatUptime(uptimeSeconds),
                contentExists ? "text-emerald-400" : "text-amber-400", contentFolders
        );
    }

    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> jsonHealth() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "UP");
        health.put("timestamp", Instant.now().toString());

        Map<String, Object> db = new LinkedHashMap<>();
        try (Connection conn = dataSource.getConnection()) {
            db.put("status", "UP");
            db.put("product", conn.getMetaData().getDatabaseProductName());
            db.put("courses_count", courseRepository.count());
            db.put("lessons_count", lessonRepository.count());
        } catch (Exception e) {
            db.put("status", "DOWN");
            db.put("error", e.getMessage());
            health.put("status", "DEGRADED");
        }
        health.put("database", db);

        return ResponseEntity.ok(health);
    }

    private String formatUptime(long seconds) {
        long d = seconds / 86400;
        long h = (seconds % 86400) / 3600;
        long m = (seconds % 3600) / 60;
        long s = seconds % 60;
        if (d > 0) return String.format("%dd %dh %dm", d, h, m);
        if (h > 0) return String.format("%dh %dm %ds", h, m, s);
        return String.format("%dm %ds", m, s);
    }
}
