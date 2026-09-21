public class Client {
    public static void main(String[] args) {
        Location loc1 = new Location(15.3243, 81.2312);
        Location loc2 = new Location(16.6541, 82.8242);
        Location loc3 = new Location(15.9812, 82.8483);

        Car car = new Car("CS9999");
        Bike bike = new Bike("PQ4211");

        Driver driver1 = new Driver("Alice", "abc@example.com", loc2, car);
        Passenger passenger1 = new Passenger("Anirudh", "anirudh@gmail.com", loc2);

        RideMatchingService rideMatchingService = new RideMatchingService();
        rideMatchingService.addDriver(driver1);
        rideMatchingService.requestRide(passenger1, 50, new LuxuryFareStrategy());
    }
}
