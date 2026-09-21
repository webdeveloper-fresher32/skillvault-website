import java.util.ArrayList;
import java.util.List;

public class RideSharingServiceApp {
    public List<Driver> drivers = new ArrayList<>();
    public List<Passenger> passengers = new ArrayList<>();

    public void addDriver(Driver driver) {
        this.drivers.add(driver);
    }

    public void addPassenger(Passenger passenger) {
        this.passengers.add(passenger);
    }

    private double calcFare(Vehicle vehicle, double distance) {
        if ("Car".equalsIgnoreCase(vehicle.type)) {
            return distance * 20;
        } else if ("Bike".equalsIgnoreCase(vehicle.type.trim())) {
            return distance * 12;
        } else {
            return distance * 8;
        }
    }

    private double calcDistance(Location loc1, Location loc2) {
        double dx = loc1.getLatitude() - loc2.getLatitude();
        double dy = loc1.getLongitude() - loc2.getLongitude();
        return Math.sqrt(dx * dx + dy * dy);
    }

    public void bookRide(Passenger passenger, double distance) {
        if (this.drivers.isEmpty()) {
            System.out.println("No drivers available for " + passenger.name);
            return;
        }

        // Hard coded logic assignment - Find nearest driver (Brute Force O(n))
        Driver assignedDriver = null;
        double minDistance = Double.POSITIVE_INFINITY;
        for (Driver driver : this.drivers) {
            double currentDriverDistance = calcDistance(passenger.location, driver.location);
            if (currentDriverDistance < minDistance) {
                minDistance = currentDriverDistance;
                assignedDriver = driver;
            }
        }

        double expectedFare = calcFare(assignedDriver.vehicle, distance);

        System.out.printf("Ride booked for %s with driver %s with fare of Rs.%.1f%n",
            passenger.name, assignedDriver.name, expectedFare);
        System.out.printf("Driver is on the way and is %.2fkm away%n", minDistance);
    }
}
