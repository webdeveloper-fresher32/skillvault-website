import java.util.ArrayList;
import java.util.List;

public class Aggregation {
    // Student class (can exist independently)
    static class Student {
        private String name;
        private int rollNo;

        public Student(String name, int rollNo) {
            this.name = name;
            this.rollNo = rollNo;
        }

        public String getName() {
            return this.name;
        }

        public int getRollNo() {
            return this.rollNo;
        }
    }

    // Department class (contains Students - Aggregation)
    static class Department {
        private String deptName;
        private List<Student> students;

        public Department(String deptName) {
            this.deptName = deptName;
            this.students = new ArrayList<>();
        }

        public void addStudent(Student student) {
            this.students.add(student);
        }

        public void showStudents() {
            System.out.println("\nStudents in " + this.deptName + " Department:");
            for (Student student : this.students) {
                System.out.println("  - " + student.getName() + " (Roll No: " + student.getRollNo() + ")");
            }
        }
    }

    public static void main(String[] args) {
        // Creating Student objects (they exist independently)
        Student student1 = new Student("Rahul", 101);
        Student student2 = new Student("Priya", 102);
        Student student3 = new Student("Amit", 103);

        // Creating Department object
        Department csDept = new Department("Computer Science");

        // Adding students to department (Aggregation happening here!)
        csDept.addStudent(student1);
        csDept.addStudent(student2);
        csDept.addStudent(student3);

        // Display students
        csDept.showStudents();

        // IMPORTANT: Even if the department is dereferenced, students still exist!
        csDept = null;

        // Students are still alive and can be used
        System.out.println("\nStudent still exists: " + student1.getName());
        // Output: Student still exists: Rahul
    }
}
