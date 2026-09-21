public class DiscountService {
    private DiscountStrategy strategy;

    public DiscountService(DiscountStrategy discountStrategy) {
        this.strategy = discountStrategy;
    }

    public void setStrategy(DiscountStrategy newDiscountStrategy) {
        this.strategy = newDiscountStrategy;
    }

    public void process() {
        this.strategy.calculateDiscount();
    }
}
