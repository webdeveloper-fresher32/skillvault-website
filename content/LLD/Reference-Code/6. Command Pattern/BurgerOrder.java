public class BurgerOrder implements Order {
    private final Chef chef;

    public BurgerOrder(Chef chef) {
        this.chef = chef;
    }

    @Override
    public void execute() {
        System.out.println("Burger Order");
        this.chef.cookBurger();
    }
}
