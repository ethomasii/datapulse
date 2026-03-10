"""Shared pipeline generation logic for CLI and Web UI."""

from pathlib import Path
from typing import Dict, Any, Optional, List
import yaml
from pydantic import BaseModel, Field


class PipelineRequest(BaseModel):
    """Unified pipeline request model for both CLI and Web UI."""

    name: str
    source_type: str
    destination_type: str
    destination_instance: Optional[str] = None  # Instance name for multiple destinations of same type (e.g., "dev", "qa", "prod")
    source_configuration: Dict[str, Any] = Field(default_factory=dict)
    credentials: Dict[str, str] = Field(default_factory=dict)
    description: Optional[str] = None
    group_name: Optional[str] = None
    schedule_enabled: bool = False
    cron_schedule: Optional[str] = None
    timezone: str = "UTC"
    partitions_enabled: bool = False
    partition_type: Optional[str] = None
    partition_start: Optional[str] = None
    partition_cron: Optional[str] = None
    partition_keys: Optional[List[str]] = None
    owners: Optional[List[str]] = None
    tags: Optional[Dict[str, str]] = None
    kinds: Optional[List[str]] = None
    retries: int = 2
    retry_delay: int = 30
    retry_backoff: str = "LINEAR"
    retry_jitter: Optional[str] = None
    write_disposition: str = "append"  # append, replace, or merge
    primary_key: Optional[str] = None  # For merge disposition
    merge_key: Optional[str] = None  # For merge disposition
    incremental_enabled: bool = False  # Enable incremental loading (creates partitioned assets)
    cursor_field: Optional[str] = None  # Cursor field for incremental loading (becomes partition key)
    cursor_initial_value: Optional[str] = None  # Initial cursor value
    partition_frequency: Optional[str] = "@daily"  # Partition frequency for Dagster partitioned assets (only used if incremental_enabled)
    file_format: str = "parquet"  # File format for file-based destinations (parquet, jsonl, csv)
    compression: str = "gzip"  # Compression method (gzip, none, bz2, snappy, zstd)
    table_prefix: Optional[str] = None  # Prefix for table names (e.g., "raw_")
    table_suffix: Optional[str] = None  # Suffix for table names (e.g., "_staging")
    schema_override: Optional[str] = None  # Override default schema/dataset name
    enable_staging: bool = False  # Use staging tables before final load
    column_hints: Optional[str] = None  # JSON string with column type hints


def generate_dlt_pipeline(request: PipelineRequest) -> str:
    """Generate dlt pipeline Python code."""

    # Generate source-specific pipeline code
    if request.source_type == "github":
        return _generate_github_pipeline(request)
    elif request.source_type == "rest_api":
        return _generate_rest_api_pipeline(request)
    else:
        # Generic template for other sources
        return _generate_generic_pipeline(request)


def _generate_github_pipeline(request: PipelineRequest) -> str:
    """Generate GitHub-specific dlt pipeline code."""
    config = request.source_configuration
    repo_owner = config.get('repo_owner', 'REPO_OWNER')
    repo_name = config.get('repo_name', 'REPO_NAME')
    resources = config.get('resources', ['issues', 'pull_requests'])

    # Build resource list for code
    resource_list = ', '.join([f'"{r}"' for r in resources])

    # Determine dataset name
    dataset_name = request.schema_override or f"github_{repo_owner}_{repo_name}"

    # Build destination string with instance name if provided
    if request.destination_instance:
        destination = f"{request.destination_type}__{request.destination_instance}"
        destination_comment = f"# Named destination: {destination} (uses {request.destination_type.upper()}_{request.destination_instance.upper()}_* env vars)"
    else:
        destination = request.destination_type
        destination_comment = ""

    return f'''"""dlt pipeline: {request.name}

{request.description or f"Load GitHub data from {repo_owner}/{repo_name} to {request.destination_type}"}
"""

import dlt
from dlt.sources.github import github_reactions

def run(partition_key: str = None):
    """Run the GitHub pipeline."""

    # Configure the pipeline
    {destination_comment}
    pipeline = dlt.pipeline(
        pipeline_name="{request.name}",
        destination="{destination}",
        dataset_name="{dataset_name}",
    )

    # Load GitHub data
    # Access token will be read from GITHUB_TOKEN environment variable
    source = github_reactions(
        owner="{repo_owner}",
        name="{repo_name}",
        items_per_page=100,
        max_items=None,  # Load all data
    )

    # Select which resources to load
    resources_to_load = [{resource_list}]
    source = source.with_resources(*resources_to_load)

    # Run the pipeline with write disposition
    info = pipeline.run(
        source,
        write_disposition="{request.write_disposition}",
        loader_file_format="{request.file_format}"  # File format for file-based destinations
    )

    print(f"Pipeline completed: {{info}}")
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
'''


