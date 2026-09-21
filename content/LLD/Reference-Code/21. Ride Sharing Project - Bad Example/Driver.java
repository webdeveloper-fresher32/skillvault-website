public class Driver {
    public String name;
    public Location location;
    public Vehicle vehicle;

    public Driver(String name, Location location, Vehicle vehicle) {
        this.name = name;
        this.location = location;
        this.vehicle = vehicle;
    }

    public Location getLocation() {
        return this.location;
    }

    public void setLocation(Location location) {
        this.location = location;
    }
}
