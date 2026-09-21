public class CFO extends ExpenseHandler {
    @Override
    public boolean canApprove(double amount) {
        return true;
    }

    @Override
    public String handle(ExpenseRequest request) {
        return "CFO approved '" + request.getDescription() + "' ($" + request.getAmount() + ")";
    }
}
