class Bank {
    public String name;
    // Private attribute
    private int balance;

    public Bank(String name, int balance) {
        this.name = name;
        this.balance = balance;
    }

    // Getter
    public void getBalance() {
        System.out.println("Current balance = " + this.balance);
    }

    // Setter
    public void setBalance(int newAmount) {
        this.balance = newAmount;
    }

    private boolean isServerLive() {
        return true;
    }

    public void deposit(int amount) {
        if (this.isServerLive()) {
            this.balance += amount;
            System.out.println("Amount deposited, current balance = " + this.balance + "\n");
        } else {
            System.out.println("Server is down");
        }
    }

    public void withdraw(int amount) {
        if (amount > this.balance) {
            System.out.println("Not enough money in bank\n");
        } else {
            this.balance -= amount;
            System.out.println("Amount withdrawn, current balance = " + this.balance + "\n");
        }
    }
}

public class Encapsulation {
    public static void main(String[] args) {
        Bank acc = new Bank("Anirudh", 1000);
        acc.deposit(1000);
        acc.getBalance();
        acc.withdraw(500);
        // Note: acc.isServerLive() cannot be called from outside because it is private
    }
}
