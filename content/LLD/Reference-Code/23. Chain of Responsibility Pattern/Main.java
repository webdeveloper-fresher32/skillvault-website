import java.util.List;

public class Main {
    public static void main(String[] args) {
        TeamLead teamLead = new TeamLead();
        Manager manager = new Manager();
        Director director = new Director();
        CFO cfo = new CFO();

        teamLead.setNext(manager).setNext(director).setNext(cfo);

        List<ExpenseRequest> requests = List.of(
            new ExpenseRequest(500, "Office supplies"),
            new ExpenseRequest(5_000, "Team offsite"),
            new ExpenseRequest(30_000, "New servers"),
            new ExpenseRequest(100_000, "Acquisition deal")
        );

        for (ExpenseRequest req : requests) {
            System.out.println(teamLead.handle(req));
        }
    }
}
