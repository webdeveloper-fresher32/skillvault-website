public class Ride {
    public Passenger passenger;
    public Driver driver;
    public double distance;
    public FareStrategy fareStrategy;
    public double fare = 0.0;
    public RideStatus status = RideStatus.SCHEDULED;

    public Ride(Passenger passenger, Driver driver, double distance, FareStrategy fareStrategy) {
        this.passenger = passenger;
        this.driver = driver;
        this.distance = distance;
        this.fareStrategy = fareStrategy;
    }

    public void calculateFare() {
        this.fare = this.fareStrategy.calFare(this.driver.getVehicle(), this.distance);
    }

    public double getRideFare() {
        return this.fare;
    }

    public void updateStatus(RideStatus newRideStatus) {
        this.status = newRideStatus;
        notifyUsers(this.status);
    }

    private void notifyUsers(RideStatus rideStatus) {
        this.driver.notify("Your ride is " + rideStatus.getValue());
        this.passenger.notify("Your ride status is " + rideStatus.getValue());
    }
}
