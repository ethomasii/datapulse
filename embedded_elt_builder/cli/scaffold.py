"""Scaffold command for creating new ELT pipelines with full feature parity to Web UI."""

import os
from pathlib import Path
from typing import Optional, List

import click
from git import Repo

from ..pipeline_generator import (
    PipelineRequest,
    create_pipeline,
    choose_tool,
)
from ..web.credentials_config import (
    get_required_credentials,
    get_source_configuration,
    SOURCE_CREDENTIALS,
    DESTINATION_CREDENTIALS,
)


@click.group()
def scaffold():
    """Scaffold new ELT pipelines with smart tool selection.

    The scaffold command will:
    - Automatically choose between dlt and Sling based on source/destination
    - Interactively prompt for source configuration (what data to load)
    - Generate Python code for dlt or YAML for Sling
    - Create proper directory structure in pipelines/
    """
    pass


@scaffold.command()
@click.argument("name")
@click.option("--source", "source_type", required=True, help="Source type (e.g., 'github', 'postgres', 'stripe')")
@click.option("--destination", "destination_type", required=True, help="Destination type (e.g., 'snowflake', 'bigquery')")
@click.option("--repo-path", default=".", help="Path to the ELT pipelines repository")
@click.option("--description", help="Pipeline description")
@click.option("--group", "group_name", help="Pipeline group label (workspace metadata)")
@click.option("--schedule", "cron_schedule", help="Cron schedule (e.g., '0 2 * * *')")
@click.option("--interactive/--no-interactive", default=True, help="Interactively configure source options")
@click.option("--git-commit/--no-git-commit", default=True, help="Auto-commit to git")
def create(
    name: str,
    source_type: str,
    destination_type: str,
    repo_path: str,
    description: Optional[str],
    group_name: Optional[str],
    cron_schedule: Optional[str],
    interactive: bool,
    git_commit: bool,
):
    """Create a new ELT pipeline with smart tool selection.

    \b
    Examples:
        # GitHub to Snowflake (interactive)
        elt scaffold create github_to_snowflake --source github --destination snowflake

        # Postgres to BigQuery (non-interactive)
        elt scaffold create pg_to_bq --source postgres --destination bigquery --no-interactive

        # With schedule
        elt scaffold create stripe_daily --source stripe --destination duckdb --schedule "0 2 * * *"
    """
    click.echo(f"\n🚀 Creating pipeline: {name}")
    click.echo(f"   Source: {source_type}")
    click.echo(f"   Destination: {destination_type}")

    # Choose tool automatically
    tool = choose_tool(source_type, destination_type)
    click.echo(f"   Tool: {tool} (auto-selected)")

    # Build repository path
    repo_path_obj = Path(repo_path).resolve()
    pipeline_dir = repo_path_obj / "pipelines" / tool / name

    if pipeline_dir.exists():
        if not click.confirm(f"\n⚠️  Pipeline '{name}' already exists. Overwrite?", abort=True):
            return

    # Get source configuration interactively
    source_configuration = {}
    if interactive:
        click.echo(f"\n📝 Configuring {source_type} source...")
        source_config_fields = get_source_configuration(source_type)

        if source_config_fields:
            source_configuration = _prompt_for_configuration(source_config_fields)
        else:
            click.echo("   (No additional configuration needed)")

    # Create pipeline request
    request = PipelineRequest(
        name=name,
        source_type=source_type,
        destination_type=destination_type,
        source_configuration=source_configuration,
        description=description or f"Load {source_type} data to {destination_type}",
        group_name=group_name,
        schedule_enabled=bool(cron_schedule),
        cron_schedule=cron_schedule,
    )

    # Generate pipeline files
    click.echo(f"\n✨ Generating pipeline files...")
    create_pipeline(pipeline_dir, request, tool)

    click.echo(f"✅ Created {tool} pipeline: {pipeline_dir.relative_to(repo_path_obj)}")

    # Show credentials needed
    click.echo(f"\n🔐 Required credentials:")
    creds = get_required_credentials(source_type, destination_type)

    if creds.get("source"):
        click.echo(f"\n   Source ({source_type}):")
        for cred in creds["source"]:
            click.echo(f"   - {cred['key']}: {cred['label']}")

    if creds.get("destination"):
        click.echo(f"\n   Destination ({destination_type}):")
        for cred in creds["destination"]:
            click.echo(f"   - {cred['key']}: {cred['label']}")

    click.echo(f"\n   💡 Set these in your .env file or environment")

    # Git operations
    if git_commit:
        _git_commit_and_push(repo_path_obj, pipeline_dir, f"Add {tool} pipeline: {name}")

    click.echo(f"\n🎉 Pipeline created successfully!")
    click.echo(f"\n📚 Next steps:")
    click.echo(f"   1. Set required credentials in .env file")
    click.echo(f"   2. Review and edit: {pipeline_dir.relative_to(repo_path_obj)}/")
    if tool == "dlt":
        click.echo(f"   3. Test locally: python -m pipelines.{tool}.{name}.pipeline")
    else:
        click.echo(f"   3. Test locally: sling run -r {pipeline_dir.relative_to(repo_path_obj)}/replication.yaml")
    click.echo(f"   4. Deploy with the eltPulse agent, your runner, or your own orchestration")