def _generate_rest_api_pipeline(request: PipelineRequest) -> str:
    """Generate REST API-specific dlt pipeline code."""
    import json
    config = request.source_configuration

    # Check if advanced mode is used
    if config.get('advanced_mode') and config.get('advanced_config'):
        # Advanced mode: use JSON configuration
        return _generate_rest_api_advanced(request)

    # Simple mode: use individual fields
    base_url = config.get('base_url', 'https://api.example.com')
    resource_name = config.get('resource_name', 'data')
    endpoint = config.get('endpoint', '/data')
    http_method = config.get('http_method', 'GET')
    pagination_type = config.get('pagination_type', 'auto')
    data_selector = config.get('data_selector', '')

    # Determine dataset name
    dataset_name = request.schema_override or f"{resource_name}_data"

    # Build destination string with instance name if provided
    if request.destination_instance:
        destination = f"{request.destination_type}__{request.destination_instance}"
        destination_comment = f"# Named destination: {destination} (uses {request.destination_type.upper()}_{request.destination_instance.upper()}_* env vars)"
    else:
        destination = request.destination_type
        destination_comment = ""

    # Build paginator config based on type
    paginator_code = ''
    if pagination_type == 'none':
        paginator_code = 'paginator=None'
    elif pagination_type == 'offset':
        paginator_code = '''paginator=dlt.sources.helpers.rest_client.paginators.OffsetPaginator(
        limit=100,
        offset_param="offset",
        limit_param="limit"
    )'''
    elif pagination_type == 'cursor':
        paginator_code = '''paginator=dlt.sources.helpers.rest_client.paginators.JSONLinkPaginator(
        next_url_path="next"
    )'''
    elif pagination_type == 'json_link':
        paginator_code = '''paginator=dlt.sources.helpers.rest_client.paginators.JSONLinkPaginator(
        next_url_path="next"
    )'''
    else:  # auto
        paginator_code = 'paginator="auto"'

    # Build data selector
    data_selector_code = f'data_selector="{data_selector}"' if data_selector else 'data_selector=None'

    # Build incremental configuration if enabled
    incremental_import = ''
    incremental_config = ''
    if request.incremental_enabled and request.cursor_field:
        incremental_import = 'from dlt.sources.incremental import Incremental'
        initial_value_str = f'initial_value="{request.cursor_initial_value}"' if request.cursor_initial_value else ''
        incremental_config = f'''
                "incremental": {{
                    "cursor_path": "{request.cursor_field}",
                    {initial_value_str}
                }},'''

    return f'''"""dlt pipeline: {request.name}

{request.description or f"Load data from REST API to {request.destination_type}"}

{'This pipeline uses incremental loading with partitioned assets in Dagster.' if request.incremental_enabled else ''}
"""

import dlt
from dlt.sources.rest_api import rest_api_source
{incremental_import}

def run(partition_key: str = None):
    """Run the REST API pipeline.

    Args:
        partition_key: Partition key for partitioned assets (e.g., "2024-01-01")
    """

    # Configure the pipeline
    {destination_comment}
    pipeline = dlt.pipeline(
        pipeline_name="{request.name}",
        destination="{destination}",
        dataset_name="{dataset_name}",
    )

    # Configure REST API source
    source = rest_api_source({{
        "client": {{
            "base_url": "{base_url}",
        }},
        "resources": [
            {{
                "name": "{resource_name}",
                "endpoint": {{
                    "path": "{endpoint}",
                    "method": "{http_method}",
                }},{incremental_config}
                {paginator_code},
                {data_selector_code},
            }}
        ]
    }})

    # Run the pipeline with write disposition
    info = pipeline.run(
        source,
        write_disposition="{request.write_disposition}",
        loader_file_format="{request.file_format}"  # File format for file-based destinations
    )

    print(f"Pipeline completed: {{info}}")
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
'''


