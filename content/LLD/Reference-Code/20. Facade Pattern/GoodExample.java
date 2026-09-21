import java.util.List;
import java.util.Map;

public class GoodExample {
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

    static class ApiGateway {
        private final UserService userService = new UserService();
        private final OrderService orderService = new OrderService();

        public void loginUser(String username, String password) {
            this.userService.login(username, password);
        }

        public void getUserProfile(String userId) {
            this.userService.getProfile(userId);
        }

        public void getOrderDetails(String userId) {
            this.orderService.getOrders(userId);
        }

        public void getAllDetails(String userId, String username, String password) {
            this.userService.login(username, password);
            this.userService.getProfile(userId);
            System.out.println(this.orderService.getOrders(userId));
        }
    }

    public static void main(String[] args) {
        ApiGateway apiGateway = new ApiGateway();
        apiGateway.getAllDetails("d23e32", "test", "123");
    }
}
