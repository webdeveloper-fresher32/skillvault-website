public abstract class Account {
    protected int balance;

    public Account(int balance) {
        this.balance = balance;
    }

    public abstract void deposit(int amount);

    public int getBalance() {
        return this.balance;
    }
}
