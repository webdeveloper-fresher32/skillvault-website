public class TvDisplay implements Observer {
    @Override
    public void update(int temp) {
        System.out.println("TV temprature updated to " + temp);
    }
}
