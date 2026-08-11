import random
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class ScenarioStep:
    const: float | None = field(default=None)
    min: float | None = field(default=None)
    max: float | None = field(default=None)
    duration: int | None = field(default=1)

    def __post_init__(self):
        if not self.is_valid():
            raise ValueError("Scenario step must have const or min and max values")

    def is_valid(self) -> bool:
        has_const = self.const is not None
        has_range = self.min is not None and self.max is not None
        return has_const or has_range


@dataclass
class Scenario:
    steps: list[ScenarioStep] = field(default_factory=ScenarioStep)
    description: str = field(default="")
    _index: int = field(default=0, init=False, repr=False)
    _counter: int = field(default=0, init=False, repr=False)

    def next(self) -> dict:
        step = self.steps[self._index]
        self._counter += 1

        value = self._get_value(step)

        if self._counter >= step.duration:
            self._counter = 0
            self._index = (self._index + 1) % len(self.steps)

        return {
            "glucose_value": value,
            "glucose_unit": "mmol/L",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def reset(self):
        self._index = 0

    @property
    def current(self) -> int:
        return self._index

    def _get_value(self, step: ScenarioStep) -> float:
        has_const = step.const is not None
        has_range = step.min is not None and step.max is not None

        if has_const:
            return step.const
        elif has_range:
            if step.min == step.max:
                return step.min
            else:
                return random.uniform(step.min, step.max)
        raise ValueError("Scenario step must have const or min and max values")
