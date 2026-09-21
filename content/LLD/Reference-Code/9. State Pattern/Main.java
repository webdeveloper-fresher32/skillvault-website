public class Main {
    public static void main(String[] args) {
        BikeMode b = new BikeMode();
        TransportService transportService = new TransportService(b);
        transportService.eta();
        transportService.directions();
    }
}
