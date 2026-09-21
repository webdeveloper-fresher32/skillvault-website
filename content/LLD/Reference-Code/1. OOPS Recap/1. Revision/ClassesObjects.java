class Student {
    // Attributes
    private String name;
    private int age;
    private String gender;

    // Methods
    public Student(String name, int age, String gender) {
        this.name = name;
        this.age = age;
        this.gender = gender;
    }

    public void display() {
        System.out.println("My name is " + this.name + ", age is " + this.age + " and gender is " + this.gender);
    }

    public int getAge() {
        return this.age;
    }
}

public class ClassesObjects {
    public static void main(String[] args) {
        Student s1 = new Student("Anirudh", 22, "Male");
        System.out.println(s1.getAge());
    }
}
