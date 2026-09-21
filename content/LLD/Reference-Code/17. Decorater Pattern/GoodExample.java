public class GoodExample {
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

    abstract static class AddOnDecorator implements Beverage {
        protected final Beverage coffee;

        public AddOnDecorator(Beverage coffee) {
            this.coffee = coffee;
        }
    }

    static class MilkDecorator extends AddOnDecorator {
        public MilkDecorator(Beverage coffee) {
            super(coffee);
        }

        @Override
        public String getDescription() {
            return this.coffee.getDescription() + ", Milk";
        }

        @Override
        public int getCost() {
            return this.coffee.getCost() + 20;
        }
    }

    static class WhipCreamDecorator extends AddOnDecorator {
        public WhipCreamDecorator(Beverage coffee) {
            super(coffee);
        }

        @Override
        public String getDescription() {
            return this.coffee.getDescription() + ", Whip Cream";
        }

        @Override
        public int getCost() {
            return this.coffee.getCost() + 50;
        }
    }

    static class SugarDecorator extends AddOnDecorator {
        public SugarDecorator(Beverage coffee) {
            super(coffee);
        }

        @Override
        public String getDescription() {
            return this.coffee.getDescription() + ", Sugar";
        }

        @Override
        public int getCost() {
            return this.coffee.getCost() + 5;
        }
    }

    public static void main(String[] args) {
        Beverage coffee = new Coffee();
        coffee = new MilkDecorator(coffee);
        coffee = new WhipCreamDecorator(coffee);
        System.out.println(coffee.getDescription());
        System.out.println(coffee.getCost());
    }
}
