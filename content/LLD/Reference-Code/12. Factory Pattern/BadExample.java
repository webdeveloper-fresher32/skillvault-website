public class BadExample {
    interface Food {
        void prepare();
    }

    static class Pizza implements Food {
        @Override
        public void prepare() {
            System.out.println("Preparing pizza");
        }
    }

    static class Burger implements Food {
        @Override
        public void prepare() {
            System.out.println("Preparing burger");
        }
    }

    // Responsible for making objects directly inside service
    static class RestaurantService {
        public Food createOrder(String foodType) {
            Food f;
            if ("pizza".equalsIgnoreCase(foodType)) {
                f = new Pizza();
            } else if ("burger".equalsIgnoreCase(foodType)) {
                f = new Burger();
            } else {
                System.out.println("Invalid food type");
                return null;
            }
            f.prepare();
            return f;
        }
    }

    public static void main(String[] args) {
        RestaurantService restaurantService = new RestaurantService();
        restaurantService.createOrder("pizza");
        restaurantService.createOrder("burger");
    }
}
