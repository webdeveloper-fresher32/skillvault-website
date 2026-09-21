public class Passenger extends User {
    public Passenger(String name, String email, Location location) {
        super(name, email, location);
    }

    @Override
    public void notify(String msg) {
        System.out.println("Notify to passenger(" + this.name + ") = " + msg);
    }
}
