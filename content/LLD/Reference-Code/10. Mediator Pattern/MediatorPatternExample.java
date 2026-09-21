import java.util.ArrayList;
import java.util.List;

interface AirTrafficControl {
    void registerAirplane(Airplane newAirplane);
    void sendMessage(String msg, Airplane sender);
}

class ControlTower implements AirTrafficControl {
    private final List<Airplane> airplanes = new ArrayList<>();

    @Override
    public void registerAirplane(Airplane newAirplane) {
        this.airplanes.add(newAirplane);
    }

    @Override
    public void sendMessage(String msg, Airplane sender) {
        for (Airplane airplane : this.airplanes) {
            if (!airplane.equals(sender)) {
                airplane.receiveMessage(msg, sender);
            }
        }
    }
}

class Airplane {
    private final String flightNumber;
    private final AirTrafficControl tower;

    public Airplane(String flightNumber, AirTrafficControl tower) {
        this.flightNumber = flightNumber;
        this.tower = tower;
        this.tower.registerAirplane(this);
    }

    public void sendMessage(String msg) {
        this.tower.sendMessage(msg, this);
    }

    public String getFlightNumber() {
        return this.flightNumber;
    }

    public void receiveMessage(String msg, Airplane whoSent) {
        System.out.println(this.flightNumber + " got " + msg + " from " + whoSent.getFlightNumber());
    }
}

public class MediatorPatternExample {
    public static void main(String[] args) {
        ControlTower controlTower = new ControlTower();
        Airplane airIndia = new Airplane("AIR-546", controlTower);
        Airplane spicejet = new Airplane("SPICE-87171", controlTower);
        Airplane indigo = new Airplane("IND-9911", controlTower);

        airIndia.sendMessage("I am getting on runway");

        Airplane express = new Airplane("EXP-1122", controlTower);
        express.sendMessage("I am getting on runway");
    }
}
