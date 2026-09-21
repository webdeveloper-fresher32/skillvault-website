public class Association {
    static class Student {
        private String name;

        public Student(String name) {
            this.name = name;
        }

        public String getName() {
            return this.name;
        }
    }

    static class Teacher {
        private String name;

        public Teacher(String name) {
            this.name = name;
        }

        public String getName() {
            return this.name;
        }

        public void teach(Student s) {
            System.out.println(this.name + " is teaching " + s.getName());
        }
    }

    public static void main(String[] args) {
        Teacher teacher1 = new Teacher("Sharma Sir");
        Student student1 = new Student("Rahul");

        teacher1.teach(student1); // teach() takes Student type as parameter
    }
}
