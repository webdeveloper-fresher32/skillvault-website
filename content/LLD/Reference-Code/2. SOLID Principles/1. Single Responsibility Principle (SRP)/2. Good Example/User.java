public class User {
    private String name;
    private int age;
    private String email;

    public User(String name, int age, String email) {
        this.name = name;
        this.age = age;
        this.email = email;
    }

    public String getName() {
        return this.name;
    }

    public int getAge() {
        return this.age;
    }

    public String getEmail() {
        return this.email;
    }

    public void getUserInfo() {
        System.out.println("This is " + this.name + " and my age is " + this.age);
    }

    public boolean isAdult() {
        return this.age > 18;
    }
}
