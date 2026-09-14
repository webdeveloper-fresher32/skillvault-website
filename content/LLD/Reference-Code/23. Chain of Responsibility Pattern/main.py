from approvers import CFO, Director, Manager, TeamLead
from handler import ExpenseRequest

team_lead = TeamLead()
manager = Manager()
director = Director()
cfo = CFO()

team_lead.set_next(manager).set_next(director).set_next(cfo)

requests = [
    ExpenseRequest(500, "Office supplies"),
    ExpenseRequest(5_000, "Team offsite"),
    ExpenseRequest(30_000, "New servers"),
    ExpenseRequest(100_000, "Acquisition deal"),
]

for req in requests:
    print(team_lead.handle(req))
