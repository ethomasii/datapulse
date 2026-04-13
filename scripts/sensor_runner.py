#!/usr/bin/env python3
"""eltPulse Sensor Runner - Execute sensor checks and trigger pipelines."""

import sys
import os
from pathlib import Path
import json
import subprocess
from datetime import datetime
import logging

# Add the embedded_elt_builder package to path
sys.path.insert(0, str(Path(__file__).parent))

from embedded_elt_builder.sensors import sensor_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_sensor_config():
    """Load sensor configurations from file."""
    config_file = Path.home() / ".datapulse" / "sensors_config.json"
    if config_file.exists():
        try:
            with open(config_file, 'r') as f:
                configs = json.load(f)

            # Recreate sensors from config
            for config in configs:
                try:
                    from embedded_elt_builder.sensors import create_sensor
                    sensor = create_sensor(
                        config["type"],
                        config["name"],
                        config["pipeline_name"],
                        config["config"]
                    )
                    sensor_manager.register_sensor(sensor)
                    logger.info(f"Loaded sensor: {config['name']}")
                except Exception as e:
                    logger.error(f"Failed to load sensor {config['name']}: {e}")

        except Exception as e:
            logger.error(f"Failed to load sensor config: {e}")


def save_sensor_config():
    """Save current sensor configurations to file."""
    config_file = Path.home() / ".datapulse" / "sensors_config.json"
    config_file.parent.mkdir(parents=True, exist_ok=True)

    configs = []
    for sensor in sensor_manager.sensors.values():
        configs.append({
            "name": sensor.name,
            "pipeline_name": sensor.pipeline_name,
            "type": sensor.__class__.__name__.replace('Sensor', '').lower(),
            "config": sensor.config
        })

    try:
        with open(config_file, 'w') as f:
            json.dump(configs, f, indent=2)
        logger.info(f"Saved {len(configs)} sensor configurations")
    except Exception as e:
        logger.error(f"Failed to save sensor config: {e}")


def trigger_pipeline(pipeline_name: str, metadata: dict):
    """Trigger a pipeline execution."""
    try:
        logger.info(f"Triggering pipeline: {pipeline_name}")

        # For now, we'll use the existing CLI to run the pipeline
        # In a real implementation, this might integrate with your orchestrator or runner

        # Check if pipeline exists
        pipelines_dir = Path.cwd() / "pipelines"
        pipeline_found = False

        for tool_dir in ["dlt", "sling"]:
            pipeline_path = pipelines_dir / tool_dir / pipeline_name
            if pipeline_path.exists():
                pipeline_found = True

                # Run the pipeline (this is a simplified example)
                if tool_dir == "dlt":
                    # Assume dlt pipelines have a run.py file
                    run_script = pipeline_path / "run.py"
                    if run_script.exists():
                        result = subprocess.run([
                            sys.executable, str(run_script)
                        ], capture_output=True, text=True, cwd=pipeline_path)

                        if result.returncode == 0:
                            logger.info(f"Successfully ran dlt pipeline: {pipeline_name}")
                        else:
                            logger.error(f"Failed to run dlt pipeline: {pipeline_name}")
                            logger.error(f"Error: {result.stderr}")
                    else:
                        logger.warning(f"No run.py found for pipeline: {pipeline_name}")

                elif tool_dir == "sling":
                    # Assume sling pipelines have a config.yaml
                    config_file = pipeline_path / "config.yaml"
                    if config_file.exists():
                        # This would need sling CLI installed
                        result = subprocess.run([
                            "sling", "run", "--config", str(config_file)
                        ], capture_output=True, text=True)

                        if result.returncode == 0:
                            logger.info(f"Successfully ran sling pipeline: {pipeline_name}")
                        else:
                            logger.error(f"Failed to run sling pipeline: {pipeline_name}")
                            logger.error(f"Error: {result.stderr}")
                    else:
                        logger.warning(f"No config.yaml found for pipeline: {pipeline_name}")

                break

        if not pipeline_found:
            logger.error(f"Pipeline not found: {pipeline_name}")

    except Exception as e:
        logger.error(f"Failed to trigger pipeline {pipeline_name}: {e}")


def main():
    """Main sensor runner function."""
    logger.info("Starting eltPulse Sensor Runner")

    # Load sensor configurations
    load_sensor_config()

    if not sensor_manager.sensors:
        logger.info("No sensors configured. Exiting.")
        return

    logger.info(f"Checking {len(sensor_manager.sensors)} sensor(s)")

    # Check all sensors
    results = sensor_manager.check_all_sensors()

    triggered_count = 0
    for result in results:
        logger.info(f"Sensor triggered: {result['sensor_name']} -> {result['pipeline_name']}")
        logger.info(f"  Message: {result['message']}")
        logger.info(f"  Metadata: {result['metadata']}")

        # Trigger the pipeline
        trigger_pipeline(result['pipeline_name'], result['metadata'])
        triggered_count += 1

    if triggered_count == 0:
        logger.info("No sensors triggered")
    else:
        logger.info(f"Triggered {triggered_count} pipeline(s)")

    # Save updated sensor states
    save_sensor_config()

    logger.info("Sensor run completed")


if __name__ == "__main__":
    main()