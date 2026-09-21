public class SharedFareStrategy implements FareStrategy {
    @Override
    public double calFare(Vehicle vehicle, double distance) {
        return vehicle.getFareAmount() * distance * 0.5;
    }
}
