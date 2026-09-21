public class NotificationService {
    private EmailService emailService;
    private SMSService smsService;

    public NotificationService() {
        this.emailService = new EmailService();
        this.smsService = new SMSService();
    }

    public void notifyByEmail(String message) {
        this.emailService.sendEmail(message);
    }

    public void notifyBySMS(String message) {
        this.smsService.sendSMS(message);
    }

    public static void main(String[] args) {
        NotificationService ns = new NotificationService();
        ns.notifyByEmail("Good morning");
        ns.notifyBySMS("Hey");
    }
}
