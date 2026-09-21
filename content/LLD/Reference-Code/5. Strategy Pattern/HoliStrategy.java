public class HoliStrategy implements DiscountStrategy {
    @Override
    public void calculateDiscount() {
        System.out.println("Applying holi discount of 10%");
    }
}
