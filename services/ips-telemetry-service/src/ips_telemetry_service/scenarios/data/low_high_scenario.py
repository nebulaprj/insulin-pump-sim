from src.ips_telemetry_service.scenarios.scenario import Scenario, ScenarioStep

low_high_scenario = Scenario(
    description="Low High Scenario",
    steps=[
        ScenarioStep(
            const=1.0,
            duration=2,
        ),
        ScenarioStep(
            const=10.0,
            duration=2,
        ),
    ]
)