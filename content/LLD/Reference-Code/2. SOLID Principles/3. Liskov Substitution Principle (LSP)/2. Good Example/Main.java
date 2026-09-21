public class Main {
    public static void main(String[] args) {
        SavingsAccount s = new SavingsAccount(1000);
        s.deposit(1000);
        s.withdraw(500);

        FixedDepositAccount fd = new FixedDepositAccount(1000);
        fd.deposit(1000);
    }
}
