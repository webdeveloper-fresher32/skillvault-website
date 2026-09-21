public class FixedDepositAccount extends Account {
    public FixedDepositAccount(int balance) {
        super(balance);
    }

    @Override
    public void deposit(int amount) {
        this.balance += amount;
        System.out.println("Amount deposited, current balance = " + this.balance);
    }
}
