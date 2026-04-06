"""CLI commands for managing DataPulse schedules."""

import click
import json
from pathlib import Path
from typing import Dict, Any
from rich.console import Console
from rich.table import Table
from rich import box

from ..schedules import (
    schedule_manager,
    create_schedule,
    CronSchedule,
    IntervalSchedule,
    DailySchedule,
    WeeklySchedule
)

console = Console()


@click.group()
def schedules():
    """Manage DataPulse schedules for time-based pipeline orchestration.

    Schedules use cron expressions to automatically trigger pipelines at
    specified times or intervals.

    \b
    Examples:
        # Cron-based schedules
        elt schedules create daily_backup my_pipeline \\
            --type cron \\
            --config cron_expression="0 2 * * *",timezone=America/New_York

        # Interval-based schedules (every N minutes)
        elt schedules create hourly_check my_pipeline \\
            --type interval \\
            --config interval_minutes=60,timezone=UTC

        # Daily schedules
        elt schedules create morning_report my_pipeline \\
            --type daily \\
            --config hour=9,minute=0,timezone=America/New_York

        # Weekly schedules
        elt schedules create weekly_cleanup my_pipeline \\
            --type weekly \\
            --config days_of_week=[1,3,5],hour=18,minute=30,timezone=UTC

        # Management
        elt schedules list
        elt schedules check
        elt schedules delete daily_backup
    """
    pass


@schedules.command()
@click.argument("name")
@click.argument("pipeline_name")
@click.option("--type", "schedule_type", required=True,
              type=click.Choice([
                  "cron", "interval", "daily", "weekly"
              ]),
              help="Type of schedule to create")
@click.option("--config", required=True,
              help="Schedule configuration as key=value pairs (comma-separated)")
