public class GoodExample {
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

    static class Pasta implements Food {
        @Override
        public void prepare() {
            System.out.println("Preparing pasta");
        }
    }

    static class FoodFactory {
        public static Food createFood(String foodType) {
            if ("pizza".equalsIgnoreCase(foodType)) {
                return new Pizza();
            } else if ("burger".equalsIgnoreCase(foodType)) {
                return new Burger();
            } else if ("pasta".equalsIgnoreCase(foodType)) {
                return new Pasta();
            }
            return null;
        }
    }

    static class RestaurantService {
        public Food createOrder(String foodType) {
            Food f = FoodFactory.createFood(foodType);
            if (f == null) {
                System.out.println("Cannot prepare food");
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
