"""Validate command to check pipeline configurations."""

import click
from pathlib import Path
import yaml
from rich.console import Console
from rich.table import Table
from rich import box

console = Console()


@click.command()
@click.option("--repo-path", default=".", help="Path to the ELT pipelines repository")
def validate(repo_path: str):
    """Validate all pipeline configurations.

    Checks for:
    - Missing required files (eltpulse.yaml, pipeline.py/replication.yaml)
    - Invalid YAML syntax
    - Missing required fields
    - Invalid cron schedules

    \b
    Example:
        elt validate
        elt validate --repo-path ~/my-pipelines
    """
    repo_path_obj = Path(repo_path).resolve()
    pipelines_dir = repo_path_obj / "pipelines"

    if not pipelines_dir.exists():
        console.print("[red]✗[/red] No pipelines directory found")
        console.print(f"Expected at: {pipelines_dir}")
        return

    console.print("\n[bold]Validating ELT Pipelines...[/bold]\n")

    issues = []
    valid_count = 0
    total_count = 0

    # Validate dlt pipelines
    dlt_dir = pipelines_dir / "dlt"
    if dlt_dir.exists():
        for pipeline_dir in dlt_dir.iterdir():
            if pipeline_dir.is_dir():
                total_count += 1
                pipeline_issues = _validate_dlt_pipeline(pipeline_dir)
                if pipeline_issues:
                    issues.extend(pipeline_issues)
                else:
                    valid_count += 1

    # Validate Sling replications
    sling_dir = pipelines_dir / "sling"
    if sling_dir.exists():
        for pipeline_dir in sling_dir.iterdir():
            if pipeline_dir.is_dir():
                total_count += 1
                pipeline_issues = _validate_sling_pipeline(pipeline_dir)
                if pipeline_issues:
                    issues.extend(pipeline_issues)
                else:
                    valid_count += 1

    # Display results
    if issues:
        console.print("[yellow]⚠ Issues Found:[/yellow]\n")
        for issue in issues:
            console.print(f"  [red]✗[/red] {issue}")
        console.print()

    # Summary table
    summary = Table(show_header=False, box=box.SIMPLE)
    summary.add_column("", style="cyan")
    summary.add_column("", justify="right")

    summary.add_row("Total Pipelines", str(total_count))
    summary.add_row("Valid", f"[green]{valid_count}[/green]")
    summary.add_row("Issues", f"[red]{len(issues)}[/red]" if issues else "[green]0[/green]")

    console.print(summary)
    console.print()

    if not issues:
        console.print("[green]✓ All pipelines are valid![/green]")
    else:
        console.print(f"[yellow]⚠ Found {len(issues)} issue(s) in {total_count - valid_count} pipeline(s)[/yellow]")


def _validate_dlt_pipeline(pipeline_dir: Path) -> list[str]:
    """Validate a dlt pipeline. Returns list of issues."""
    issues = []
    pipeline_name = pipeline_dir.name

    # Check for required files
    dagster_yaml = pipeline_dir / "eltpulse.yaml"
    pipeline_py = pipeline_dir / "pipeline.py"

    if not dagster_yaml.exists():
        issues.append(f"dlt/{pipeline_name}: Missing eltpulse.yaml")
    else:
        # Validate YAML syntax and required fields
        try:
            with open(dagster_yaml) as f:
                config = yaml.safe_load(f)
                if not config:
                    issues.append(f"dlt/{pipeline_name}: Empty eltpulse.yaml")
                else:
                    # Check for description
                    if not config.get("description"):
                        issues.append(f"dlt/{pipeline_name}: Missing description in eltpulse.yaml")

                    # Validate schedule if present
                    if config.get("schedule", {}).get("enabled"):
                        if not config["schedule"].get("cron_schedule"):
                            issues.append(f"dlt/{pipeline_name}: Schedule enabled but no cron_schedule defined")

        except yaml.YAMLError as e:
            issues.append(f"dlt/{pipeline_name}: Invalid YAML in eltpulse.yaml - {e}")

    if not pipeline_py.exists():
        issues.append(f"dlt/{pipeline_name}: Missing pipeline.py")
    else:
        # Check if pipeline.py has a run() function
        try:
            with open(pipeline_py) as f:
                content = f.read()
                if "def run(" not in content:
                    issues.append(f"dlt/{pipeline_name}: pipeline.py missing run() function")
        except Exception as e:
            issues.append(f"dlt/{pipeline_name}: Could not read pipeline.py - {e}")

    return issues


def _validate_sling_pipeline(pipeline_dir: Path) -> list[str]:
    """Validate a Sling pipeline. Returns list of issues."""
    issues = []
    pipeline_name = pipeline_dir.name

    # Check for required files
    dagster_yaml = pipeline_dir / "eltpulse.yaml"
    replication_yaml = pipeline_dir / "replication.yaml"

    if not dagster_yaml.exists():
        issues.append(f"sling/{pipeline_name}: Missing eltpulse.yaml")
    else:
        # Validate YAML syntax
        try:
            with open(dagster_yaml) as f:
                config = yaml.safe_load(f)
                if not config:
                    issues.append(f"sling/{pipeline_name}: Empty eltpulse.yaml")
                else:
                    # Check for description
                    if not config.get("description"):
                        issues.append(f"sling/{pipeline_name}: Missing description in eltpulse.yaml")

                    # Validate schedule if present
                    if config.get("schedule", {}).get("enabled"):
                        if not config["schedule"].get("cron_schedule"):
                            issues.append(f"sling/{pipeline_name}: Schedule enabled but no cron_schedule defined")

        except yaml.YAMLError as e:
            issues.append(f"sling/{pipeline_name}: Invalid YAML in eltpulse.yaml - {e}")

    if not replication_yaml.exists():
        issues.append(f"sling/{pipeline_name}: Missing replication.yaml")
    else:
        # Validate replication.yaml
        try:
            with open(replication_yaml) as f:
                config = yaml.safe_load(f)
                if not config:
                    issues.append(f"sling/{pipeline_name}: Empty replication.yaml")
                else:
                    # Check for source and target
                    if not config.get("source"):
                        issues.append(f"sling/{pipeline_name}: Missing 'source' in replication.yaml")
                    if not config.get("target"):
                        issues.append(f"sling/{pipeline_name}: Missing 'target' in replication.yaml")
                    if not config.get("streams"):
                        issues.append(f"sling/{pipeline_name}: Missing 'streams' in replication.yaml")

        except yaml.YAMLError as e:
            issues.append(f"sling/{pipeline_name}: Invalid YAML in replication.yaml - {e}")

    return issues
