import java.util.ArrayList;
import java.util.List;

public class WeatherStation {
    private int temperature = 0;
    private final List<Observer> observers = new ArrayList<>();

    public void addObserver(Observer newObserver) {
        this.observers.add(newObserver);
    }

    public void removeObserver(Observer ob) {
        this.observers.remove(ob);
    }

    public void updateTemperature(int newTemp) {
        this.temperature = newTemp;
        notifyObservers();
    }

    public void notifyObservers() {
        for (Observer observer : this.observers) {
            observer.update(this.temperature);
        }
    }
}
