public abstract class WithdrawableAccount extends Account {
    public WithdrawableAccount(int balance) {
        super(balance);
    }

    public abstract void withdraw(int amount);
}