def _generate_rest_api_advanced(request: PipelineRequest) -> str:
    """Generate REST API pipeline using advanced JSON configuration."""
    import json
    config = request.source_configuration

    # Parse advanced config
    try:
        advanced_config = json.loads(config.get('advanced_config', '{}'))
        config_str = json.dumps(advanced_config, indent=4)
    except json.JSONDecodeError:
        # Fallback to simple mode if JSON is invalid
        return _generate_rest_api_pipeline(request)

    # Extract resource name from config if possible
    resource_name = config.get('resource_name', 'data')
    if 'resources' in advanced_config and len(advanced_config['resources']) > 0:
        resource_name = advanced_config['resources'][0].get('name', resource_name)

    # Determine dataset name
    dataset_name = request.schema_override or f"{resource_name}_data"

    # Build destination string with instance name if provided
    if request.destination_instance:
        destination = f"{request.destination_type}__{request.destination_instance}"
        destination_comment = f"# Named destination: {destination} (uses {request.destination_type.upper()}_{request.destination_instance.upper()}_* env vars)"
    else:
        destination = request.destination_type
        destination_comment = ""

    return f'''"""dlt pipeline: {request.name}

{request.description or f"Load data from REST API to {request.destination_type}"}
"""

import dlt
from dlt.sources.rest_api import rest_api_source

def run(partition_key: str = None):
    """Run the REST API pipeline."""

    # Configure the pipeline
    {destination_comment}
    pipeline = dlt.pipeline(
        pipeline_name="{request.name}",
        destination="{destination}",
        dataset_name="{dataset_name}",
    )

    # REST API configuration (advanced mode)
    config = {config_str}

    # Configure REST API source
    source = rest_api_source(config)

    # Run the pipeline with write disposition
    info = pipeline.run(
        source,
        write_disposition="{request.write_disposition}",
        loader_file_format="{request.file_format}"  # File format for file-based destinations
    )

    print(f"Pipeline completed: {{info}}")
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
'''


def _generate_generic_pipeline(request: PipelineRequest) -> str:
    """Generate generic dlt pipeline template."""
    # Determine dataset name
    dataset_name = request.schema_override or f"{request.source_type}_data"

    # Build destination string with instance name if provided
    if request.destination_instance:
        destination = f"{request.destination_type}__{request.destination_instance}"
        destination_comment = f"# Named destination: {destination} (uses {request.destination_type.upper()}_{request.destination_instance.upper()}_* env vars)"
    else:
        destination = request.destination_type
        destination_comment = ""

    return f'''"""dlt pipeline: {request.name}

{request.description or f"Load data from {request.source_type} to {request.destination_type}"}
"""

import dlt

def run(partition_key: str = None):
    """Run the pipeline."""
    {destination_comment}
    pipeline = dlt.pipeline(
        pipeline_name="{request.name}",
        destination="{destination}",
        dataset_name="{dataset_name}",
    )

    # TODO: Configure your {request.source_type} source
    # See documentation: https://dlthub.com/docs/dlt-ecosystem/verified-sources
    # Configuration: {request.source_configuration}

    # Example placeholder
    data = [{{"id": 1, "partition": partition_key, "source": "{request.source_type}"}}]

    info = pipeline.run(
        data,
        table_name="{request.source_type}_data",
        write_disposition="{request.write_disposition}",
        loader_file_format="{request.file_format}"  # File format for file-based destinations
    )

    print(f"Pipeline completed: {{info}}")
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
'''


def generate_sling_replication(request: PipelineRequest) -> Dict[str, Any]:
    """Generate Sling replication YAML structure with named connections."""

    # Build streams based on configuration
    streams = {}
    config = request.source_configuration

    if config.get('tables'):
        # If specific tables are configured
        tables = [t.strip() for t in config['tables'].split(',')]
        for table in tables:
            streams[f"public.{table}"] = {"object": f"{request.destination_type}.{table}"}
    else:
        # Default placeholder
        streams["# TODO: Configure your streams"] = {"# Example": "public.users"}

    # Build connection names with instance suffix if provided
    source_conn_name = request.source_type.upper()
    if request.destination_instance:
        dest_conn_name = f"{request.destination_type.upper()}_{request.destination_instance.upper()}"
    else:
        dest_conn_name = request.destination_type.upper()

    replication = {
        "source": source_conn_name,
        "target": dest_conn_name,
        "defaults": {
            "mode": "full-refresh",
            "object": "{stream_schema}.{stream_table}"
        },
        "streams": streams
    }

    # Add env section with connection definitions if instance is specified
    if request.destination_instance:
        env_section = _generate_sling_env_section(request.destination_type, request.destination_instance)
        if env_section:
            replication["env"] = {dest_conn_name: env_section}

    return replication


