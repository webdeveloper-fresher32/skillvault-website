public class Director extends ExpenseHandler {
    private static final double LIMIT = 50_000.0;

    @Override
    public boolean canApprove(double amount) {
        return amount <= LIMIT;
    }

    @Override
    public String handle(ExpenseRequest request) {
        if (canApprove(request.getAmount())) {
            return "Director approved '" + request.getDescription() + "' ($" + request.getAmount() + ")";
        }
        return super.handle(request);
    }
}
