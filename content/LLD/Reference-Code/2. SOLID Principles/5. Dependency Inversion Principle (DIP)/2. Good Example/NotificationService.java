public class NotificationService {
    private NotificationChannel channel;

    public NotificationService(NotificationChannel channel) {
        this.channel = channel;
    }

    public void notify(String message) {
        this.channel.send(message);
    }
}
