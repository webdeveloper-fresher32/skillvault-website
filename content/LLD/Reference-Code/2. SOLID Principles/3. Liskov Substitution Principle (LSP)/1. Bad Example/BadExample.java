public class BadExample {
    abstract static class BankAccount {
        protected int balance;

        public BankAccount(int balance) {
            this.balance = balance;
        }

        public abstract void withdraw(int amount);
        public abstract void deposit(int amount);
    }

    static class SavingsAccount extends BankAccount {
        public SavingsAccount(int balance) {
            super(balance);
        }

        @Override
        public void withdraw(int amount) {
            if (this.balance < amount) {
                System.out.println("Cannot withdraw, not enough balance");
            } else {
                this.balance -= amount;
                System.out.println("Amount withdrawn, remaining balance " + this.balance);
            }
        }

        @Override
        public void deposit(int amount) {
            this.balance += amount;
            System.out.println("Amount deposited, remaining balance " + this.balance);
        }
    }

    static class FixedDepositAccount extends BankAccount {
        public FixedDepositAccount(int balance) {
            super(balance);
        }

        @Override
        public void withdraw(int amount) {
            throw new UnsupportedOperationException("Cannot withdraw from FD");
        }

        @Override
        public void deposit(int amount) {
            this.balance += amount;
            System.out.println("Amount deposited, remaining balance " + this.balance);
        }
    }

    public static void main(String[] args) {
        FixedDepositAccount fd = new FixedDepositAccount(1000);
        fd.deposit(1000);
        try {
            fd.withdraw(500);
        } catch (UnsupportedOperationException e) {
            System.out.println("Exception caught: " + e.getMessage());
        }
    }
}
