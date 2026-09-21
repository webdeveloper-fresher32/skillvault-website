import java.util.List;
import java.util.Map;

public class BadExample {
    static class UserService {
        public Map<String, String> login(String username, String password) {
            System.out.println("[UserService] Logging in: " + username);
            return Map.of("user_id", "U123", "name", username);
        }

        public Map<String, String> getProfile(String userId) {
            System.out.println("[UserService] Getting profile for: " + userId);
            return Map.of("user_id", userId, "name", "Rahul", "address", "Mumbai");
        }
    }

    static class OrderService {
        public List<Map<String, Object>> getOrders(String userId) {
            System.out.println("[OrderService] Getting orders for: " + userId);
            return List.of(
                Map.of("order_id", "ORD-1", "total", 1500),
                Map.of("order_id", "ORD-2", "total", 3000)
            );
        }
    }

    public static void main(String[] args) {
        UserService userService = new UserService();
        OrderService orderService = new OrderService();

        userService.login("test", "pass");
        userService.getProfile("hjk232322");
        System.out.println(orderService.getOrders("hjk232322"));
    }
}
