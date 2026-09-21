public class TransportService {
    private TransportMode mode;

    public TransportService(TransportMode mode) {
        this.mode = mode;
    }

    public void setMode(TransportMode newMode) {
        this.mode = newMode;
    }

    public void eta() {
        this.mode.eta();
    }

    public void directions() {
        this.mode.directions();
    }
}
