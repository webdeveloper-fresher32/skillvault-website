public class StandardFareStrategy implements FareStrategy {
    @Override
    public double calFare(Vehicle vehicle, double distance) {
        return vehicle.getFareAmount() * distance;
    }
}
