public abstract class User {
    public String name;
    public String email;
    public Location location;

    public User(String name, String email, Location location) {
        this.name = name;
        this.email = email;
        this.location = location;
    }

    public Location getLocation() {
        return this.location;
    }

    public void setLocation(Location newLocation) {
        this.location = newLocation;
    }

    public abstract void notify(String msg);
}
