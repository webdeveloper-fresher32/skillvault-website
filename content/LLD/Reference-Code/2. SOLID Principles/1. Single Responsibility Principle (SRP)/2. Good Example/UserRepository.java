public class UserRepository {
    private String db;
    private String user;
    private String password;

    public UserRepository(String db, String user, String password) {
        this.db = db;
        this.user = user;
        this.password = password;
    }

    public void saveToDatabase(User user) {
        System.out.println(user.getName() + " is getting saved to database");
    }

    public void deleteFromDatabase(User user) {
        System.out.println(user.getName() + " is getting deleted from database");
    }
}
