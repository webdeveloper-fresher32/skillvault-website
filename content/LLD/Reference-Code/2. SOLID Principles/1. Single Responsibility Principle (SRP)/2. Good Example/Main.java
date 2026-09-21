public class Main {
    public static void main(String[] args) {
        User userObj = new User("Anirudh", 30, "info@cyx.com");
        UserRepository userRepo = new UserRepository("userDB", "root", "root");

        userObj.getUserInfo();
        userRepo.saveToDatabase(userObj);
    }
}
