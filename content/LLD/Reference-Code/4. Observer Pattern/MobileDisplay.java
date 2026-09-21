public class MobileDisplay implements Observer {
    @Override
    public void update(int temp) {
        System.out.println("Mobile temprature updated to " + temp);
    }
}