def _generate_sling_env_section(dest_type: str, instance: str) -> str:
    """Generate Sling env connection definition for a destination instance."""
    instance_upper = instance.upper()

    if dest_type == 'snowflake':
        return f"""type: snowflake
account: ${{SNOWFLAKE_{instance_upper}_ACCOUNT}}
user: ${{SNOWFLAKE_{instance_upper}_USER}}
password: ${{SNOWFLAKE_{instance_upper}_PASSWORD}}
database: ${{SNOWFLAKE_{instance_upper}_DATABASE}}
warehouse: ${{SNOWFLAKE_{instance_upper}_WAREHOUSE}}
role: ${{SNOWFLAKE_{instance_upper}_ROLE}}"""

    elif dest_type in ['postgres', 'postgresql']:
        return f"""type: postgres
host: ${{DEST_POSTGRES_{instance_upper}_HOST}}
port: ${{DEST_POSTGRES_{instance_upper}_PORT:-5432}}
database: ${{DEST_POSTGRES_{instance_upper}_DATABASE}}
user: ${{DEST_POSTGRES_{instance_upper}_USER}}
password: ${{DEST_POSTGRES_{instance_upper}_PASSWORD}}
sslmode: ${{DEST_POSTGRES_{instance_upper}_SSLMODE:-prefer}}"""

    elif dest_type == 'duckdb':
        return f"""type: duckdb
instance: ${{DEST_DUCKDB_{instance_upper}_PATH:-./data.duckdb}}"""

    elif dest_type == 'redshift':
        return f"""type: redshift
host: ${{REDSHIFT_{instance_upper}_HOST}}
port: ${{REDSHIFT_{instance_upper}_PORT:-5439}}
database: ${{REDSHIFT_{instance_upper}_DATABASE}}
user: ${{REDSHIFT_{instance_upper}_USER}}
password: ${{REDSHIFT_{instance_upper}_PASSWORD}}"""

    elif dest_type in ['bigquery', 'gcp']:
        return f"""type: bigquery
project: ${{GCP_{instance_upper}_PROJECT_ID}}
credentials: ${{GCP_{instance_upper}_CREDENTIALS}}"""

    return None


def create_pipeline(
    pipeline_dir: Path,
    request: PipelineRequest,
    tool: str,  # "dlt" or "sling"
) -> None:
    """Create a complete pipeline with all necessary files.

    Args:
        pipeline_dir: Directory where pipeline files will be created
        request: Pipeline configuration request
        tool: Either "dlt" or "sling"
    """
    pipeline_dir.mkdir(parents=True, exist_ok=True)

    if tool == "dlt":
        # Create pipeline.py
        pipeline_py = generate_dlt_pipeline(request)
        (pipeline_dir / "pipeline.py").write_text(pipeline_py)
    else:
        # Create replication.yaml for Sling
        replication = generate_sling_replication(request)
        with open(pipeline_dir / "replication.yaml", "w") as f:
            yaml.dump(replication, f, sort_keys=False)

    # Save configuration to config.yaml
    config_data = {
        "source_type": request.source_type,
        "destination_type": request.destination_type,
    }
    if request.destination_instance:
        config_data["destination_instance"] = request.destination_instance
    if request.source_configuration:
        config_data["configuration"] = request.source_configuration

    with open(pipeline_dir / "config.yaml", "w") as f:
        yaml.dump(config_data, f, sort_keys=False, default_flow_style=False)

    # Create README
    readme = generate_readme(request, tool)
    (pipeline_dir / "README.md").write_text(readme)

    # Create dagster.yaml
    dagster_yaml = generate_dagster_yaml(request)
    with open(pipeline_dir / "dagster.yaml", "w") as f:
        yaml.dump(dagster_yaml, f, sort_keys=False, default_flow_style=False)


