from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ExpenseRequest:
    amount: float
    description: str


class ExpenseHandler(ABC):
    def __init__(self):
        self._next_handler: "ExpenseHandler | None" = None

    def set_next(self, handler: "ExpenseHandler") -> "ExpenseHandler":
        self._next_handler = handler
        return handler

    def handle(self, request: ExpenseRequest) -> str:
        if self._next_handler:
            return self._next_handler.handle(request)
        return f"No handler approved '{request.description}' (${request.amount})"

    @abstractmethod
    def can_approve(self, amount: float) -> bool:
        pass
