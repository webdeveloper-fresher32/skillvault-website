import java.util.ArrayList;
import java.util.List;

public class RideMatchingService {
    private final List<Driver> availableDrivers = new ArrayList<>();

    public void addDriver(Driver driver) {
        this.availableDrivers.add(driver);
    }

    public void requestRide(Passenger passenger, double distance, FareStrategy strategy) {
        if (this.availableDrivers.isEmpty()) {
            passenger.notify("No Drivers available");
            return;
        }

        // Nearest Driver
        Driver nearestDriver = findNearestDriver(passenger.getLocation());
        this.availableDrivers.remove(nearestDriver);

        Ride ride = new Ride(passenger, nearestDriver, distance, strategy);
        ride.calculateFare();

        passenger.notify("Ride scheduled with fare Rs." + ride.getRideFare());
        nearestDriver.notify("You have one new ride for Rs" + ride.getRideFare());

        ride.updateStatus(RideStatus.ONGOING);

        // After some time
        ride.updateStatus(RideStatus.COMPLETED);
        this.availableDrivers.add(nearestDriver);
    }

    private Driver findNearestDriver(Location passengerLocation) {
        Driver assignedDriver = null;
        double minDistance = Double.POSITIVE_INFINITY;
        for (Driver driver : this.availableDrivers) {
            double dist = driver.getLocation().calcDistance(passengerLocation);
            if (dist < minDistance) {
                minDistance = dist;
                assignedDriver = driver;
            }
        }
        return assignedDriver;
    }
}
