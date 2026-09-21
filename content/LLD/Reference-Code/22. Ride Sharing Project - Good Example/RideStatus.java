public enum RideStatus {
    SCHEDULED("SCHEDULED"),
    ONGOING("ONGOING"),
    COMPLETED("COMPLETED");

    private final String value;

    RideStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return this.value;
    }
}
