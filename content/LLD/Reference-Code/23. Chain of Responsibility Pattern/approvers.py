from handler import ExpenseHandler, ExpenseRequest


class TeamLead(ExpenseHandler):
    LIMIT = 1_000

    def can_approve(self, amount: float) -> bool:
        return amount <= self.LIMIT

    def handle(self, request: ExpenseRequest) -> str:
        if self.can_approve(request.amount):
            return f"TeamLead approved '{request.description}' (${request.amount})"
        return super().handle(request)


class Manager(ExpenseHandler):
    LIMIT = 10_000

    def can_approve(self, amount: float) -> bool:
        return amount <= self.LIMIT

    def handle(self, request: ExpenseRequest) -> str:
        if self.can_approve(request.amount):
            return f"Manager approved '{request.description}' (${request.amount})"
        return super().handle(request)


class Director(ExpenseHandler):
    LIMIT = 50_000

    def can_approve(self, amount: float) -> bool:
        return amount <= self.LIMIT

    def handle(self, request: ExpenseRequest) -> str:
        if self.can_approve(request.amount):
            return f"Director approved '{request.description}' (${request.amount})"
        return super().handle(request)


class CFO(ExpenseHandler):
    def can_approve(self, amount: float) -> bool:
        return True

    def handle(self, request: ExpenseRequest) -> str:
        return f"CFO approved '{request.description}' (${request.amount})"