def create(name: str, pipeline_name: str, schedule_type: str, config: str):
    """Create a new schedule.

    CONFIG should be comma-separated key=value pairs.

    For cron: cron_expression="0 2 * * *",timezone=UTC
    For interval: interval_minutes=60,timezone=UTC
    For daily: hour=9,minute=0,timezone=America/New_York
    For weekly: days_of_week=[1,3,5],hour=18,minute=30,timezone=UTC
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
                    elif value.startswith('[') and value.endswith(']'):
                        # Parse list like [1,3,5]
                        value = [int(x.strip()) for x in value[1:-1].split(',') if x.strip()]

                    config_dict[key] = value

        # Validate required config based on schedule type
        if schedule_type == "cron":
            required = ["cron_expression"]
        elif schedule_type == "interval":
            required = ["interval_minutes"]
        elif schedule_type == "daily":
            required = ["hour"]
        elif schedule_type == "weekly":
            required = ["days_of_week", "hour"]
        else:
            required = []

        if not all(k in config_dict for k in required):
            console.print(f"[red]✗[/red] Missing required config: {', '.join(required)}")
            return

        # Create and register schedule
        schedule = create_schedule(schedule_type, name, pipeline_name, config_dict)
        schedule_manager.register_schedule(schedule)

        console.print(f"[green]✓[/green] Created schedule '{name}'")
        console.print(f"   Type: {schedule_type}")
        console.print(f"   Pipeline: {pipeline_name}")
        console.print(f"   Config: {config_dict}")

    except Exception as e:
        console.print(f"[red]✗[/red] Failed to create schedule: {str(e)}")


@schedules.command()
@click.option("--json", "output_json", is_flag=True, help="Output in JSON format")
def list(output_json: bool):
    """List all registered schedules."""
    schedules = schedule_manager.get_schedule_status()

    if output_json:
        import json
        print(json.dumps(schedules, indent=2))
        return

    if not schedules:
        console.print("[yellow]No schedules registered[/yellow]")
        return

    console.print(f"\n[bold]DataPulse Schedules[/bold] ({len(schedules)} total)\n")

    table = Table(box=box.SIMPLE_HEAD)
    table.add_column("Name", style="bold")
    table.add_column("Type", style="cyan")
    table.add_column("Pipeline", style="green")
    table.add_column("Cron Expression", style="yellow")
    table.add_column("Next Run", style="dim")

    for schedule in schedules:
        next_run = schedule.get("next_run", "Unknown")
        if next_run and next_run != "Unknown":
            # Format timestamp
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(next_run.replace('Z', '+00:00'))
                next_run = dt.strftime("%Y-%m-%d %H:%M:%S")
            except:
                pass

        table.add_row(
            schedule["name"],
            schedule["type"],
            schedule["pipeline_name"],
            schedule["cron_expression"],
            next_run
        )

    console.print(table)


@schedules.command()
def status():
    """Show detailed status of all schedules."""
    schedules = schedule_manager.get_schedule_status()

    if not schedules:
        console.print("[yellow]No schedules registered[/yellow]")
        return

    for schedule in schedules:
        console.print(f"\n[bold]{schedule['name']}[/bold] ({schedule['type']})")
        console.print(f"   Pipeline: {schedule['pipeline_name']}")
        console.print(f"   Cron Expression: {schedule['cron_expression']}")
        console.print(f"   Timezone: {schedule['timezone']}")
        console.print(f"   Last Run: {schedule.get('last_run', 'Never')}")
        console.print(f"   Next Run: {schedule.get('next_run', 'Unknown')}")


@schedules.command()
@click.option("--pipeline", help="Check only schedules for specific pipeline")
def check(pipeline: str = None):
    """Run schedule checks and show results."""
    console.print("[bold]Checking schedules...[/bold]")

    results = schedule_manager.check_all_schedules()

    if pipeline:
        results = [r for r in results if r["pipeline_name"] == pipeline]

    if not results:
        console.print("[green]✓[/green] No schedules triggered")
        return

    console.print(f"[yellow]⏰ {len(results)} schedule(s) triggered[/yellow]\n")

    for result in results:
        console.print(f"[bold]{result['schedule_name']}[/bold] → {result['pipeline_name']}")
        console.print(f"   {result['message']}")
        console.print(f"   Metadata: {result['metadata']}")
        console.print(f"   Time: {result['timestamp']}")
        console.print()


@schedules.command()
@click.argument("name")
def delete(name: str):
    """Delete a schedule."""
    try:
        schedule_manager.unregister_schedule(name)
        console.print(f"[green]✓[/green] Deleted schedule '{name}'")
    except Exception as e:
        console.print(f"[red]✗[/red] Failed to delete schedule: {str(e)}")


@schedules.command()
@click.argument("name")
@click.option("--config", required=True,
              help="Updated schedule configuration as key=value pairs (comma-separated)")
def update(name: str, config: str):
    """Update schedule configuration."""
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
                    elif value.startswith('[') and value.endswith(']'):
                        # Parse list like [1,3,5]
                        value = [int(x.strip()) for x in value[1:-1].split(',') if x.strip()]

                    config_dict[key] = value

        # Find existing schedule
        if name not in schedule_manager.schedules:
            console.print(f"[red]✗[/red] Schedule '{name}' not found")
            return

        schedule = schedule_manager.schedules[name]

        # Update config - this is tricky since schedules have different constructors
        # For now, we'll recreate the schedule with updated config
        old_status = schedule.get_status()
        old_status.update(config_dict)

        # Recreate schedule with updated config
        new_schedule = create_schedule(
            schedule.__class__.__name__.lower().replace('schedule', ''),
            name,
            schedule.pipeline_name,
            old_status
        )

        # Preserve last run time
        if schedule.last_run:
            new_schedule.last_run = schedule.last_run

        schedule_manager.register_schedule(new_schedule)

        console.print(f"[green]✓[/green] Updated schedule '{name}'")
        console.print(f"   New config: {old_status}")

    except Exception as e:
        console.print(f"[red]✗[/red] Failed to update schedule: {str(e)}")