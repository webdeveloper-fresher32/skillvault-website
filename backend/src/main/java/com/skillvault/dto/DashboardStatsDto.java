package com.skillvault.dto;

import java.util.List;
import java.util.Map;

public class DashboardStatsDto {
    private long totalCourses;
    private long totalLessons;
    private long completedLessons;
    private int streakDays = 7;
    private int studyHours;
    private List<Map<String, Object>> inProgressCourses;

    public DashboardStatsDto() {}

    public long getTotalCourses() { return totalCourses; }
    public void setTotalCourses(long totalCourses) { this.totalCourses = totalCourses; }
    public long getTotalLessons() { return totalLessons; }
    public void setTotalLessons(long totalLessons) { this.totalLessons = totalLessons; }
    public long getCompletedLessons() { return completedLessons; }
    public void setCompletedLessons(long completedLessons) { this.completedLessons = completedLessons; }
    public int getStreakDays() { return streakDays; }
    public void setStreakDays(int streakDays) { this.streakDays = streakDays; }
    public int getStudyHours() { return studyHours; }
    public void setStudyHours(int studyHours) { this.studyHours = studyHours; }
    public List<Map<String, Object>> getInProgressCourses() { return inProgressCourses; }
    public void setInProgressCourses(List<Map<String, Object>> inProgressCourses) { this.inProgressCourses = inProgressCourses; }
}
