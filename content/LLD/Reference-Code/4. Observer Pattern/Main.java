public class Main {
    public static void main(String[] args) {
        WeatherStation ws = new WeatherStation();
        TvDisplay tv = new TvDisplay();

        ws.addObserver(tv);
        ws.updateTemperature(30);

        MobileDisplay mobile = new MobileDisplay();
        ws.addObserver(mobile);
        ws.updateTemperature(35);

        ws.removeObserver(tv);
        ws.updateTemperature(40);
    }
}
