public class BadExample {
    interface Beverage {
        String getDescription();
        int getCost();
    }

    static class Coffee implements Beverage {
        @Override
        public String getDescription() {
            return "Plain coffee";
        }

        @Override
        public int getCost() {
            return 20;
        }
    }

    // Class explosion: creating a subclass for every combination
    static class CoffeeWithMilk implements Beverage {
        @Override
        public String getDescription() {
            return "Plain coffee with Milk";
        }

        @Override
        public int getCost() {
            return 30;
        }
    }

    public static void main(String[] args) {
        Coffee coffee1 = new Coffee();
        System.out.println(coffee1.getDescription());
        System.out.println(coffee1.getCost());

        CoffeeWithMilk coffee2 = new CoffeeWithMilk();
        System.out.println(coffee2.getDescription());
        System.out.println(coffee2.getCost());
    }
}
