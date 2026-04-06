"""CLI commands for managing DataPulse sensors."""

import click
import json
from pathlib import Path
from typing import Dict, Any
from rich.console import Console
from rich.table import Table
from rich import box

from ..sensors import (
    sensor_manager,
    create_sensor,
    S3FileCountSensor,
    CSVRowCountSensor
)

console = Console()


@click.group()
def sensors():
    """Manage DataPulse sensors for event-driven pipeline orchestration.

    Sensors monitor external systems and automatically trigger pipelines when
    conditions are met (e.g., file count thresholds, data volume, message queues).

    \b
    Examples:
        # Cloud Storage Sensors
        elt sensors create s3_monitor my_pipeline \\
            --type s3_file_count \\
            --config bucket_name=my-bucket,threshold=5,prefix=data/

        elt sensors create gcs_monitor my_pipeline \\
            --type gcs_file_count \\
            --config bucket_name=my-bucket,threshold=10,blob_pattern=.*\\.csv$

        elt sensors create adls_monitor my_pipeline \\
            --type adls_file_count \\
            --config account_name=myaccount,container_name=data,threshold=3

        # File System Sensors
        elt sensors create csv_monitor my_pipeline \\
            --type csv_row_count \\
            --config file_path=/data/input.csv,threshold=100

        # Messaging Sensors
        elt sensors create kafka_monitor my_pipeline \\
            --type kafka_message_count \\
            --config bootstrap_servers=localhost:9092,topic=my-topic,threshold=50

        elt sensors create sqs_monitor my_pipeline \\
            --type sqs_message_count \\
            --config queue_url=https://sqs.us-east-1.amazonaws.com/123/queue,threshold=10

        # Management
        elt sensors list
        elt sensors check
        elt sensors delete s3_monitor
    """
    pass


@sensors.command()
@click.argument("name")
@click.argument("pipeline_name")
@click.option("--type", "sensor_type", required=True,
              type=click.Choice([
                  "s3_file_count", "gcs_file_count", "adls_file_count",
                  "csv_row_count", "kafka_message_count", "sqs_message_count"
              ]),
              help="Type of sensor to create")
@click.option("--config", required=True,
              help="Sensor configuration as key=value pairs (comma-separated)")
def create(name: str, pipeline_name: str, sensor_type: str, config: str):
    """Create a new sensor.

    CONFIG should be comma-separated key=value pairs.
    For s3_file_count: bucket_name=my-bucket,threshold=5,prefix=data/,region=us-east-1
    For csv_row_count: file_path=/path/to/file.csv,threshold=100,delimiter=,,has_header=true
    """
    try:
        # Parse config string
        config_dict = {}
        if config:
            for pair in config.split(','):
                if '=' in pair:
                    key, value = pair.split('=', 1)
                    key = key.strip()
                    value = value.strip()

                    # Convert types
                    if value.lower() in ('true', 'false'):
                        value = value.lower() == 'true'
                    elif value.isdigit():
                        value = int(value)
                    elif value.replace('.', '').isdigit():
                        value = float(value)

                    config_dict[key] = value

        # Validate required config based on sensor type
        if sensor_type == "s3_file_count":
            required = ["bucket_name", "threshold"]
        elif sensor_type == "gcs_file_count":
            required = ["bucket_name", "threshold"]
        elif sensor_type == "adls_file_count":
            required = ["account_name", "container_name", "threshold"]
        elif sensor_type == "csv_row_count":
            required = ["file_path", "threshold"]
        elif sensor_type == "kafka_message_count":
            required = ["bootstrap_servers", "topic", "threshold"]
        elif sensor_type == "sqs_message_count":
            required = ["queue_url", "threshold"]
        else:
            required = []

        if not all(k in config_dict for k in required):
            console.print(f"[red]✗[/red] Missing required config: {', '.join(required)}")
            return

        # Create and register sensor
        sensor = create_sensor(sensor_type, name, pipeline_name, config_dict)
        sensor_manager.register_sensor(sensor)

        console.print(f"[green]✓[/green] Created sensor '{name}'")
        console.print(f"   Type: {sensor_type}")
        console.print(f"   Pipeline: {pipeline_name}")
        console.print(f"   Config: {config_dict}")

    except Exception as e:
        console.print(f"[red]✗[/red] Failed to create sensor: {str(e)}")


