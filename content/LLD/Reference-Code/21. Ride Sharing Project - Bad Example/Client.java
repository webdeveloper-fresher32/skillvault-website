public class Client {
    public static void main(String[] args) {
        Location loc1 = new Location(15.3243, 81.2312);
        Location loc2 = new Location(16.6541, 82.8242);
        Location loc3 = new Location(15.9812, 82.8483);

        Vehicle car = new Vehicle("CS9999", "Car");
        Vehicle bike = new Vehicle("PQ4211", "Bike");

        Driver driver1 = new Driver("Alice", loc2, car);
        Driver driver2 = new Driver("Bob", loc3, bike);

        Passenger passenger1 = new Passenger("Anirudh", loc1);
        Passenger passenger2 = new Passenger("Vandana", loc2);

        RideSharingServiceApp rideSharingService = new RideSharingServiceApp();
        rideSharingService.addDriver(driver1);
        rideSharingService.addDriver(driver2);
        rideSharingService.addPassenger(passenger1);
        rideSharingService.addPassenger(passenger2);

        rideSharingService.bookRide(passenger1, 30);
        rideSharingService.bookRide(passenger2, 50);
        rideSharingService.bookRide(passenger2, 50);
    }
}
