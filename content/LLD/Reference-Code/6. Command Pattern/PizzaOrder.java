public class PizzaOrder implements Order {
    private final Chef chef;

    public PizzaOrder(Chef chef) {
        this.chef = chef;
    }

    @Override
    public void execute() {
        System.out.println("Pizza Order");
        this.chef.cookPizza();
    }
}
