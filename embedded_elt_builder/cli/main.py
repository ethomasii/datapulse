"""Main CLI entry point for ELT pipeline management."""

import click

from .scaffold import scaffold
from .list_pipelines import list_pipelines
from .delete import delete
from .ui import ui
from .show import show
from .toggle import enable, disable
from .validate import validate
from .status import status
from .sensors import sensors
from .schedules import schedules


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """ELT Pipeline Manager - Manage dlt and Sling pipelines with sensor orchestration.

    \b
    Examples:
        # Create a new pipeline
        elt scaffold create github_snowflake --source github --destination snowflake

        # List all pipelines
        elt list
        elt list --tool dlt --enabled

        # Show pipeline details
        elt show my_pipeline

        # Enable/disable pipelines
        elt enable my_pipeline
        elt disable my_pipeline

        # Validate configurations
        elt validate

        # Check repository status
        elt status

        # Delete a pipeline
        elt delete my_pipeline

        # Launch web UI
        elt ui

        # Manage sensors
        elt sensors create s3_monitor my_pipeline --type s3_file_count --config bucket_name=my-bucket,threshold=5
        elt sensors list
        elt sensors check

        # Manage schedules
        elt schedules create daily_backup my_pipeline --type cron --config cron_expression="0 2 * * *"
        elt schedules list
        elt schedules check
    """
    pass


cli.add_command(scaffold)
cli.add_command(list_pipelines, name="list")
cli.add_command(show)
cli.add_command(enable)
cli.add_command(disable)
cli.add_command(validate)
cli.add_command(status)
cli.add_command(delete)
cli.add_command(ui)
cli.add_command(sensors)
cli.add_command(schedules)


if __name__ == "__main__":
    cli()
