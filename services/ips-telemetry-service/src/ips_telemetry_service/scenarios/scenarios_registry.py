from src.ips_telemetry_service.scenarios.data.low_high_scenario import low_high_scenario
from src.ips_telemetry_service.scenarios.data.raising_scenario import raising_scenario

scenarios = {
    "raising_scenario": raising_scenario,
    "low_high_scenario": low_high_scenario,
}


def get_all_scenarios():
    all_scenarios = [
        {
            "scenario_name": name,
            "description": scenario.description,
        } for name, scenario in scenarios.items()
    ]

    return all_scenarios