def _prompt_for_configuration(config_fields: List[dict]) -> dict:
    """Interactively prompt for source configuration."""
    configuration = {}

    for field in config_fields:
        field_key = field["key"]
        field_label = field["label"]
        field_type = field["type"]
        field_required = field.get("required", False)
        field_help = field.get("help", "")
        field_default = field.get("default")

        # Show help text
        if field_help:
            click.echo(f"\n   {field_help}")

        if field_type == "multiselect":
            # Handle multiselect (checkboxes)
            click.echo(f"\n   {field_label}:")
            options = field.get("options", [])
            selected = []

            for option in options:
                default_selected = field_default and option["value"] in field_default
                prompt_text = f"     - {option['label']}"

                if click.confirm(prompt_text, default=default_selected):
                    selected.append(option["value"])

            if selected or not field_required:
                configuration[field_key] = selected

        elif field_type == "boolean":
            # Handle boolean toggle
            default_val = field_default if field_default is not None else False
            value = click.confirm(f"   {field_label}", default=default_val)
            configuration[field_key] = value

        else:
            # Handle text input
            prompt_text = f"   {field_label}"
            if not field_required:
                prompt_text += " (optional)"

            value = click.prompt(
                prompt_text,
                default=field.get("placeholder", ""),
                show_default=False,
                type=str
            )

            if value or field_required:
                configuration[field_key] = value

    return configuration


def _git_commit_and_push(repo_path: Path, pipeline_dir: Path, commit_message: str):
    """Commit and push changes to git."""
    try:
        # Check if it's a git repo
        if not (repo_path / ".git").exists():
            click.echo("\n⚠️  Not a git repository. Skipping git operations.")
            click.echo("   Initialize with: git init")
            return

        repo = Repo(repo_path)

        # Add pipeline directory
        relative_path = pipeline_dir.relative_to(repo_path)
        repo.index.add([str(relative_path)])

        # Commit
        repo.index.commit(commit_message)
        click.echo(f"\n✅ Committed: {commit_message}")

        # Push if remote exists
        if repo.remotes:
            try:
                origin = repo.remotes.origin
                origin.push()
                click.echo("✅ Pushed to remote")
            except Exception as e:
                click.echo(f"⚠️  Could not push to remote: {e}")
                click.echo("   Push manually with: git push")
        else:
            click.echo("⚠️  No git remote configured. Skipping push.")
            click.echo("   Add remote with: git remote add origin <url>")

    except Exception as e:
        click.echo(f"\n⚠️  Git operation failed: {e}")
        click.echo("   You can commit manually later.")
