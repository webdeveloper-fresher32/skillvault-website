public class WalkMode implements TransportMode {
    @Override
    public void eta() {
        System.out.println("Walk will take 30 mins");
    }

    @Override
    public void directions() {
        System.out.println("Walk right to the road and then left");
    }
}