@sensors.command()
@click.option("--json", "output_json", is_flag=True, help="Output in JSON format")
def list(output_json: bool):
    """List all registered sensors."""
    sensors = sensor_manager.get_sensor_status()

    if output_json:
        import json
        print(json.dumps(sensors, indent=2))
        return

    if not sensors:
        console.print("[yellow]No sensors registered[/yellow]")
        return

    console.print(f"\n[bold]DataPulse Sensors[/bold] ({len(sensors)} total)\n")

    table = Table(box=box.SIMPLE_HEAD)
    table.add_column("Name", style="bold")
    table.add_column("Type", style="cyan")
    table.add_column("Pipeline", style="green")
    table.add_column("Status", style="yellow")
    table.add_column("Last Check", style="dim")

    for sensor in sensors:
        last_check = sensor.get("last_check", "Never")
        if last_check and last_check != "Never":
            # Format timestamp
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(last_check.replace('Z', '+00:00'))
                last_check = dt.strftime("%Y-%m-%d %H:%M:%S")
            except:
                pass

        table.add_row(
            sensor["name"],
            sensor["type"],
            sensor["pipeline_name"],
            "Active" if sensor.get("last_check") else "Inactive",
            last_check
        )

    console.print(table)


@sensors.command()
def status():
    """Show detailed status of all sensors."""
    sensors = sensor_manager.get_sensor_status()

    if not sensors:
        console.print("[yellow]No sensors registered[/yellow]")
        return

    for sensor in sensors:
        console.print(f"\n[bold]{sensor['name']}[/bold] ({sensor['type']})")
        console.print(f"   Pipeline: {sensor['pipeline_name']}")
        console.print(f"   Last Check: {sensor.get('last_check', 'Never')}")

        # Show config (hide sensitive info)
        config = sensor.get('config', {})
        safe_config = {}
        for k, v in config.items():
            if 'secret' in k.lower() or 'password' in k.lower() or 'token' in k.lower():
                safe_config[k] = "***"
            else:
                safe_config[k] = v

        console.print(f"   Config: {safe_config}")


@sensors.command()
@click.option("--pipeline", help="Check only sensors for specific pipeline")
def check(pipeline: str = None):
    """Run sensor checks and show results."""
    console.print("[bold]Checking sensors...[/bold]")

    results = sensor_manager.check_all_sensors()

    if pipeline:
        results = [r for r in results if r["pipeline_name"] == pipeline]

    if not results:
        console.print("[green]✓[/green] No sensors triggered")
        return

    console.print(f"[yellow]⚡ {len(results)} sensor(s) triggered[/yellow]\n")

    for result in results:
        console.print(f"[bold]{result['sensor_name']}[/bold] → {result['pipeline_name']}")
        console.print(f"   {result['message']}")
        console.print(f"   Metadata: {result['metadata']}")
        console.print(f"   Time: {result['timestamp']}")
        console.print()


@sensors.command()
@click.argument("name")
def delete(name: str):
    """Delete a sensor."""
    try:
        sensor_manager.unregister_sensor(name)
        console.print(f"[green]✓[/green] Deleted sensor '{name}'")
    except Exception as e:
        console.print(f"[red]✗[/red] Failed to delete sensor: {str(e)}")


@sensors.command()
@click.argument("name")
@click.option("--config", required=True,
              help="Updated sensor configuration as key=value pairs (comma-separated)")
def update(name: str, config: str):
    """Update sensor configuration."""
    try:
        # Parse config string
        config_dict = {}
        if config:
            for pair in config.split(','):
                if '=' in pair:
                    key, value = pair.split('=', 1)
                    key = key.strip()
                    value = value.strip()

                    # Convert types
                    if value.lower() in ('true', 'false'):
                        value = value.lower() == 'true'
                    elif value.isdigit():
                        value = int(value)
                    elif value.replace('.', '').isdigit():
                        value = float(value)

                    config_dict[key] = value

        # Find existing sensor
        if name not in sensor_manager.sensors:
            console.print(f"[red]✗[/red] Sensor '{name}' not found")
            return

        sensor = sensor_manager.sensors[name]

        # Update config
        sensor.config.update(config_dict)

        console.print(f"[green]✓[/green] Updated sensor '{name}'")
        console.print(f"   New config: {sensor.config}")

    except Exception as e:
        console.print(f"[red]✗[/red] Failed to update sensor: {str(e)}")