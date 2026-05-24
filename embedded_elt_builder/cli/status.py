"""Status command to show repository and pipeline overview."""

import click
from pathlib import Path
import yaml
from git import Repo
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

console = Console()


@click.command()
@click.option("--repo-path", default=".", help="Path to the ELT pipelines repository")
def status(repo_path: str):
    """Show repository status and pipeline summary.

    Displays:
    - Git status (branch, commits, changes)
    - Pipeline counts by tool and status
    - Recent activity summary

    \b
    Example:
        elt status
        elt status --repo-path ~/my-pipelines
    """
    repo_path_obj = Path(repo_path).resolve()
    pipelines_dir = repo_path_obj / "pipelines"

    console.print()
    console.print(f"[bold]ELT Repository Status[/bold]")
    console.print(f"[dim]{repo_path_obj}[/dim]\n")

    # Git Status
    _show_git_status(repo_path_obj)

    # Pipeline Summary
    if pipelines_dir.exists():
        _show_pipeline_summary(pipelines_dir)
    else:
        console.print("[yellow]⚠[/yellow] No pipelines directory found")

    console.print()


def _show_git_status(repo_path: Path):
    """Display git status information."""
    if not (repo_path / ".git").exists():
        console.print(Panel(
            "[yellow]Not a git repository[/yellow]\n"
            "Initialize with: [cyan]git init[/cyan]",
            title="[bold]Git Status[/bold]",
            border_style="yellow"
        ))
        return

    try:
        repo = Repo(repo_path)

        # Branch info
        branch = repo.active_branch.name
        branch_text = f"[cyan]Branch:[/cyan] {branch}"

        # Remote info
        if repo.remotes:
            remote_text = f"[cyan]Remote:[/cyan] {repo.remotes.origin.url}"
        else:
            remote_text = "[yellow]No remote configured[/yellow]"

        # Changes
        changed_files = [item.a_path for item in repo.index.diff(None)]
        untracked_files = repo.untracked_files
        staged_files = [item.a_path for item in repo.index.diff("HEAD")]

        changes_text = []
        if staged_files:
            changes_text.append(f"[green]{len(staged_files)} staged[/green]")
        if changed_files:
            changes_text.append(f"[yellow]{len(changed_files)} modified[/yellow]")
        if untracked_files:
            changes_text.append(f"[dim]{len(untracked_files)} untracked[/dim]")

        if changes_text:
            status_text = "[cyan]Changes:[/cyan] " + ", ".join(changes_text)
        else:
            status_text = "[green]✓ Working tree clean[/green]"

        # Commits ahead/behind
        ahead_behind_text = ""
        if repo.remotes:
            try:
                origin = repo.remotes.origin
                origin.fetch()
                commits_ahead = list(repo.iter_commits(f'origin/{branch}..{branch}'))
                commits_behind = list(repo.iter_commits(f'{branch}..origin/{branch}'))

                if commits_ahead or commits_behind:
                    parts = []
                    if commits_ahead:
                        parts.append(f"[green]↑ {len(commits_ahead)} ahead[/green]")
                    if commits_behind:
                        parts.append(f"[yellow]↓ {len(commits_behind)} behind[/yellow]")
                    ahead_behind_text = "[cyan]Sync:[/cyan] " + ", ".join(parts)
            except:
                pass

        content = f"{branch_text}\n{remote_text}\n{status_text}"
        if ahead_behind_text:
            content += f"\n{ahead_behind_text}"

        console.print(Panel(
            content,
            title="[bold]Git Status[/bold]",
            border_style="blue"
        ))

    except Exception as e:
        console.print(Panel(
            f"[red]Error reading git status:[/red] {e}",
            title="[bold]Git Status[/bold]",
            border_style="red"
        ))


def _show_pipeline_summary(pipelines_dir: Path):
    """Display pipeline statistics."""
    stats = {
        "dlt": {"total": 0, "enabled": 0, "disabled": 0},
        "sling": {"total": 0, "enabled": 0, "disabled": 0},
    }

    # Count dlt pipelines
    dlt_dir = pipelines_dir / "dlt"
    if dlt_dir.exists():
        for pipeline_dir in dlt_dir.iterdir():
            if pipeline_dir.is_dir():
                stats["dlt"]["total"] += 1
                dagster_yaml = pipeline_dir / "eltpulse.yaml"
                if dagster_yaml.exists():
                    try:
                        with open(dagster_yaml) as f:
                            config = yaml.safe_load(f) or {}
                            if config.get("enabled", True):
                                stats["dlt"]["enabled"] += 1
                            else:
                                stats["dlt"]["disabled"] += 1
                    except:
                        pass

    # Count Sling pipelines
    sling_dir = pipelines_dir / "sling"
    if sling_dir.exists():
        for pipeline_dir in sling_dir.iterdir():
            if pipeline_dir.is_dir():
                stats["sling"]["total"] += 1
                dagster_yaml = pipeline_dir / "eltpulse.yaml"
                if dagster_yaml.exists():
                    try:
                        with open(dagster_yaml) as f:
                            config = yaml.safe_load(f) or {}
                            if config.get("enabled", True):
                                stats["sling"]["enabled"] += 1
                            else:
                                stats["sling"]["disabled"] += 1
                    except:
                        pass

    # Create summary table
    table = Table(box=box.SIMPLE, show_header=True)
    table.add_column("Tool", style="cyan", width=10)
    table.add_column("Total", justify="right", width=8)
    table.add_column("Enabled", justify="right", style="green", width=10)
    table.add_column("Disabled", justify="right", style="yellow", width=10)

    table.add_row(
        "dlt",
        str(stats["dlt"]["total"]),
        str(stats["dlt"]["enabled"]),
        str(stats["dlt"]["disabled"]) if stats["dlt"]["disabled"] > 0 else "[dim]0[/dim]"
    )

    table.add_row(
        "Sling",
        str(stats["sling"]["total"]),
        str(stats["sling"]["enabled"]),
        str(stats["sling"]["disabled"]) if stats["sling"]["disabled"] > 0 else "[dim]0[/dim]"
    )

    total = stats["dlt"]["total"] + stats["sling"]["total"]
    total_enabled = stats["dlt"]["enabled"] + stats["sling"]["enabled"]
    total_disabled = stats["dlt"]["disabled"] + stats["sling"]["disabled"]

    table.add_row(
        "[bold]Total[/bold]",
        f"[bold]{total}[/bold]",
        f"[bold green]{total_enabled}[/bold green]",
        f"[bold yellow]{total_disabled}[/bold yellow]" if total_disabled > 0 else "[dim]0[/dim]"
    )

    console.print(Panel(
        table,
        title="[bold]Pipeline Summary[/bold]",
        border_style="green"
    ))
