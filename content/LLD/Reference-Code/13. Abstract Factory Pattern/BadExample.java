public class BadExample {
    interface Food {
        void prepare();
    }

    // North Indian
    static class PaneerTikka implements Food {
        public void prepare() { System.out.println("Preparing Paneer Tikka (North Indian Starter)"); }
    }
    static class ButterChicken implements Food {
        public void prepare() { System.out.println("Preparing Butter Chicken (North Indian Main Course)"); }
    }
    static class GulabJamun implements Food {
        public void prepare() { System.out.println("Preparing Gulab Jamun (North Indian Dessert)"); }
    }

    // South Indian
    static class MeduVada implements Food {
        public void prepare() { System.out.println("Preparing Medu Vada (South Indian Starter)"); }
    }
    static class Dosa implements Food {
        public void prepare() { System.out.println("Preparing Dosa (South Indian Main Course)"); }
    }
    static class Payasam implements Food {
        public void prepare() { System.out.println("Preparing Payasam (South Indian Dessert)"); }
    }

    // Chinese
    static class SpringRolls implements Food {
        public void prepare() { System.out.println("Preparing Spring Rolls (Chinese Starter)"); }
    }
    static class FriedRice implements Food {
        public void prepare() { System.out.println("Preparing Fried Rice (Chinese Main Course)"); }
    }
    static class FortuneCookie implements Food {
        public void prepare() { System.out.println("Preparing Fortune Cookie (Chinese Dessert)"); }
    }

    static class RestaurantService {
        public void createMeal(String cuisineType) {
            Food starter, mainCourse, dessert;
            if ("north_indian".equalsIgnoreCase(cuisineType)) {
                starter = new PaneerTikka();
                mainCourse = new ButterChicken();
                dessert = new GulabJamun();
            } else if ("south_indian".equalsIgnoreCase(cuisineType)) {
                starter = new MeduVada();
                mainCourse = new Dosa();
                dessert = new Payasam();
            } else if ("chinese".equalsIgnoreCase(cuisineType)) {
                starter = new SpringRolls();
                mainCourse = new FriedRice();
                dessert = new FortuneCookie();
            } else {
                System.out.println("Cuisine not available!");
                return;
            }

            starter.prepare();
            mainCourse.prepare();
            dessert.prepare();
        }
    }

    public static void main(String[] args) {
        RestaurantService restaurant = new RestaurantService();
        restaurant.createMeal("north_indian");
    }
}
