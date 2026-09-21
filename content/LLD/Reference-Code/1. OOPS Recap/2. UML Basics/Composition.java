public class Composition {
    static class Engine {
        private String engineType;
        private int horsepower;

        public Engine(String engineType, int horsepower) {
            this.engineType = engineType;
            this.horsepower = horsepower;
        }

        public String getDetails() {
            return this.engineType + " Engine (" + this.horsepower + " HP)";
        }

        public void start() {
            System.out.println(this.engineType + " engine started!");
        }
    }

    // Car class (owns Engine - Composition)
    static class Car {
        private String brand;
        private String model;
        // COMPOSITION: Engine is created inside Car constructor
        private Engine engine;

        public Car(String brand, String model, String engineType, int horsepower) {
            this.brand = brand;
            this.model = model;
            this.engine = new Engine(engineType, horsepower);
        }

        public void getCarDetails() {
            System.out.println("\nCar: " + this.brand + " " + this.model);
            System.out.println("Engine: " + this.engine.getDetails());
        }

        public void startCar() {
            System.out.println("\nStarting " + this.brand + " " + this.model + "...");
            this.engine.start();
            System.out.println("Car is ready to drive!");
        }
    }

    public static void main(String[] args) {
        Car myCar = new Car("Toyota", "Fortuner", "Diesel", 204);
        myCar.getCarDetails();
        myCar.startCar();

        System.out.println("\n--- Destroying the car ---");
        myCar = null;

        System.out.println("Car and its Engine are both destroyed!");
    }
}