def generate_readme(request: PipelineRequest, tool: str) -> str:
    """Generate README content."""
    config_section = ""
    if request.source_configuration:
        config_lines = [f"- **{key}**: {value}" for key, value in request.source_configuration.items()]
        config_section = "\n".join(config_lines)

    run_command = f"python -m pipelines.{tool}.{request.name}.pipeline" if tool == "dlt" else f"sling run -r pipelines/{tool}/{request.name}/replication.yaml"

    return f'''# {request.name}

{request.description or f"{tool.upper()} pipeline from {request.source_type} to {request.destination_type}"}

## Source
- **Type**: {request.source_type}

### Configuration
{config_section or "No additional configuration"}

## Destination
- **Type**: {request.destination_type}

## Run Locally

```bash
{run_command}
```

## Environment Variables

See your .env file for required credentials.
'''


def generate_dagster_yaml(request: PipelineRequest) -> Dict[str, Any]:
    """Generate dagster.yaml configuration."""
    config = {
        "enabled": True,
    }

    if request.description:
        config["description"] = request.description

    if request.group_name:
        config["group"] = request.group_name

    # Owners at top level
    if request.owners:
        config["owners"] = request.owners

    # Schedule
    if request.schedule_enabled and request.cron_schedule:
        config["schedule"] = {
            "enabled": True,
            "cron_schedule": request.cron_schedule,
            "timezone": request.timezone,
        }

    # Tags at top level
    if request.tags:
        config["tags"] = request.tags

    # Kinds at top level
    if request.kinds:
        config["kinds"] = request.kinds

    # Retry configuration at top level
    retry_policy = {
        "max_retries": request.retries,
        "delay": request.retry_delay
    }
    if request.retry_backoff and request.retry_backoff != "LINEAR":
        retry_policy["backoff"] = request.retry_backoff
    if request.retry_jitter:
        retry_policy["jitter"] = request.retry_jitter

    config["retry_policy"] = retry_policy

    # Partitions - either from incremental loading or explicit partition config
    if request.incremental_enabled and request.cursor_field:
        # Incremental loading creates time-based partitioned assets
        # The cursor field becomes the partition key
        import datetime
        start_date = request.cursor_initial_value or datetime.datetime.now().strftime("%Y-%m-%d")

        config["partitions"] = {
            "enabled": True,
            "type": "time",
            "time": {
                "start": start_date,
                "cron_schedule": request.partition_frequency,
                "timezone": request.timezone,
                "fmt": "%Y-%m-%d"
            }
        }

        # Store cursor field for the component to use
        config["incremental"] = {
            "cursor_field": request.cursor_field,
            "initial_value": request.cursor_initial_value
        }

    elif request.partitions_enabled:
        if request.partition_type == "time":
            config["partitions"] = {
                "enabled": True,
                "type": "time",
                "time": {
                    "start": request.partition_start or "2024-01-01",
                    "cron_schedule": request.partition_cron or "0 0 * * *",
                    "timezone": request.timezone,
                    "fmt": "%Y-%m-%d"
                }
            }
        elif request.partition_type == "static" and request.partition_keys:
            config["partitions"] = {
                "enabled": True,
                "type": "static",
                "static": {
                    "partition_keys": request.partition_keys
                }
            }

    return config


def choose_tool(source_type: str, destination_type: str) -> str:
    """Choose the appropriate tool (dlt or Sling) based on source and destination.

    Logic:
    - API/SaaS sources → always dlt
    - Database to database → Sling
    - Database to warehouse → Sling
    - File/storage sources → dlt
    """
    # API/SaaS sources always use dlt
    api_sources = {
        "github", "stripe", "shopify", "hubspot", "salesforce",
        "google_analytics", "facebook_ads", "google_ads", "slack", "notion",
        "airtable", "asana", "jira", "zendesk", "intercom", "mixpanel", "segment"
    }

    if source_type.lower() in api_sources:
        return "dlt"

    # Database sources
    db_sources = {"postgres", "mysql", "mongodb", "mssql", "oracle"}

    # Storage sources use dlt
    storage_sources = {"s3", "gcs", "azure_blob", "csv", "json", "parquet"}

    if source_type.lower() in storage_sources:
        return "dlt"

    # Database to database/warehouse - use Sling
    if source_type.lower() in db_sources:
        return "sling"

    # Default to dlt
    return "dlt"
