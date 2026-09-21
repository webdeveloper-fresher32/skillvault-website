public class Manager extends ExpenseHandler {
    private static final double LIMIT = 10_000.0;

    @Override
    public boolean canApprove(double amount) {
        return amount <= LIMIT;
    }

    @Override
    public String handle(ExpenseRequest request) {
        if (canApprove(request.getAmount())) {
            return "Manager approved '" + request.getDescription() + "' ($" + request.getAmount() + ")";
        }
        return super.handle(request);
    }
}
