"""Enable and disable commands for pipelines."""

import click
from pathlib import Path
import yaml
from git import Repo
from rich.console import Console

console = Console()


@click.command()
@click.argument("name")
@click.option("--repo-path", default=".", help="Path to the ELT pipelines repository")
@click.option("--git-commit/--no-git-commit", default=True, help="Auto-commit to git")
def enable(name: str, repo_path: str, git_commit: bool):
    """Enable a pipeline.

    \b
    Example:
        elt enable my_pipeline
        elt enable my_pipeline --no-git-commit
    """
    _toggle_pipeline(name, repo_path, True, git_commit)


@click.command()
@click.argument("name")
@click.option("--repo-path", default=".", help="Path to the ELT pipelines repository")
@click.option("--git-commit/--no-git-commit", default=True, help="Auto-commit to git")
def disable(name: str, repo_path: str, git_commit: bool):
    """Disable a pipeline.

    \b
    Example:
        elt disable my_pipeline
        elt disable my_pipeline --no-git-commit
    """
    _toggle_pipeline(name, repo_path, False, git_commit)


def _toggle_pipeline(name: str, repo_path: str, enabled: bool, git_commit: bool):
    """Toggle a pipeline's enabled status."""
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
    dagster_yaml_path = pipeline_dir / "eltpulse.yaml"

    if not dagster_yaml_path.exists():
        console.print(f"[red]✗[/red] No eltpulse.yaml found in {pipeline_dir}")
        return

    # Read current config
    with open(dagster_yaml_path) as f:
        config = yaml.safe_load(f) or {}

    # Update enabled status
    config["enabled"] = enabled

    # Write back
    with open(dagster_yaml_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    action = "Enabled" if enabled else "Disabled"
    color = "green" if enabled else "yellow"
    console.print(f"[{color}]✓[/{color}] {action} pipeline: {name}")

    # Git operations
    if git_commit:
        try:
            if (repo_path_obj / ".git").exists():
                repo = Repo(repo_path_obj)
                relative_path = dagster_yaml_path.relative_to(repo_path_obj)

                # Add and commit
                repo.index.add([str(relative_path)])
                repo.index.commit(f"{action} {tool} pipeline: {name}")
                console.print(f"[green]✓[/green] Committed changes")

                # Push if remote exists
                if repo.remotes:
                    try:
                        origin = repo.remotes.origin
                        origin.push()
                        console.print("[green]✓[/green] Pushed to remote")
                    except Exception as e:
                        console.print(f"[yellow]⚠[/yellow]  Could not push: {e}")
        except Exception as e:
            console.print(f"[yellow]⚠[/yellow]  Git operation failed: {e}")
