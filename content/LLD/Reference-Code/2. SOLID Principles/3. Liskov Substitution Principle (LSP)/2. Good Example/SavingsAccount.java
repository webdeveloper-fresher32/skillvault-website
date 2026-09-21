public class SavingsAccount extends WithdrawableAccount {
    public SavingsAccount(int amount) {
        super(amount);
    }

    @Override
    public void deposit(int amount) {
        this.balance += amount;
        System.out.println("Amount deposited, current balance = " + this.balance);
    }

    @Override
    public void withdraw(int amount) {
        if (this.balance < amount) {
            System.out.println("Cannot withdraw, not enough balance");
        } else {
            this.balance -= amount;
            System.out.println("Amount withdrawn, current balance = " + this.balance);
        }
    }
}
