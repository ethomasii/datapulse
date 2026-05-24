"""List command to show all pipelines."""

import click
from pathlib import Path
import yaml
from rich.console import Console
from rich.table import Table
from rich import box

console = Console()


@click.command()
@click.option("--repo-path", default=".", help="Path to the ELT pipelines repository")
@click.option("--tool", type=click.Choice(["dlt", "sling", "all"]), default="all", help="Filter by tool type")
@click.option("--enabled/--disabled", default=None, help="Filter by enabled status")
def list_pipelines(repo_path: str, tool: str, enabled: bool):
    """List all ELT pipelines in the repository.

    \b
    Example:
        elt list
        elt list --tool dlt
        elt list --enabled
        elt list --repo-path ~/my-pipelines
    """
    repo_path_obj = Path(repo_path).resolve()
    pipelines_dir = repo_path_obj / "pipelines"

    if not pipelines_dir.exists():
        console.print("[red]✗[/red] No pipelines directory found")
        console.print(f"Expected at: {pipelines_dir}")
        return

    console.print()
    console.print(f"[bold]ELT Pipelines[/bold] [dim]({repo_path_obj})[/dim]\n")

    # Create table
    table = Table(box=box.SIMPLE_HEAD, show_header=True)
    table.add_column("Status", width=8, style="cyan")
    table.add_column("Name", style="bold")
    table.add_column("Tool", width=8)
    table.add_column("Source", width=15)
    table.add_column("Destination", width=15)
    table.add_column("Description", style="dim")

    pipeline_count = 0

    # List dlt pipelines
    if tool in ["dlt", "all"]:
        dlt_dir = pipelines_dir / "dlt"
        if dlt_dir.exists():
            for pipeline_dir in sorted(dlt_dir.iterdir(), key=lambda x: x.name):
                if pipeline_dir.is_dir():
                    info = _get_pipeline_info(pipeline_dir, "dlt")
                    # Filter by enabled status if specified
                    if enabled is not None and info["enabled"] != enabled:
                        continue
                    _add_pipeline_row(table, info)
                    pipeline_count += 1

    # List Sling replications
    if tool in ["sling", "all"]:
        sling_dir = pipelines_dir / "sling"
        if sling_dir.exists():
            for pipeline_dir in sorted(sling_dir.iterdir(), key=lambda x: x.name):
                if pipeline_dir.is_dir():
                    info = _get_pipeline_info(pipeline_dir, "sling")
                    # Filter by enabled status if specified
                    if enabled is not None and info["enabled"] != enabled:
                        continue
                    _add_pipeline_row(table, info)
                    pipeline_count += 1

    if pipeline_count > 0:
        console.print(table)
        console.print(f"\n[dim]Total: {pipeline_count} pipeline(s)[/dim]\n")
    else:
        console.print("[yellow]No pipelines found matching the criteria[/yellow]\n")


def _get_pipeline_info(pipeline_dir: Path, tool_type: str) -> dict:
    """Get information about a pipeline."""
    dagster_yaml = pipeline_dir / "eltpulse.yaml"
    config_yaml = pipeline_dir / "config.yaml"
    replication_yaml = pipeline_dir / "replication.yaml"

    info = {
        "name": pipeline_dir.name,
        "tool": tool_type,
        "enabled": True,
        "source": "unknown",
        "destination": "unknown",
        "description": "No description",
    }

    # Read dagster.yaml
    if dagster_yaml.exists():
        try:
            with open(dagster_yaml) as f:
                config = yaml.safe_load(f) or {}
                info["description"] = config.get("description", info["description"])
                info["enabled"] = config.get("enabled", True)
        except:
            pass

    # Read pipeline config
    config_file = config_yaml if config_yaml.exists() else replication_yaml
    if config_file.exists():
        try:
            with open(config_file) as f:
                config = yaml.safe_load(f) or {}
                info["source"] = config.get("source_type", info["source"])
                info["destination"] = config.get("destination_type", info["destination"])
        except:
            pass

    return info


def _add_pipeline_row(table: Table, info: dict):
    """Add a pipeline row to the table."""
    status = "[green]✓ ON[/green]" if info["enabled"] else "[dim]✗ OFF[/dim]"
    tool_color = "cyan" if info["tool"] == "dlt" else "magenta"

    table.add_row(
        status,
        info["name"],
        f"[{tool_color}]{info['tool'].upper()}[/{tool_color}]",
        info["source"],
        info["destination"],
        info["description"][:50] + "..." if len(info["description"]) > 50 else info["description"]
    )
