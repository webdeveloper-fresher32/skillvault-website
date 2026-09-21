public class Car extends Vehicle {
    public Car(String numberPlate) {
        super(numberPlate);
    }

    @Override
    public double getFareAmount() {
        return 20.0;
    }
}
