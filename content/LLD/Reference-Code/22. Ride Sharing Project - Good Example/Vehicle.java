public abstract class Vehicle {
    protected String numberPlate;

    public Vehicle(String numberPlate) {
        this.numberPlate = numberPlate;
    }

    public String getNumberPlate() {
        return this.numberPlate;
    }

    public abstract double getFareAmount();
}
