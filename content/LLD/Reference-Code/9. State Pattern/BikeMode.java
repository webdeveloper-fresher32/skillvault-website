public class BikeMode implements TransportMode {
    @Override
    public void eta() {
        System.out.println("Bike will take 15 mins");
    }

    @Override
    public void directions() {
        System.out.println("Go left to the road");
    }
}
