public class Bike extends Vehicle {
    public Bike(String numberPlate) {
        super(numberPlate);
    }

    @Override
    public double getFareAmount() {
        return 10.0;
    }
}
