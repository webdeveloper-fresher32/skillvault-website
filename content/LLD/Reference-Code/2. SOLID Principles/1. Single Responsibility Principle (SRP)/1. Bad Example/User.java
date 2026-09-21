public class User {
    private String name;
    private int age;
    private String email;

    public User(String name, int age, String email) {
        this.name = name;
        this.age = age;
        this.email = email;
    }

    public void getUserInfo() {
        System.out.println("This is " + this.name + " and my age is " + this.age);
    }

    public boolean isAdult() {
        return this.age > 18;
    }

    // Violating SRP: User model handling database persistence logic
    public void saveToDatabase() {
        System.out.println(this.name + " is getting saved to Database");
    }

    public void deleteUserFromDatabase() {
        System.out.println(this.name + " is getting deleted from Database");
    }

    public static void main(String[] args) {
        User user = new User("Anirudh", 30, "info@cyx.com");
        user.getUserInfo();
        user.saveToDatabase();
    }
}
