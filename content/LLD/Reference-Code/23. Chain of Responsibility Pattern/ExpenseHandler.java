public abstract class ExpenseHandler {
    protected ExpenseHandler nextHandler;

    public ExpenseHandler setNext(ExpenseHandler handler) {
        this.nextHandler = handler;
        return handler;
    }

    public String handle(ExpenseRequest request) {
        if (this.nextHandler != null) {
            return this.nextHandler.handle(request);
        }
        return "No handler approved '" + request.getDescription() + "' ($" + request.getAmount() + ")";
    }

    public abstract boolean canApprove(double amount);
}
