public class GoodExample {
    interface Starter { void prepare(); }
    interface MainCourse { void prepare(); }
    interface Dessert { void prepare(); }

    // North Indian
    static class PaneerTikka implements Starter {
        public void prepare() { System.out.println("Preparing Paneer Tikka (North Indian Starter)"); }
    }
    static class ButterChicken implements MainCourse {
        public void prepare() { System.out.println("Preparing Butter Chicken (North Indian Main Course)"); }
    }
    static class GulabJamun implements Dessert {
        public void prepare() { System.out.println("Preparing Gulab Jamun (North Indian Dessert)"); }
    }

    // South Indian
    static class MeduVada implements Starter {
        public void prepare() { System.out.println("Preparing Medu Vada (South Indian Starter)"); }
    }
    static class Dosa implements MainCourse {
        public void prepare() { System.out.println("Preparing Dosa (South Indian Main Course)"); }
    }
    static class Payasam implements Dessert {
        public void prepare() { System.out.println("Preparing Payasam (South Indian Dessert)"); }
    }

    // Chinese
    static class SpringRolls implements Starter {
        public void prepare() { System.out.println("Preparing Spring Rolls (Chinese Starter)"); }
    }
    static class FriedRice implements MainCourse {
        public void prepare() { System.out.println("Preparing Fried Rice (Chinese Main Course)"); }
    }
    static class FortuneCookie implements Dessert {
        public void prepare() { System.out.println("Preparing Fortune Cookie (Chinese Dessert)"); }
    }

    interface CuisineFactory {
        Starter createStarter();
        MainCourse createMainCourse();
        Dessert createDessert();
    }

    static class NorthIndianCuisine implements CuisineFactory {
        public Starter createStarter() { return new PaneerTikka(); }
        public MainCourse createMainCourse() { return new ButterChicken(); }
        public Dessert createDessert() { return new GulabJamun(); }
    }

    static class ChineseCuisine implements CuisineFactory {
        public Starter createStarter() { return new SpringRolls(); }
        public MainCourse createMainCourse() { return new FriedRice(); }
        public Dessert createDessert() { return new FortuneCookie(); }
    }

    static class RestaurantService {
        private CuisineFactory factory;

        public RestaurantService(CuisineFactory factory) {
            this.factory = factory;
        }

        public void createMeal() {
            Starter starter = this.factory.createStarter();
            MainCourse mainCourse = this.factory.createMainCourse();
            Dessert dessert = this.factory.createDessert();

            starter.prepare();
            mainCourse.prepare();
            dessert.prepare();
        }

        public void changeCuisine(CuisineFactory newFactory) {
            this.factory = newFactory;
        }
    }

    public static void main(String[] args) {
        NorthIndianCuisine northIndianCuisine = new NorthIndianCuisine();
        RestaurantService restaurantService = new RestaurantService(northIndianCuisine);
        restaurantService.createMeal();

        ChineseCuisine chinese = new ChineseCuisine();
        restaurantService.changeCuisine(chinese);
        restaurantService.createMeal();
    }
}
