public class Main {
    public static void main(String[] args) {
        NotificationChannel smsService = new SMSService();
        NotificationService ns = new NotificationService(smsService);
        ns.notify("Hey");
    }
}
