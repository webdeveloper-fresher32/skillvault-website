public class Main {
    public static void main(String[] args) {
        DiscountStrategy diwaliStrategy = new DiwaliStrategy();
        DiscountStrategy holiStrategy = new HoliStrategy();

        DiscountService discountService = new DiscountService(diwaliStrategy);
        discountService.process();

        discountService.setStrategy(holiStrategy);
        discountService.process();
    }
}
