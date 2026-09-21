public class Location {
    private final double lat;
    private final double lon;

    public Location(double lat, double lon) {
        this.lat = lat;
        this.lon = lon;
    }

    public double getLatitude() {
        return this.lat;
    }

    public double getLongitude() {
        return this.lon;
    }

    public double calcDistance(Location loc) {
        double dx = this.getLatitude() - loc.getLatitude();
        double dy = this.getLongitude() - loc.getLongitude();
        return Math.sqrt(dx * dx + dy * dy);
    }
}
