"""Show command to display pipeline details."""

import click
from pathlib import Path
import yaml
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box

console = Console()


@click.command()
@click.argument("name")
@click.option("--repo-path", default=".", help="Path to the ELT pipelines repository")
def show(name: str, repo_path: str):
    """Show detailed information about a pipeline.

    \b
    Example:
        elt show my_pipeline
        elt show my_pipeline --repo-path ~/my-pipelines
    """
    repo_path_obj = Path(repo_path).resolve()
    pipelines_dir = repo_path_obj / "pipelines"

    # Search for pipeline in both dlt and sling directories
    found = None
    for tool in ["dlt", "sling"]:
        pipeline_dir = pipelines_dir / tool / name
        if pipeline_dir.exists():
            found = (pipeline_dir, tool)
            break

    if not found:
        console.print(f"[red]✗[/red] Pipeline '{name}' not found")
        console.print(f"\nSearched in:")
        console.print(f"  • {pipelines_dir}/dlt/{name}")
        console.print(f"  • {pipelines_dir}/sling/{name}")
        return

    pipeline_dir, tool = found

    # Read configuration files
    dagster_yaml_path = pipeline_dir / "eltpulse.yaml"
    config_yaml_path = pipeline_dir / "config.yaml"
    replication_yaml_path = pipeline_dir / "replication.yaml"

    dagster_config = {}
    pipeline_config = {}

    if dagster_yaml_path.exists():
        with open(dagster_yaml_path) as f:
            dagster_config = yaml.safe_load(f) or {}

    if config_yaml_path.exists():
        with open(config_yaml_path) as f:
            pipeline_config = yaml.safe_load(f) or {}

    if replication_yaml_path.exists():
        with open(replication_yaml_path) as f:
            pipeline_config = yaml.safe_load(f) or {}

    # Display pipeline information
    console.print()

    # Header
    status = "✓ Enabled" if dagster_config.get("enabled", True) else "✗ Disabled"
    status_color = "green" if dagster_config.get("enabled", True) else "red"

    console.print(Panel(
        f"[bold]{name}[/bold]\n"
        f"[dim]{dagster_config.get('description', 'No description')}[/dim]",
        title=f"[{status_color}]{status}[/{status_color}]",
        subtitle=f"[cyan]{tool.upper()}[/cyan]",
        border_style=status_color
    ))

    # Basic Info
    info_table = Table(show_header=False, box=box.SIMPLE, padding=(0, 2))
    info_table.add_column("Property", style="cyan")
    info_table.add_column("Value")

    info_table.add_row("Name", name)
    info_table.add_row("Tool", tool.upper())
    info_table.add_row("Source", pipeline_config.get("source_type", "unknown"))
    info_table.add_row("Destination", pipeline_config.get("destination_type", "unknown"))
    info_table.add_row("Group", dagster_config.get("group", "default"))
    info_table.add_row("Path", str(pipeline_dir.relative_to(repo_path_obj)))

    console.print(Panel(info_table, title="[bold]Pipeline Info[/bold]", border_style="blue"))

    # Schedule
    if dagster_config.get("schedule"):
        schedule = dagster_config["schedule"]
        schedule_enabled = schedule.get("enabled", False)
        schedule_status = "[green]✓ Enabled[/green]" if schedule_enabled else "[dim]✗ Disabled[/dim]"

        schedule_table = Table(show_header=False, box=box.SIMPLE, padding=(0, 2))
        schedule_table.add_column("Property", style="cyan")
        schedule_table.add_column("Value")

        schedule_table.add_row("Status", schedule_status)
        if schedule_enabled:
            schedule_table.add_row("Cron", schedule.get("cron_schedule", "Not set"))
            schedule_table.add_row("Timezone", schedule.get("timezone", "UTC"))

        console.print(Panel(schedule_table, title="[bold]Schedule[/bold]", border_style="yellow"))

    # Owners
    if dagster_config.get("owners"):
        owners = dagster_config["owners"]
        owners_text = "\n".join(f"• {owner}" for owner in owners)
        console.print(Panel(owners_text, title="[bold]Owners[/bold]", border_style="magenta"))

    # Tags
    if dagster_config.get("tags"):
        tags = dagster_config["tags"]
        tags_table = Table(show_header=False, box=box.SIMPLE, padding=(0, 2))
        tags_table.add_column("Key", style="cyan")
        tags_table.add_column("Value")

        for key, value in tags.items():
            tags_table.add_row(key, str(value))

        console.print(Panel(tags_table, title="[bold]Tags[/bold]", border_style="green"))

    # Kinds
    if dagster_config.get("kinds"):
        kinds = dagster_config["kinds"]
        kinds_text = " • ".join(f"[cyan]{kind}[/cyan]" for kind in kinds)
        console.print(Panel(kinds_text, title="[bold]Kinds[/bold]", border_style="blue"))

    # Retry Policy
    retry_table = Table(show_header=False, box=box.SIMPLE, padding=(0, 2))
    retry_table.add_column("Property", style="cyan")
    retry_table.add_column("Value")

    retry_table.add_row("Max Retries", str(dagster_config.get("retries", 2)))
    retry_table.add_row("Retry Delay", f"{dagster_config.get('retry_delay', 30)}s")

    if dagster_config.get("retry_backoff"):
        retry_table.add_row("Backoff", dagster_config["retry_backoff"])
    if dagster_config.get("retry_jitter"):
        retry_table.add_row("Jitter", dagster_config["retry_jitter"])

    console.print(Panel(retry_table, title="[bold]Retry Policy[/bold]", border_style="red"))

    console.print()
