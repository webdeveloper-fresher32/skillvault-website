public class GoodExample {
    interface PaymentMethod {
        void pay(int amount);
    }

    static class UPIPayment implements PaymentMethod {
        @Override
        public void pay(int amount) {
            System.out.println("Paying through UPI of Rs." + amount);
        }
    }

    static class DebitCardPayment implements PaymentMethod {
        @Override
        public void pay(int amount) {
            System.out.println("Paying through debit card of Rs." + amount);
        }
    }

    static class CreditCardPayment implements PaymentMethod {
        @Override
        public void pay(int amount) {
            System.out.println("Paying through creditcard of Rs." + amount);
        }
    }

    static class PaymentProcessor {
        public void processPayment(PaymentMethod paymentMethod, int amount) {
            paymentMethod.pay(amount);
        }
    }

    public static void main(String[] args) {
        PaymentMethod debit = new DebitCardPayment();
        PaymentMethod credit = new CreditCardPayment();

        PaymentProcessor paymProcess = new PaymentProcessor();
        paymProcess.processPayment(debit, 500);
    }
}
