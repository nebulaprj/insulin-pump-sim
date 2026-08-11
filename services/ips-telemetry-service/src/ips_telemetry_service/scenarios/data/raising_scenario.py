from src.ips_telemetry_service.scenarios.scenario import Scenario, ScenarioStep

raising_scenario = Scenario(
    description="Raising Scenario",
    steps=[
        ScenarioStep(
            min=2.0,
            max=4.0,
            duration=1,
        ),
        ScenarioStep(
            min=3.0,
            max=5.0,
            duration=1,
        ),
        ScenarioStep(
            const=10.0,
            min=4.0,
            max=7.0,
            duration=4,
        ),
    ]
)