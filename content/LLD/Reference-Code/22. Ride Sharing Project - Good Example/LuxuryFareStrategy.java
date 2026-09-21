public class LuxuryFareStrategy implements FareStrategy {
    @Override
    public double calFare(Vehicle vehicle, double distance) {
        return vehicle.getFareAmount() * distance * 1.5;
    }
}
