public class Main {
    public static void main(String[] args) {
        Chef chef = new Chef();
        BurgerOrder burgerOrder = new BurgerOrder(chef);
        PizzaOrder pizzaOrder = new PizzaOrder(chef);

        Waiter waiter = new Waiter();
        waiter.takeOrder(burgerOrder);
    }
}
