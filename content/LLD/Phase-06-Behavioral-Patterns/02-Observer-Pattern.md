# Observer Pattern — Complete Guide

## Table of Contents
1. [The Problem Observer Solves](#1-the-problem-observer-solves)
2. [The Bad Example](#2-the-bad-example)
3. [The Good Example](#3-the-good-example)
4. [Real-World Tie-In](#4-real-world-tie-in)
5. [Complete Runnable Code](#5-complete-runnable-code)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem Observer Solves

A `WeatherStation` measures temperature/humidity/pressure and must push updates to any number of displays — a `MobileDisplay`, a `TVDisplay`, maybe a `WebDashboard` added next month. The station shouldn't need to know the concrete display classes, and displays should be addable/removable without editing the station's code.

```
Without Observer:
  WeatherStation.measurements_changed()
     mobile_display.update(temp, humidity, pressure)
     tv_display.update(temp, humidity, pressure)
     # add a new display type? edit this method again.
     # want to stop notifying TV at runtime? edit this method again.
```

**Observer Pattern**: define a one-to-many dependency so that when one object (the *subject*) changes state, all its dependents (*observers*) are notified and updated automatically — without the subject knowing their concrete types.

---

## 2. The Bad Example

```python
class WeatherStation:
    def __init__(self) -> None:
        self.mobile_display = None
        self.tv_display = None

    def set_measurements(self, temp: float, humidity: float, pressure: float) -> None:
        self.temp, self.humidity, self.pressure = temp, humidity, pressure
        if self.mobile_display:
            self.mobile_display.render(temp, humidity, pressure)
        if self.tv_display:
            self.tv_display.render(temp, humidity, pressure)
        # every new display type requires editing this class
```

Problems:
- `WeatherStation` is tightly coupled to `MobileDisplay` and `TVDisplay` by name.
- No way to add/remove a subscriber at runtime without new fields + new `if` branches.
- Violates Open/Closed and Single Responsibility (station now also manages display wiring).

---

## 3. The Good Example

```
┌───────────────────┐        ┌────────────────────┐
│    «interface»    │        │    «interface»      │
│      Subject       │◆──────│      Observer        │
│ + attach(obs)       │  has  │ + update(temp, ...)  │
│ + detach(obs)       │ many  └──────────────────────┘
│ + notify()          │                 ▲
└───────────────────┘                 │
          ▲                ┌──────────┼──────────┐
          │        ┌────────────────┐   ┌────────────────┐
┌──────────────────┐ MobileDisplay │   │  TVDisplay      │
│  WeatherStation   │────────────────┘   └────────────────┘
└──────────────────┘
```

`WeatherStation` only knows the `Observer` interface. Any class implementing `update()` can subscribe — zero changes to the station.

---

## 4. Real-World Tie-In

This is the backbone of pub/sub systems: stock-price tickers notifying multiple watchers, an `OrderStatus` notifying SMS/email/push-notification services, React's/Vue's reactivity systems, and Python's own `logging` module (handlers subscribe to a logger).

---

## 5. Complete Runnable Code

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True)
class WeatherData:
    temperature: float
    humidity: float
    pressure: float


class Observer(ABC):
    @abstractmethod
    def update(self, data: WeatherData) -> None:
        raise NotImplementedError


class Subject(ABC):
    @abstractmethod
    def attach(self, observer: Observer) -> None:
        raise NotImplementedError

    @abstractmethod
    def detach(self, observer: Observer) -> None:
        raise NotImplementedError

    @abstractmethod
    def notify(self) -> None:
        raise NotImplementedError


class WeatherStation(Subject):
    def __init__(self) -> None:
        self._observers: list[Observer] = []
        self._data: WeatherData | None = None

    def attach(self, observer: Observer) -> None:
        if observer not in self._observers:
            self._observers.append(observer)

    def detach(self, observer: Observer) -> None:
        if observer in self._observers:
            self._observers.remove(observer)

    def notify(self) -> None:
        for observer in self._observers:
            observer.update(self._data)  # type: ignore[arg-type]

    def set_measurements(self, temperature: float, humidity: float, pressure: float) -> None:
        self._data = WeatherData(temperature, humidity, pressure)
        self.notify()


class MobileDisplay(Observer):
    def update(self, data: WeatherData) -> None:
        print(f"[Mobile] {data.temperature}C, humidity {data.humidity}%")


class TVDisplay(Observer):
    def update(self, data: WeatherData) -> None:
        print(f"[TV] Current weather: {data.temperature}C / {data.pressure}hPa")


class WebDashboard(Observer):
    def update(self, data: WeatherData) -> None:
        print(f"[WebDashboard] temp={data.temperature} humidity={data.humidity} pressure={data.pressure}")


if __name__ == "__main__":
    station = WeatherStation()
    mobile = MobileDisplay()
    tv = TVDisplay()

    station.attach(mobile)
    station.attach(tv)

    station.set_measurements(temperature=29.5, humidity=65.0, pressure=1012.0)

    station.attach(WebDashboard())
    station.detach(tv)  # TV unsubscribes

    station.set_measurements(temperature=30.1, humidity=60.0, pressure=1010.5)
```

Expected output:
```
[Mobile] 29.5C, humidity 65.0%
[TV] Current weather: 29.5C / 1012.0hPa
[Mobile] 30.1C, humidity 60.0%
[WebDashboard] temp=30.1 humidity=60.0 pressure=1010.5
```

---

## 6. When to Use / Trade-offs

**Use Observer when:**
- One change must ripple out to a variable, unknown-in-advance number of dependents (notification systems, event-driven UIs, stock/order tickers).
- You want subject and observers to be loosely coupled — subject only depends on an interface.

**Trade-offs:**
- Notification order is generally undefined/insertion-order — don't rely on it for correctness.
- Memory leaks: if observers forget to `detach()`, the subject holds references forever ("lapsed listener" problem).
- Cascading updates can be hard to debug — Observer A's `update()` triggering Observer B indirectly can create update storms.
- For very high-frequency events, a synchronous `notify()` loop can become a bottleneck; production systems often use async queues/event buses instead.

| Aspect | Without Observer | With Observer |
|--------|-------------------|-----------------|
| Adding a new subscriber | Edit subject's code | `attach()` — zero subject changes |
| Coupling | Subject knows concrete display classes | Subject knows only the `Observer` interface |
| Removing a subscriber at runtime | Not supported cleanly | `detach()` |

---

## 7. Interview Q&A

**Q: What problem does the Observer pattern solve?**
Answer: It lets a one-to-many relationship exist between a subject and its dependents so that when the subject's state changes, all dependents are notified and updated automatically, without the subject being coupled to their concrete classes. Subscribers can be added or removed at runtime.

**Q: What's the difference between Observer and pub/sub (publish-subscribe)?**
Answer: Classic Observer has subjects hold direct references to observers and call them synchronously (tight but decoupled-by-interface coupling). Pub/sub introduces a broker/message-bus in between — publishers and subscribers never reference each other at all, messages are often asynchronous, and there can be topic-based filtering. Pub/sub is Observer's distributed-systems cousin.

**Q: How do you prevent memory leaks with Observer?**
Answer: Ensure every `attach()` has a matching `detach()` (e.g. in a UI component's teardown/unmount lifecycle), consider weak references (`weakref.ref` or `WeakSet` in Python) so the subject doesn't keep an observer alive after all other references are gone, and avoid observers that are anonymous lambdas you cannot later look up to remove.

**Q: Implement the Observer pattern from scratch for a stock-price ticker where multiple `Trader` objects subscribe to a `Stock`'s price changes.**
Answer:
```python
from abc import ABC, abstractmethod


class StockObserver(ABC):
    @abstractmethod
    def on_price_change(self, symbol: str, price: float) -> None:
        ...


class Stock:
    def __init__(self, symbol: str, price: float) -> None:
        self.symbol = symbol
        self._price = price
        self._observers: list[StockObserver] = []

    def subscribe(self, observer: StockObserver) -> None:
        self._observers.append(observer)

    def unsubscribe(self, observer: StockObserver) -> None:
        self._observers.remove(observer)

    def set_price(self, price: float) -> None:
        self._price = price
        for obs in self._observers:
            obs.on_price_change(self.symbol, price)


class Trader(StockObserver):
    def __init__(self, name: str) -> None:
        self.name = name

    def on_price_change(self, symbol: str, price: float) -> None:
        print(f"{self.name} notified: {symbol} is now ${price}")


stock = Stock("AAPL", 180.0)
alice, bob = Trader("Alice"), Trader("Bob")
stock.subscribe(alice)
stock.subscribe(bob)
stock.set_price(185.5)
stock.unsubscribe(bob)
stock.set_price(190.0)  # only Alice notified
```

**Q: Does Python's standard library have anything built on Observer?**
Answer: Yes — the `logging` module: a `Logger` (subject) can have multiple `Handler` objects (observers) attached via `addHandler()`, and every log record is pushed to all attached handlers. GUI frameworks (tkinter's event bindings, Qt's signals/slots) are also Observer variants.

**Q: How would you make Observer notifications asynchronous instead of blocking the caller?**
Answer: Instead of calling `observer.update()` synchronously in a loop, push the event onto a queue (e.g. `asyncio.Queue`, a thread pool executor, or a message broker like Redis pub/sub or Kafka) and let each observer consume independently. This decouples notification speed from the slowest observer and prevents one failing/slow observer from blocking others.
