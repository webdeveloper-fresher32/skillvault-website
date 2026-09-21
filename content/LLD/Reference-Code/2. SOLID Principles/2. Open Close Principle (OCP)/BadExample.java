public class BadExample {
    static class PaymentProcessor {
        public void pay(String paymentMethod, int amount) {
            if ("UPI".equalsIgnoreCase(paymentMethod)) {
                System.out.println("Starting UPI transaction of Rs." + amount);
                System.out.println("UPI transaction finished");
            } else if ("credit_card".equalsIgnoreCase(paymentMethod)) {
                System.out.println("Starting credit card transaction of Rs." + amount);
                System.out.println("Credit card transaction finished");
            } else if ("net_banking".equalsIgnoreCase(paymentMethod)) {
                System.out.println("Starting net banking transaction of Rs." + amount);
                System.out.println("Net Banking transaction finished");
            }
        }
    }

    public static void main(String[] args) {
        PaymentProcessor payP = new PaymentProcessor();
        payP.pay("credit_card", 500);
    }
}
