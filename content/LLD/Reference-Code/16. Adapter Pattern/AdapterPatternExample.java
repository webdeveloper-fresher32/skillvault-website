public class AdapterPatternExample {
    // Target Interface
    interface NotificationService {
        void send(String to, String title, String body);
    }

    static class EmailNotificationService implements NotificationService {
        @Override
        public void send(String to, String title, String body) {
            System.out.println("\nSending Email through EmailNotificationService");
            System.out.println("To = " + to);
            System.out.println("Title = " + title);
            System.out.println("Body = " + body);
        }
    }

    // Incompatible Adaptee class
    static class SendGridEmailService {
        public void sendEmail(String recipient, String subject, String content) {
            System.out.println("\nSending Email through SendGridEmailService");
            System.out.println("Recipient = " + recipient);
            System.out.println("Subject = " + subject);
            System.out.println("Content = " + content);
        }
    }

    // Adapter
    static class SendGridAdapter implements NotificationService {
        private final SendGridEmailService sendGridService;

        public SendGridAdapter(SendGridEmailService sendGridService) {
            this.sendGridService = sendGridService;
        }

        @Override
        public void send(String to, String title, String body) {
            this.sendGridService.sendEmail(to, title, body);
        }
    }

    static class OrderService {
        private final NotificationService emailService;

        public OrderService(NotificationService emailService) {
            this.emailService = emailService;
        }

        public void createOrder() {
            this.emailService.send("info@codeanddebug.in", "New Order", "Order has been placed");
        }
    }

    public static void main(String[] args) {
        SendGridEmailService sendGridService = new SendGridEmailService();
        SendGridAdapter sendGridAdapter = new SendGridAdapter(sendGridService);
        OrderService orderService = new OrderService(sendGridAdapter);
        orderService.createOrder();
    }
}
