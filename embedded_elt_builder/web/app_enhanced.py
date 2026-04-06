"""FastAPI application for the ELT Builder Web UI."""

import os
import json
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yaml
import toml
from git import Repo
import shutil
import requests

from ..pipeline_generator import (
    PipelineRequest,
    create_pipeline,
    choose_tool,
)
from .credentials_config import (
    get_required_credentials,
    get_source_configuration,
    SOURCE_CREDENTIALS,
    DESTINATION_CREDENTIALS,
)


def get_config_dir() -> Path:
    """Get the config directory for ELT Builder."""
    config_dir = Path.home() / ".elt-builder"
    config_dir.mkdir(exist_ok=True)
    return config_dir


def load_config() -> dict:
    """Load configuration from file."""
    config_file = get_config_dir() / "config.json"
    if config_file.exists():
        try:
            with open(config_file, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_config(config: dict):
    """Save configuration to file."""
    config_file = get_config_dir() / "config.json"
    with open(config_file, 'w') as f:
        json.dump(config, f, indent=2)


def validate_repo_path(path: Path) -> dict:
    """Validate if a path is a valid ELT repository."""
    if not path.exists():
        return {"valid": False, "error": "Path does not exist"}

    if not path.is_dir():
        return {"valid": False, "error": "Path is not a directory"}

    # Check for pipelines directory
    pipelines_dir = path / "pipelines"
    if not pipelines_dir.exists():
        return {
            "valid": True,
            "warning": "No pipelines directory found. This will create one when you add pipelines.",
            "pipeline_count": 0
        }

    # Count pipelines
    dlt_pipelines = list((pipelines_dir / "dlt").glob("*/")) if (pipelines_dir / "dlt").exists() else []
    sling_pipelines = list((pipelines_dir / "sling").glob("*/")) if (pipelines_dir / "sling").exists() else []
    pipeline_count = len(dlt_pipelines) + len(sling_pipelines)

    return {
        "valid": True,
        "pipeline_count": pipeline_count,
        "has_git": (path / ".git").exists()
    }


def ensure_env_vars_exist(repo_path: Path, pipeline_name: str, source_type: str, destination_type: str):
    """Ensure required environment variables exist in .env file for a pipeline."""
    env_file = repo_path / ".env"
    env_metadata = repo_path / ".env.metadata.json"

    # Get required credentials
    creds = get_required_credentials(source_type, destination_type)
    required_keys = []

    for cred in creds.get("source", []):
        required_keys.append(cred["key"])
    for cred in creds.get("destination", []):
        required_keys.append(cred["key"])

    if not required_keys:
        return

    # Read existing .env file
    existing_vars = {}
    if env_file.exists():
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    existing_vars[key] = value

    # Add missing keys with blank values and comments
    new_lines = []
    if env_file.exists():
        with open(env_file, 'r') as f:
            new_lines = f.readlines()

    # Add new keys at the end with a comment
    added_keys = []
    for key in required_keys:
        if key not in existing_vars:
            if not new_lines or new_lines[-1].strip() != "":
                new_lines.append("\n")
            new_lines.append(f"# Required by pipeline: {pipeline_name}\n")
            new_lines.append(f"{key}=\n")
            added_keys.append(key)

    if added_keys:
        with open(env_file, 'w') as f:
            f.writelines(new_lines)

    # Update metadata to track which pipeline needs which vars
    import json
    metadata = {}
    if env_metadata.exists():
        with open(env_metadata, 'r') as f:
            metadata = json.load(f)

    if "pipeline_vars" not in metadata:
        metadata["pipeline_vars"] = {}

    metadata["pipeline_vars"][pipeline_name] = required_keys

    with open(env_metadata, 'w') as f:
        json.dump(metadata, f, indent=2)


# ========================================
# Pydantic Models for New Features
# ========================================

class DagsterProjectExportRequest(BaseModel):
    """Request model for exporting a Dagster project."""
    project_name: str
    repo_url: str
    repo_branch: str = "main"
    github_token: str
    pipelines_directory: str = "pipelines"
    auto_refresh: bool = True
    push_to_git: bool = True
    git_provider: str = "github"  # "github" or "gitlab"


class DbtPackageRequest(BaseModel):
    """Request model for adding dbt models to a pipeline."""
    pipeline_name: str
    pipeline_tool: str  # "dlt" or "sling"
    source_name: str
    dbt_package: Optional[str] = None
    include_models: List[str] = []


class DestinationCreate(BaseModel):
    """Request model for creating a destination."""
    name: str
    type: str  # bigquery, snowflake, postgres, duckdb, redshift, etc.
    instance: Optional[str] = None  # e.g., "prod", "dev", "qa"
    description: Optional[str] = None
    dagster_deployment: Optional[str] = None  # "deployment", "branch", "local"


class DestinationUpdate(BaseModel):
    """Request model for updating a destination."""
    name: Optional[str] = None
    description: Optional[str] = None
    dagster_deployment: Optional[str] = None


class Destination(BaseModel):
    """Destination model."""
    id: str
    name: str
    type: str
    instance: Optional[str] = None
    description: Optional[str] = None
    dagster_deployment: Optional[str] = None
    created_at: str
    updated_at: str


# ========================================
# Destination Management Functions
# ========================================

def get_destinations_file() -> Path:
    """Get the destinations storage file path."""
    return get_config_dir() / "destinations.json"


def load_destinations() -> List[dict]:
    """Load all destinations from storage."""
    destinations_file = get_destinations_file()
    if destinations_file.exists():
        try:
            with open(destinations_file, 'r') as f:
                data = json.load(f)
                return data.get('destinations', [])
        except Exception:
            pass
    return []


def save_destinations(destinations: List[dict]):
    """Save destinations to storage."""
    destinations_file = get_destinations_file()
    with open(destinations_file, 'w') as f:
        json.dump({'destinations': destinations}, f, indent=2)


def generate_destination_id(name: str, dest_type: str) -> str:
    """Generate a unique ID for a destination."""
    import hashlib
    import time
    base = f"{dest_type}_{name}_{time.time()}"
    return hashlib.md5(base.encode()).hexdigest()[:12]


def create_app(repo_path: str) -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="ELT Builder", version="0.1.0")

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Store repo path in app state
    app.state.repo_path = Path(repo_path).resolve()

    # Templates
    templates_dir = Path(__file__).parent / "templates"
    templates = Jinja2Templates(directory=str(templates_dir))

    elt_api_prefix = os.environ.get("ELT_API_PREFIX", "")

    @app.get("/api/health")
    async def health():
        """Liveness check for the web UI and proxies."""
        return {"status": "ok", "service": "elt-builder"}

    @app.get("/", response_class=HTMLResponse)
    async def index(request: Request):
        """Serve the main UI."""
        return templates.TemplateResponse(
            "index_enhanced.html",
            {"request": request, "elt_api_prefix": elt_api_prefix},
        )

    @app.get("/api/pipelines")
    async def list_pipelines():
        """List all pipelines in the repository."""
        pipelines_dir = app.state.repo_path / "pipelines"

        if not pipelines_dir.exists():
            return {"dlt": [], "sling": []}

        result = {"dlt": [], "sling": []}

        # List dlt pipelines
        dlt_dir = pipelines_dir / "dlt"
        if dlt_dir.exists():
            for pipeline_dir in dlt_dir.iterdir():
                if pipeline_dir.is_dir():
                    info = _get_pipeline_info(pipeline_dir, "dlt")
                    result["dlt"].append(info)

        # List Sling pipelines
        sling_dir = pipelines_dir / "sling"
        if sling_dir.exists():
            for pipeline_dir in sling_dir.iterdir():
                if pipeline_dir.is_dir():
                    info = _get_pipeline_info(pipeline_dir, "sling")
                    result["sling"].append(info)

        return result

    @app.post("/api/pipelines")
    async def create_new_pipeline(request: PipelineRequest):
        """Create a new pipeline."""
        try:
            # Choose tool
            tool = choose_tool(request.source_type, request.destination_type)

            # Build pipeline directory path
            pipeline_dir = app.state.repo_path / "pipelines" / tool / request.name

            if pipeline_dir.exists():
                raise HTTPException(
                    status_code=400,
                    detail=f"Pipeline '{request.name}' already exists"
                )

            # Create pipeline
            create_pipeline(pipeline_dir, request, tool)

            # Ensure required env vars exist in .env
            ensure_env_vars_exist(
                app.state.repo_path,
                request.name,
                request.source_type,
                request.destination_type
            )

            # Don't auto-commit - let user review changes and commit manually

            return {
                "success": True,
                "message": f"Created {tool} pipeline: {request.name}",
                "tool": tool,
                "path": str(pipeline_dir.relative_to(app.state.repo_path))
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.put("/api/pipelines/{tool}/{name}")
    async def update_pipeline(tool: str, name: str, request: PipelineRequest):
        """Update an existing pipeline."""
        try:
            pipeline_dir = app.state.repo_path / "pipelines" / tool / name

            if not pipeline_dir.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Pipeline '{name}' not found"
                )

            # Recreate pipeline with new configuration
            create_pipeline(pipeline_dir, request, tool)

            # Ensure required env vars exist in .env
            ensure_env_vars_exist(
                app.state.repo_path,
                request.name,
                request.source_type,
                request.destination_type
            )

            # Don't auto-commit - let user review changes and commit manually

            return {
                "success": True,
                "message": f"Updated {tool} pipeline: {request.name}",
                "tool": tool,
                "path": str(pipeline_dir.relative_to(app.state.repo_path))
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.delete("/api/pipelines/{tool}/{name}")
    async def delete_pipeline(tool: str, name: str):
        """Delete a pipeline."""
        try:
            pipeline_dir = app.state.repo_path / "pipelines" / tool / name

            if not pipeline_dir.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Pipeline '{name}' not found"
                )

            # Delete directory
            shutil.rmtree(pipeline_dir)

            # Don't auto-commit - let user review changes and commit manually

            return {
                "success": True,
                "message": f"Deleted pipeline: {name}"
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.patch("/api/pipelines/{tool}/{name}/toggle")
    async def toggle_pipeline(tool: str, name: str, data: dict):
        """Toggle pipeline enabled status."""
        try:
            pipeline_dir = app.state.repo_path / "pipelines" / tool / name
            dagster_yaml_path = pipeline_dir / "dagster.yaml"

            if not dagster_yaml_path.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Pipeline '{name}' dagster.yaml not found"
                )

            # Read current dagster.yaml
            with open(dagster_yaml_path) as f:
                config = yaml.safe_load(f) or {}

            # Toggle enabled status
            enabled = data.get("enabled", True)
            config["enabled"] = enabled

            # Write back to file
            with open(dagster_yaml_path, "w") as f:
                yaml.dump(config, f, sort_keys=False, default_flow_style=False)

            # Don't auto-commit toggle changes - let user review and commit manually
            # This allows batching multiple toggles before committing

            return {
                "success": True,
                "message": f"Pipeline {'enabled' if enabled else 'disabled'}",
                "enabled": enabled
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/pipelines/{tool}/{name}/metadata")
    async def get_pipeline_metadata(tool: str, name: str):
        """Get metadata from dagster.yaml for a pipeline."""
        try:
            pipeline_dir = app.state.repo_path / "pipelines" / tool / name
            dagster_yaml_path = pipeline_dir / "dagster.yaml"

            if not dagster_yaml_path.exists():
                # Return default metadata if file doesn't exist
                return {
                    "enabled": True,
                    "description": None,
                    "group_name": "default",
                    "owners": [],
                    "tags": {},
                    "kinds": [],
                    "retries": 2,
                    "retry_delay": 30,
                    "retry_backoff": "LINEAR",
                    "retry_jitter": None
                }

            # Read dagster.yaml
            with open(dagster_yaml_path) as f:
                config = yaml.safe_load(f) or {}

            # Extract retry policy
            retry_policy = config.get("retry_policy", {})
            retries = retry_policy.get("max_retries", config.get("retries", 2))
            retry_delay = retry_policy.get("delay", config.get("retry_delay", 30))
            retry_backoff = retry_policy.get("backoff", "LINEAR")
            retry_jitter = retry_policy.get("jitter")

            return {
                "enabled": config.get("enabled", True),
                "description": config.get("description"),
                "group_name": config.get("group", "default"),
                "owners": config.get("owners", []),
                "tags": config.get("tags", {}),
                "kinds": config.get("kinds", []),
                "retries": retries,
                "retry_delay": retry_delay,
                "retry_backoff": retry_backoff,
                "retry_jitter": retry_jitter
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.put("/api/pipelines/{tool}/{name}/metadata")
    async def update_pipeline_metadata(tool: str, name: str, metadata: dict):
        """Update metadata in dagster.yaml for a pipeline."""
        try:
            pipeline_dir = app.state.repo_path / "pipelines" / tool / name
            dagster_yaml_path = pipeline_dir / "dagster.yaml"

            if not pipeline_dir.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Pipeline '{name}' not found"
                )

            # Read current config or create new
            if dagster_yaml_path.exists():
                with open(dagster_yaml_path) as f:
                    config = yaml.safe_load(f) or {}
            else:
                config = {}

            # Update metadata fields
            config["enabled"] = metadata.get("enabled", True)

            if metadata.get("description"):
                config["description"] = metadata["description"]
            elif "description" in config:
                del config["description"]

            config["group"] = metadata.get("group_name", "default")

            if metadata.get("owners"):
                config["owners"] = metadata["owners"]
            elif "owners" in config:
                del config["owners"]

            if metadata.get("tags"):
                config["tags"] = metadata["tags"]
            elif "tags" in config:
                del config["tags"]

            if metadata.get("kinds"):
                config["kinds"] = metadata["kinds"]
            elif "kinds" in config:
                del config["kinds"]

            # Update retry policy
            retry_policy = {
                "max_retries": metadata.get("retries", 2),
                "delay": metadata.get("retry_delay", 30)
            }

            retry_backoff = metadata.get("retry_backoff", "LINEAR")
            if retry_backoff != "LINEAR":
                retry_policy["backoff"] = retry_backoff

            retry_jitter = metadata.get("retry_jitter")
            if retry_jitter:
                retry_policy["jitter"] = retry_jitter

            config["retry_policy"] = retry_policy

            # Write back to file
            with open(dagster_yaml_path, "w") as f:
                yaml.dump(config, f, sort_keys=False, default_flow_style=False)

            return {
                "success": True,
                "message": f"Updated metadata for pipeline: {name}"
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/sources")
    async def get_sources():
        """Get available source types."""
        sources = list(SOURCE_CREDENTIALS.keys())
        return sorted(sources)

    @app.get("/api/destinations")
    async def get_destinations():
        """Get available destination types."""
        destinations = list(DESTINATION_CREDENTIALS.keys())
        return sorted(destinations)

    @app.get("/api/sources/consolidated")
    async def get_sources_consolidated():
        """Get available sources with tool support information."""
        # API/SaaS sources - DLT only
        api_sources = {
            "github", "stripe", "shopify", "hubspot", "salesforce",
            "google_analytics", "facebook_ads", "google_ads", "slack", "notion",
            "airtable", "asana", "jira", "zendesk", "intercom", "mixpanel",
            "segment", "rest_api"
        }

        # Database sources - primarily Sling, but some supported by DLT too
        db_sources = {
            "postgres", "mysql", "mongodb", "mssql", "oracle", "snowflake",
            "bigquery", "redshift", "databricks", "trino", "clickhouse"
        }

        # Storage sources - DLT only
        storage_sources = {"s3", "gcs", "azure_blob", "csv", "json", "parquet"}

        sources = []
        for source_name in sorted(SOURCE_CREDENTIALS.keys()):
            tools = []

            if source_name in api_sources or source_name in storage_sources:
                tools.append("dlt")

            if source_name in db_sources:
                # Most databases support both
                if source_name in {"postgres", "mysql", "mssql", "oracle"}:
                    tools.extend(["dlt", "sling"])
                else:
                    tools.append("dlt")

            # If not categorized, default to dlt
            if not tools:
                tools.append("dlt")

            sources.append({
                "name": source_name,
                "display_name": source_name.replace("_", " ").title(),
                "tools": tools
            })

        return sources

    @app.get("/api/destinations/consolidated")
    async def get_destinations_consolidated():
        """Get available destinations with tool support information."""
        # File-based destinations - DLT only
        file_based = {
            "filesystem", "duckdb", "motherduck", "s3", "gcs", "azure_blob"
        }

        # Database/warehouse destinations - support both tools
        db_destinations = {
            "postgres", "mysql", "snowflake", "bigquery", "redshift",
            "databricks", "mssql", "clickhouse", "trino"
        }

        # Analytics/search destinations - DLT only
        analytics = {"elasticsearch", "druid", "pinot"}

        destinations = []
        for dest_name in sorted(DESTINATION_CREDENTIALS.keys()):
            tools = []

            if dest_name in file_based or dest_name in analytics:
                tools.append("dlt")

            if dest_name in db_destinations:
                # Most databases support both
                if dest_name in {"postgres", "mysql", "snowflake", "bigquery",
                                  "redshift", "databricks", "mssql"}:
                    tools.extend(["dlt", "sling"])
                else:
                    tools.append("dlt")

            # If not categorized, default to dlt
            if not tools:
                tools.append("dlt")

            destinations.append({
                "name": dest_name,
                "display_name": dest_name.replace("_", " ").title(),
                "tools": tools
            })

        return destinations

    @app.get("/api/credentials/{source_or_destination}")
    async def get_credentials_for_type(source_or_destination: str):
        """Get required credentials for a source or destination."""
        # Check both sources and destinations
        if source_or_destination in SOURCE_CREDENTIALS:
            return SOURCE_CREDENTIALS[source_or_destination]
        elif source_or_destination in DESTINATION_CREDENTIALS:
            return DESTINATION_CREDENTIALS[source_or_destination]
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown type: {source_or_destination}"
            )

    @app.get("/api/source-configuration/{source_type}")
    async def get_source_config(source_type: str):
        """Get source configuration fields."""
        config_fields = get_source_configuration(source_type)
        return config_fields

    @app.post("/api/tool-recommendation")
    async def recommend_tool(data: dict):
        """Recommend a tool based on source and destination."""
        source_type = data.get("source_type")
        destination_type = data.get("destination_type")

        if not source_type or not destination_type:
            raise HTTPException(
                status_code=400,
                detail="Both source_type and destination_type required"
            )

        tool = choose_tool(source_type, destination_type)
        return {"tool": tool}

    @app.get("/api/openapi-sources")
    async def get_openapi_sources():
        """Get list of available OpenAPI specs from dlt-hub/openapi-specs repository."""
        import requests

        try:
            # Fetch directories from the open_api_specs folder
            base_url = "https://api.github.com/repos/dlt-hub/openapi-specs/contents/open_api_specs"
            response = requests.get(base_url)
            response.raise_for_status()
            directories = response.json()

            all_sources = []

            # Fetch specs from each category directory
            for directory in directories:
                if directory["type"] == "dir":
                    category = directory["name"]
                    # Skip broken specs
                    if category.lower() == "broken":
                        continue

                    dir_url = directory["url"]
                    dir_response = requests.get(dir_url)
                    dir_response.raise_for_status()
                    specs = dir_response.json()

                    for spec in specs:
                        if spec["type"] == "file" and (spec["name"].endswith(".yaml") or spec["name"].endswith(".json")):
                            name = spec["name"].replace(".yaml", "").replace(".json", "")
                            all_sources.append({
                                "name": name,
                                "category": category,
                                "download_url": spec["download_url"],
                                "file_type": "yaml" if spec["name"].endswith(".yaml") else "json"
                            })

            # Sort by name
            all_sources.sort(key=lambda x: x["name"])

            return {
                "sources": all_sources,
                "total": len(all_sources)
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch OpenAPI sources: {str(e)}"
            )

    @app.post("/api/openapi-sources/generate")
    async def generate_from_openapi(data: dict):
        """Generate a dlt pipeline from an OpenAPI spec."""
        import subprocess
        import tempfile
        import requests

        spec_name = data.get("spec_name")
        download_url = data.get("download_url")
        pipeline_name = data.get("pipeline_name") or spec_name

        if not spec_name or not download_url:
            raise HTTPException(
                status_code=400,
                detail="spec_name and download_url are required"
            )

        try:
            # Download the OpenAPI spec
            spec_response = requests.get(download_url)
            spec_response.raise_for_status()

            # Save spec to temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                f.write(spec_response.text)
                spec_file = f.name

            # Determine output directory
            dlt_dir = app.state.repo_path / "pipelines" / "dlt"
            dlt_dir.mkdir(parents=True, exist_ok=True)

            # Run dlt-init-openapi to generate pipeline
            result = subprocess.run(
                [
                    "dlt",
                    "init-openapi",
                    "--spec", spec_file,
                    "--pipeline-name", pipeline_name,
                    "--output-dir", str(dlt_dir / pipeline_name)
                ],
                capture_output=True,
                text=True,
                cwd=str(app.state.repo_path)
            )

            # Clean up temp file
            os.unlink(spec_file)

            if result.returncode != 0:
                raise Exception(f"dlt-init-openapi failed: {result.stderr}")

            # Create dagster.yaml metadata
            dagster_yaml_path = dlt_dir / pipeline_name / "dagster.yaml"
            dagster_metadata = {
                "enabled": True,
                "description": f"Pipeline generated from OpenAPI spec: {spec_name}",
                "group": "openapi_generated",
                "kinds": ["dlt", "rest_api", spec_name],
                "tags": {
                    "generated_from": "openapi_spec",
                    "source_spec": spec_name
                },
                "schedule": {
                    "enabled": False
                },
                "retries": 3,
                "retry_delay": 60
            }

            with open(dagster_yaml_path, 'w') as f:
                yaml.dump(dagster_metadata, f, default_flow_style=False)

            return {
                "success": True,
                "message": f"Pipeline '{pipeline_name}' generated successfully from OpenAPI spec",
                "pipeline_path": str(dlt_dir / pipeline_name)
            }

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate pipeline: {str(e)}"
            )

    @app.get("/api/git/status")
    async def git_status():
        """Get comprehensive git repository status including sync status with remote."""
        if not (app.state.repo_path / ".git").exists():
            return {"is_repo": False}

        try:
            repo = Repo(app.state.repo_path)
            has_remote = bool(repo.remotes)

            result = {
                "is_repo": True,
                "branch": repo.active_branch.name,
                "is_dirty": repo.is_dirty(),
                "untracked_files": repo.untracked_files,
                "has_remote": has_remote,
                "commits_ahead": 0,
                "commits_behind": 0,
                "is_diverged": False
            }

            # If we have a remote, check sync status
            if has_remote:
                try:
                    origin = repo.remotes.origin
                    current_branch = repo.active_branch.name

                    # Fetch latest from remote (lightweight, just updates refs)
                    origin.fetch()

                    # Get commits behind/ahead
                    local_commit = repo.head.commit
                    remote_commit = origin.refs[current_branch].commit
                    commits_behind = list(repo.iter_commits(f'{local_commit}..{remote_commit}'))
                    commits_ahead = list(repo.iter_commits(f'{remote_commit}..{local_commit}'))

                    result.update({
                        "commits_ahead": len(commits_ahead),
                        "commits_behind": len(commits_behind),
                        "is_diverged": len(commits_ahead) > 0 and len(commits_behind) > 0
                    })
                except Exception as e:
                    # If we can't check remote status, just continue with local info
                    result["remote_check_error"] = str(e)

            return result
        except Exception as e:
            return {"is_repo": False, "error": str(e)}

    @app.post("/api/git/commit")
    async def git_commit(data: dict):
        """Commit changes to git."""
        message = data.get("message", "Update pipelines")

        if not (app.state.repo_path / ".git").exists():
            raise HTTPException(status_code=400, detail="Not a git repository")

        try:
            repo = Repo(app.state.repo_path)
            repo.git.add(A=True)
            repo.index.commit(message)

            return {
                "success": True,
                "message": "Changes committed"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/git/push")
    async def git_push():
        """Push changes to remote."""
        if not (app.state.repo_path / ".git").exists():
            raise HTTPException(status_code=400, detail="Not a git repository")

        try:
            repo = Repo(app.state.repo_path)

            if not repo.remotes:
                raise HTTPException(status_code=400, detail="No remote configured")

            origin = repo.remotes.origin
            current_branch = repo.active_branch.name

            # Check if we're behind remote before pushing
            try:
                origin.fetch()
                local_commit = repo.head.commit
                remote_commit = origin.refs[current_branch].commit
                commits_behind = list(repo.iter_commits(f'{local_commit}..{remote_commit}'))

                if len(commits_behind) > 0:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Push rejected: Your branch is behind remote by {len(commits_behind)} commit(s). Pull first to integrate remote changes."
                    )
            except HTTPException:
                raise
            except Exception:
                # If we can't check, try to push anyway
                pass

            # Attempt the push
            push_info = origin.push()

            # Check if push was successful
            if push_info and push_info[0].flags & 1024:  # ERROR flag
                raise HTTPException(
                    status_code=500,
                    detail=f"Push failed: {push_info[0].summary}"
                )

            return {
                "success": True,
                "message": "Pushed to remote"
            }
        except HTTPException:
            raise
        except Exception as e:
            error_msg = str(e)
            # Provide more helpful error messages
            if "rejected" in error_msg.lower():
                raise HTTPException(
                    status_code=409,
                    detail=f"Push rejected: Remote has changes you don't have locally. Pull first.\n\nDetails: {error_msg}"
                )
            raise HTTPException(status_code=500, detail=f"Push failed: {error_msg}")

    @app.get("/api/git/diff")
    async def git_diff():
        """Get git diff of uncommitted changes."""
        if not (app.state.repo_path / ".git").exists():
            raise HTTPException(status_code=400, detail="Not a git repository")

        try:
            repo = Repo(app.state.repo_path)

            # Get diff of unstaged changes
            unstaged_diff = repo.git.diff()

            # Get diff of staged changes
            staged_diff = repo.git.diff('--cached')

            # Get list of untracked files
            untracked = repo.untracked_files

            return {
                "unstaged": unstaged_diff,
                "staged": staged_diff,
                "untracked": untracked
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/git/log")
    async def git_log(limit: int = 20):
        """Get git commit history."""
        if not (app.state.repo_path / ".git").exists():
            raise HTTPException(status_code=400, detail="Not a git repository")

        try:
            repo = Repo(app.state.repo_path)

            commits = []
            for commit in list(repo.iter_commits(max_count=limit)):
                commits.append({
                    "sha": commit.hexsha[:7],
                    "message": commit.message.strip(),
                    "author": str(commit.author),
                    "date": commit.committed_datetime.isoformat(),
                    "full_sha": commit.hexsha
                })

            return {"commits": commits}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/git/revert")
    async def git_revert():
        """Revert uncommitted changes."""
        if not (app.state.repo_path / ".git").exists():
            raise HTTPException(status_code=400, detail="Not a git repository")

        try:
            repo = Repo(app.state.repo_path)

            # Reset all changes
            repo.git.reset('--hard', 'HEAD')

            # Clean untracked files
            repo.git.clean('-fd')

            return {
                "success": True,
                "message": "All uncommitted changes reverted"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/git/init")
    async def git_init():
        """Initialize a new git repository."""
        if (app.state.repo_path / ".git").exists():
            raise HTTPException(status_code=400, detail="Already a git repository")

        try:
            repo = Repo.init(app.state.repo_path)

            # Create initial commit
            repo.git.add(A=True)
            repo.index.commit("Initial commit: ELT pipelines repository")

            return {
                "success": True,
                "message": "Git repository initialized"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/git/add-remote")
    async def git_add_remote(data: dict):
        """Add a remote to existing git repository."""
        remote_url = data.get("remote_url")
        remote_name = data.get("remote_name", "origin")

        if not remote_url:
            raise HTTPException(status_code=400, detail="remote_url is required")

        if not (app.state.repo_path / ".git").exists():
            raise HTTPException(status_code=400, detail="Not a git repository")

        try:
            repo = Repo(app.state.repo_path)

            # Check if remote already exists
            if remote_name in [r.name for r in repo.remotes]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Remote '{remote_name}' already exists"
                )

            # Add the remote
            repo.create_remote(remote_name, remote_url)

            return {
                "success": True,
                "message": f"Remote '{remote_name}' added successfully"
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/git/clone")
    async def git_clone(data: dict):
        """Clone a repository (replaces current repo directory)."""
        repo_url = data.get("repo_url")

        if not repo_url:
            raise HTTPException(status_code=400, detail="repo_url is required")

        try:
            # Backup existing directory if it exists and has content
            if app.state.repo_path.exists():
                files = list(app.state.repo_path.iterdir())
                if files:
                    # Only allow clone if directory is empty or user explicitly wants to replace
                    raise HTTPException(
                        status_code=400,
                        detail="Directory not empty. Please use a different path or delete existing content."
                    )

            # Clone the repository
            repo = Repo.clone_from(repo_url, app.state.repo_path)

            return {
                "success": True,
                "message": f"Repository cloned successfully",
                "branch": repo.active_branch.name
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


    @app.post("/api/git/pull")
    async def git_pull():
        """Pull latest changes from remote."""
        try:
            repo_path = app.state.repo_path

            if not (repo_path / ".git").exists():
                raise HTTPException(status_code=400, detail="Not a git repository")

            repo = Repo(repo_path)

            if not repo.remotes:
                raise HTTPException(status_code=400, detail="No remote configured")

            origin = repo.remotes.origin
            current_branch = repo.active_branch.name

            # Pull changes
            pull_info = origin.pull(current_branch)

            return {
                "success": True,
                "message": f"Pulled latest changes from {current_branch}",
                "changes": len(pull_info)
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # Environment Variables Management
    @app.get("/api/env")
    async def list_env_vars():
        """List all environment variables from .env file with pipeline dependencies."""
        env_file = app.state.repo_path / ".env"
        env_metadata = app.state.repo_path / ".env.metadata.json"

        if not env_file.exists():
            return {"variables": {}, "pipeline_vars": {}}

        try:
            import json

            variables = {}
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        # Mask sensitive values
                        if any(sensitive in key.upper() for sensitive in ['PASSWORD', 'SECRET', 'KEY', 'TOKEN']):
                            variables[key] = '********' if value else ''
                        else:
                            variables[key] = value if value else ''

            # Read metadata to get pipeline dependencies
            pipeline_vars = {}
            if env_metadata.exists():
                with open(env_metadata, 'r') as f:
                    metadata = json.load(f)
                    pipeline_vars = metadata.get("pipeline_vars", {})

            # Invert to get var -> pipelines mapping
            var_pipelines = {}
            for pipeline, vars in pipeline_vars.items():
                for var in vars:
                    if var not in var_pipelines:
                        var_pipelines[var] = []
                    var_pipelines[var].append(pipeline)

            return {
                "variables": variables,
                "var_pipelines": var_pipelines
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/env")
    async def set_env_var(data: dict):
        """Set or update an environment variable in .env file."""
        key = data.get("key")
        value = data.get("value")

        if not key:
            raise HTTPException(status_code=400, detail="key is required")

        env_file = app.state.repo_path / ".env"

        try:
            # Read existing env vars
            existing_lines = []
            key_found = False

            if env_file.exists():
                with open(env_file, 'r') as f:
                    for line in f:
                        if line.strip().startswith(f"{key}="):
                            if value:  # Update
                                existing_lines.append(f"{key}={value}\n")
                                key_found = True
                            # If value is None, skip the line (delete)
                        else:
                            existing_lines.append(line)

            # Add new key if not found and value is provided
            if not key_found and value:
                existing_lines.append(f"{key}={value}\n")

            # Write back to file
            with open(env_file, 'w') as f:
                f.writelines(existing_lines)

            return {
                "success": True,
                "message": f"Environment variable '{key}' {'updated' if key_found else 'added'}"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.delete("/api/env/{key}")
    async def delete_env_var(key: str):
        """Delete an environment variable from .env file."""
        env_file = app.state.repo_path / ".env"

        if not env_file.exists():
            raise HTTPException(status_code=404, detail=".env file not found")

        try:
            # Read and filter out the key
            existing_lines = []
            found = False

            with open(env_file, 'r') as f:
                for line in f:
                    if not line.strip().startswith(f"{key}="):
                        existing_lines.append(line)
                    else:
                        found = True

            if not found:
                raise HTTPException(status_code=404, detail=f"Key '{key}' not found")

            # Write back
            with open(env_file, 'w') as f:
                f.writelines(existing_lines)

            return {
                "success": True,
                "message": f"Environment variable '{key}' deleted"
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/env/sync-dagster-plus-with-values")
    async def sync_to_dagster_plus_with_values(data: dict):
        """Sync environment variables to Dagster+ with specific values for each scope."""
        configs = data.get("configs", [])  # List of {key, value, scope, code_location}

        if not configs:
            raise HTTPException(status_code=400, detail="configs list is required")

        try:
            import subprocess

            results = []
            for config in configs:
                key = config.get("key")
                value = config.get("value")
                scope = config.get("scope")  # "full" or "branch"
                code_location = config.get("code_location")

                if not key or not value:
                    results.append({
                        "key": key,
                        "scope": scope,
                        "success": False,
                        "error": "Missing key or value"
                    })
                    continue

                # Build dg command
                cmd = ["dg", "plus", "create", "env", key, "--value", value]

                # Add scope flag
                if scope == "full":
                    cmd.append("--full-deployment")
                elif scope == "branch":
                    cmd.append("--branch-deployments")

                # Add code location scope if specified
                if code_location:
                    cmd.extend(["--code-location", code_location])

                # Run command
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    cwd=app.state.repo_path
                )

                results.append({
                    "key": key,
                    "scope": scope,
                    "success": result.returncode == 0,
                    "output": result.stdout,
                    "error": result.stderr
                })

            return {
                "success": all(r["success"] for r in results),
                "results": results
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ============================================================================
    # Repository Configuration Endpoints
    # ============================================================================

    @app.get("/api/config/repo-path")
    async def get_repo_path():
        """Get the current repository path."""
        repo_path = app.state.repo_path
        validation = validate_repo_path(repo_path)
        return {
            "path": str(repo_path),
            "validation": validation
        }

    @app.post("/api/config/repo-path")
    async def set_repo_path(data: dict):
        """Set a new repository path."""
        new_path = data.get("path")
        if not new_path:
            raise HTTPException(status_code=400, detail="path is required")

        new_path = Path(new_path).expanduser().resolve()

        # Validate the path
        validation = validate_repo_path(new_path)
        if not validation.get("valid"):
            raise HTTPException(status_code=400, detail=validation.get("error", "Invalid path"))

        # Update app state
        app.state.repo_path = new_path

        # Save to config
        config = load_config()
        config["last_repo_path"] = str(new_path)
        save_config(config)

        return {
            "success": True,
            "path": str(new_path),
            "validation": validation
        }

    @app.get("/api/config/browse")
    async def browse_directories(path: Optional[str] = None):
        """Browse directories for repository selection."""
        if path:
            current_path = Path(path).expanduser().resolve()
        else:
            current_path = Path.home()

        if not current_path.exists() or not current_path.is_dir():
            current_path = Path.home()

        try:
            # Get parent directory
            parent = current_path.parent if current_path != current_path.parent else None

            # Get subdirectories
            subdirs = []
            try:
                for item in sorted(current_path.iterdir()):
                    if item.is_dir() and not item.name.startswith('.'):
                        # Check if it's an ELT repo
                        validation = validate_repo_path(item)
                        subdirs.append({
                            "name": item.name,
                            "path": str(item),
                            "is_elt_repo": validation.get("valid") and validation.get("pipeline_count", 0) > 0,
                            "pipeline_count": validation.get("pipeline_count", 0)
                        })
            except PermissionError:
                pass

            return {
                "current": str(current_path),
                "parent": str(parent) if parent else None,
                "directories": subdirs
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/config/validate")
    async def validate_path(path: str):
        """Validate a repository path."""
        path_obj = Path(path).expanduser().resolve()
        validation = validate_repo_path(path_obj)
        return validation

    # ========================================
    # Dagster Project Export
    # ========================================

    @app.post("/api/export-dagster-project")
    async def export_dagster_project(request: DagsterProjectExportRequest):
        """Export a complete Dagster orchestration project."""
        try:
            output_dir = Path.home() / "dagster-exports" / request.project_name
            output_dir.parent.mkdir(parents=True, exist_ok=True)

            if output_dir.exists():
                shutil.rmtree(output_dir)

            # Simplified version for now - just create basic structure
            output_dir.mkdir()

            return JSONResponse({
                "status": "success",
                "message": f"Dagster project '{request.project_name}' created successfully!",
                "project_path": str(output_dir),
                "next_steps": [
                    f"1. Navigate to: cd {output_dir}",
                    "2. Set up your project"
                ]
            })

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to export project: {str(e)}")


    # ========================================
    # dbt Integration
    # ========================================

    @app.get("/api/dbt-packages/available")
    async def get_available_dbt_packages(source: Optional[str] = None):
        """Get available dbt packages from dlt-hub."""
        try:
            dbt_packages = {
                "stripe": {"package": "dlt-hub/stripe_source", "version": ">=0.1.0", "description": "dbt models for Stripe data", "models": ["stg_stripe__customers"], "docs_url": "https://hub.getdbt.com/dlt-hub/stripe_source"},
                "hubspot": {"package": "dlt-hub/hubspot_source", "version": ">=0.1.0", "description": "dbt models for HubSpot CRM data", "models": ["stg_hubspot__contacts"], "docs_url": "https://hub.getdbt.com/dlt-hub/hubspot_source"},
                "github": {"package": "dlt-hub/github_source", "version": ">=0.1.0", "description": "dbt models for GitHub data", "models": ["stg_github__issues"], "docs_url": "https://hub.getdbt.com/dlt-hub/github_source"},
                "salesforce": {"package": "dlt-hub/salesforce_source", "version": ">=0.1.0", "description": "dbt models for Salesforce CRM data", "models": ["stg_salesforce__accounts"], "docs_url": "https://hub.getdbt.com/dlt-hub/salesforce_source"},
                "google_analytics": {"package": "dlt-hub/google_analytics_source", "version": ">=0.1.0", "description": "dbt models for Google Analytics data", "models": ["stg_ga__events"], "docs_url": "https://hub.getdbt.com/dlt-hub/google_analytics_source"},
                "shopify": {"package": "dlt-hub/shopify_source", "version": ">=0.1.0", "description": "dbt models for Shopify e-commerce data", "models": ["stg_shopify__orders"], "docs_url": "https://hub.getdbt.com/dlt-hub/shopify_source"},
                "facebook_ads": {"package": "dlt-hub/facebook_ads_source", "version": ">=0.1.0", "description": "dbt models for Facebook Ads data", "models": ["stg_facebook_ads__campaigns"], "docs_url": "https://hub.getdbt.com/dlt-hub/facebook_ads_source"},
                "google_ads": {"package": "dlt-hub/google_ads_source", "version": ">=0.1.0", "description": "dbt models for Google Ads data", "models": ["stg_google_ads__campaigns"], "docs_url": "https://hub.getdbt.com/dlt-hub/google_ads_source"}
            }

            if source:
                source_lower = source.lower().replace('_', '').replace('-', '')
                for pkg_source, pkg_info in dbt_packages.items():
                    if pkg_source.replace('_', '').replace('-', '') == source_lower:
                        return {"available": True, "source": source, "package": pkg_info}
                return {"available": False, "source": source, "message": f"No dbt package available for {source}"}
            else:
                return {"packages": dbt_packages}

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch dbt packages: {str(e)}")


    @app.post("/api/dbt-packages/add")
    async def add_dbt_to_pipeline(request: DbtPackageRequest):
        """Add dbt models to an existing pipeline."""
        try:
            repo_path = get_repo_path()
            pipeline_dir = repo_path / "pipelines" / request.pipeline_tool / request.pipeline_name

            if not pipeline_dir.exists():
                raise HTTPException(status_code=404, detail=f"Pipeline {request.pipeline_name} not found")

            # Create dbt directory structure
            dbt_dir = pipeline_dir / "dbt"
            dbt_dir.mkdir(exist_ok=True)

            # Create dbt_project.yml
            dbt_project_content = f"""name: '{request.pipeline_name}_dbt'
version: '1.0.0'
config-version: 2

profile: '{request.pipeline_name}'

model-paths: ["models"]

models:
  {request.pipeline_name}_dbt:
    +materialized: table
"""

            with open(dbt_dir / "dbt_project.yml", 'w') as f:
                f.write(dbt_project_content)

            # Create packages.yml with dbt package
            if request.dbt_package:
                packages_content = f"""packages:
  - package: {request.dbt_package}
    version: [">=0.1.0"]
"""
                with open(dbt_dir / "packages.yml", 'w') as f:
                    f.write(packages_content)

            # Create models directory
            models_dir = dbt_dir / "models"
            models_dir.mkdir(exist_ok=True)

            # ========================================
            # Auto-generate profiles.yml from dlt config
            # ========================================

            profiles_yml_content = None
            profiles_warning = None

            try:
                # Read pipeline config.yaml to get destination instance
                pipeline_config_path = pipeline_dir / "config.yaml"
                destination_instance = None
                if pipeline_config_path.exists():
                    with open(pipeline_config_path) as f:
                        pipeline_config = yaml.safe_load(f)
                        if pipeline_config:
                            destination_instance = pipeline_config.get('destination_instance')

                # Read dlt configuration
                dlt_dir = pipeline_dir / ".dlt"
                config_path = dlt_dir / "config.toml"
                secrets_path = dlt_dir / "secrets.toml"

                destination_config = {}
                destination_type = None

                # Parse config.toml
                if config_path.exists():
                    import toml
                    config = toml.load(config_path)
                    if 'destination' in config:
                        destination_config.update(config['destination'])
                        # Get the first destination type
                        for key in config['destination'].keys():
                            if key not in ['credentials', 'dataset_name', 'schema_name']:
                                destination_type = key
                                if isinstance(config['destination'][key], dict):
                                    destination_config.update(config['destination'][key])
                                break

                # Parse secrets.toml (overwrites config values)
                if secrets_path.exists():
                    import toml
                    secrets = toml.load(secrets_path)
                    if 'destination' in secrets:
                        destination_config.update(secrets['destination'])
                        if not destination_type:
                            for key in secrets['destination'].keys():
                                if key not in ['credentials', 'dataset_name', 'schema_name']:
                                    destination_type = key
                                    if isinstance(secrets['destination'][key], dict):
                                        destination_config.update(secrets['destination'][key])
                                    break

                # Generate profiles.yml based on destination type
                # Use environment variables for credentials (matching Dagster's approach)
                if destination_type:
                    # Build env var prefix based on instance
                    instance_suffix = f"_{destination_instance.upper()}" if destination_instance else ""
                    instance_note = f" (instance: {destination_instance})" if destination_instance else ""

                    profiles_yml_content = f"""# dbt profile auto-generated from dlt configuration
# Profile name matches dbt_project.yml
# Credentials are referenced from environment variables (same as dlt pipeline){instance_note}
{request.pipeline_name}:
  target: dev
  outputs:
    dev:
"""

                    if destination_type in ['bigquery', 'gcp']:
                        # BigQuery configuration - use same env vars as dlt
                        dataset = destination_config.get('dataset_name', 'dlt_data')

                        profiles_yml_content += f"""      type: bigquery
      method: service-account-json
      project: "{{{{ env_var('GCP{instance_suffix}_PROJECT_ID') }}}}"
      dataset: {dataset}
      keyfile_json: "{{{{ env_var('GCP{instance_suffix}_CREDENTIALS') }}}}"
      threads: 4
      timeout_seconds: 300

# Environment Variables (same as dlt pipeline):
# - GCP{instance_suffix}_PROJECT_ID: Your GCP project ID
# - GCP{instance_suffix}_CREDENTIALS: Service account JSON as string
"""

                    elif destination_type == 'duckdb':
                        # DuckDB configuration - use same env var as dlt/Sling
                        schema = destination_config.get('schema_name', 'main')

                        profiles_yml_content += f"""      type: duckdb
      path: "{{{{ env_var('DEST_DUCKDB{instance_suffix}_PATH', './data.duckdb') }}}}"
      schema: {schema}
      threads: 4

# Environment Variable (same as dlt/Sling):
# - DEST_DUCKDB{instance_suffix}_PATH: Path to DuckDB database file (default: ./data.duckdb)
"""

                    elif destination_type == 'snowflake':
                        # Snowflake configuration - use same env vars as dlt/Sling
                        schema = destination_config.get('schema_name', 'public')

                        profiles_yml_content += f"""      type: snowflake
      account: "{{{{ env_var('SNOWFLAKE{instance_suffix}_ACCOUNT') }}}}"
      user: "{{{{ env_var('SNOWFLAKE{instance_suffix}_USER') }}}}"
      password: "{{{{ env_var('SNOWFLAKE{instance_suffix}_PASSWORD') }}}}"
      role: "{{{{ env_var('SNOWFLAKE{instance_suffix}_ROLE') }}}}"
      database: "{{{{ env_var('SNOWFLAKE{instance_suffix}_DATABASE') }}}}"
      warehouse: "{{{{ env_var('SNOWFLAKE{instance_suffix}_WAREHOUSE') }}}}"
      schema: {schema}
      threads: 4

# Environment Variables (same as dlt/Sling):
# - SNOWFLAKE{instance_suffix}_ACCOUNT: Your Snowflake account identifier
# - SNOWFLAKE{instance_suffix}_USER: Snowflake username
# - SNOWFLAKE{instance_suffix}_PASSWORD: Snowflake password
# - SNOWFLAKE{instance_suffix}_DATABASE: Database name
# - SNOWFLAKE{instance_suffix}_WAREHOUSE: Warehouse name
# - SNOWFLAKE{instance_suffix}_ROLE: Role name
"""

                    elif destination_type in ['postgres', 'postgresql']:
                        # Postgres configuration - use same env vars as dlt/Sling (with DEST_ prefix for destination)
                        schema = destination_config.get('schema_name', 'public')

                        profiles_yml_content += f"""      type: postgres
      host: "{{{{ env_var('DEST_POSTGRES{instance_suffix}_HOST', 'localhost') }}}}"
      port: "{{{{ env_var('DEST_POSTGRES{instance_suffix}_PORT', '5432') | int }}}}"
      user: "{{{{ env_var('DEST_POSTGRES{instance_suffix}_USER') }}}}"
      password: "{{{{ env_var('DEST_POSTGRES{instance_suffix}_PASSWORD') }}}}"
      dbname: "{{{{ env_var('DEST_POSTGRES{instance_suffix}_DATABASE') }}}}"
      schema: {schema}
      threads: 4

# Environment Variables (same as dlt/Sling - note DEST_ prefix):
# - DEST_POSTGRES{instance_suffix}_HOST: Database host (default: localhost)
# - DEST_POSTGRES{instance_suffix}_PORT: Database port (default: 5432)
# - DEST_POSTGRES{instance_suffix}_USER: Database username
# - DEST_POSTGRES{instance_suffix}_PASSWORD: Database password
# - DEST_POSTGRES{instance_suffix}_DATABASE: Database name
"""

                    elif destination_type == 'redshift':
                        # Redshift configuration - use same env vars as dlt/Sling
                        schema = destination_config.get('schema_name', 'public')

                        profiles_yml_content += f"""      type: redshift
      host: "{{{{ env_var('REDSHIFT{instance_suffix}_HOST') }}}}"
      port: "{{{{ env_var('REDSHIFT{instance_suffix}_PORT', '5439') | int }}}}"
      user: "{{{{ env_var('REDSHIFT{instance_suffix}_USER') }}}}"
      password: "{{{{ env_var('REDSHIFT{instance_suffix}_PASSWORD') }}}}"
      dbname: "{{{{ env_var('REDSHIFT{instance_suffix}_DATABASE') }}}}"
      schema: {schema}
      threads: 4

# Environment Variables (same as dlt/Sling):
# - REDSHIFT{instance_suffix}_HOST: Redshift cluster endpoint
# - REDSHIFT{instance_suffix}_PORT: Database port (default: 5439)
# - REDSHIFT{instance_suffix}_USER: Database username
# - REDSHIFT{instance_suffix}_PASSWORD: Database password
# - REDSHIFT{instance_suffix}_DATABASE: Database name
"""

                    else:
                        profiles_warning = f"Destination type '{destination_type}' not recognized. You'll need to create profiles.yml manually."

                # Write profiles.yml if we generated it
                if profiles_yml_content:
                    with open(dbt_dir / "profiles.yml", 'w') as f:
                        f.write(profiles_yml_content)

            except Exception as e:
                profiles_warning = f"Could not auto-generate profiles.yml: {str(e)}. You'll need to create it manually."

            next_steps = [
                f"1. Navigate to: cd {dbt_dir}",
            ]

            if profiles_yml_content:
                next_steps.append("2. ✅ profiles.yml auto-generated with env var references!")
                next_steps.append("3. Ensure your environment variables are set (same as dlt pipeline)")
                next_steps.append("4. Install dbt packages: dbt deps")
                next_steps.append("5. Test connection: dbt debug")
                next_steps.append("6. Run transformations: dbt run")
            else:
                next_steps.append("2. ⚠️ Create profiles.yml with your destination credentials")
                next_steps.append("3. Install dbt packages: dbt deps")
                next_steps.append("4. Run transformations: dbt run")

            response_data = {
                "status": "success",
                "message": f"dbt models added to {request.pipeline_name}!",
                "dbt_dir": str(dbt_dir),
                "profiles_generated": profiles_yml_content is not None,
                "next_steps": next_steps
            }

            if profiles_warning:
                response_data["warning"] = profiles_warning

            return JSONResponse(response_data)

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to add dbt models: {str(e)}")


    # ========================================
    # Destination Management API
    # ========================================

    @app.get("/api/destinations")
    async def list_destinations(dagster_deployment: Optional[str] = None):
        """List all destinations, optionally filtered by Dagster deployment."""
        try:
            destinations = load_destinations()

            # Filter by deployment if specified
            if dagster_deployment:
                destinations = [d for d in destinations if d.get('dagster_deployment') == dagster_deployment]

            return JSONResponse({"destinations": destinations})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load destinations: {str(e)}")


    @app.post("/api/destinations")
    async def create_destination(request: DestinationCreate):
        """Create a new destination."""
        try:
            from datetime import datetime

            destinations = load_destinations()

            # Check for duplicate name
            if any(d['name'].lower() == request.name.lower() for d in destinations):
                raise HTTPException(status_code=400, detail=f"Destination with name '{request.name}' already exists")

            # Generate ID
            dest_id = generate_destination_id(request.name, request.type)

            # Create destination object
            now = datetime.utcnow().isoformat() + 'Z'
            destination = {
                "id": dest_id,
                "name": request.name,
                "type": request.type,
                "instance": request.instance,
                "description": request.description,
                "dagster_deployment": request.dagster_deployment,
                "created_at": now,
                "updated_at": now
            }

            destinations.append(destination)
            save_destinations(destinations)

            return JSONResponse({"status": "success", "destination": destination})
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create destination: {str(e)}")


    @app.get("/api/destinations/{destination_id}")
    async def get_destination(destination_id: str):
        """Get a specific destination by ID."""
        try:
            destinations = load_destinations()
            destination = next((d for d in destinations if d['id'] == destination_id), None)

            if not destination:
                raise HTTPException(status_code=404, detail=f"Destination '{destination_id}' not found")

            return JSONResponse({"destination": destination})
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get destination: {str(e)}")


    @app.put("/api/destinations/{destination_id}")
    async def update_destination(destination_id: str, request: DestinationUpdate):
        """Update a destination."""
        try:
            from datetime import datetime

            destinations = load_destinations()
            destination = next((d for d in destinations if d['id'] == destination_id), None)

            if not destination:
                raise HTTPException(status_code=404, detail=f"Destination '{destination_id}' not found")

            # Update fields
            if request.name is not None:
                # Check for duplicate name
                if any(d['id'] != destination_id and d['name'].lower() == request.name.lower() for d in destinations):
                    raise HTTPException(status_code=400, detail=f"Destination with name '{request.name}' already exists")
                destination['name'] = request.name

            if request.description is not None:
                destination['description'] = request.description

            if request.dagster_deployment is not None:
                destination['dagster_deployment'] = request.dagster_deployment

            destination['updated_at'] = datetime.utcnow().isoformat() + 'Z'

            save_destinations(destinations)

            return JSONResponse({"status": "success", "destination": destination})
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update destination: {str(e)}")


    @app.delete("/api/destinations/{destination_id}")
    async def delete_destination(destination_id: str):
        """Delete a destination."""
        try:
            destinations = load_destinations()
            destination = next((d for d in destinations if d['id'] == destination_id), None)

            if not destination:
                raise HTTPException(status_code=404, detail=f"Destination '{destination_id}' not found")

            # TODO: Check if any pipelines are using this destination

            destinations = [d for d in destinations if d['id'] != destination_id]
            save_destinations(destinations)

            return JSONResponse({"status": "success", "message": f"Destination '{destination['name']}' deleted"})
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete destination: {str(e)}")

    return app


def _get_pipeline_info(pipeline_dir: Path, tool_type: str) -> dict:
    """Get information about a pipeline."""
    dagster_yaml = pipeline_dir / "dagster.yaml"
    config_yaml = pipeline_dir / "config.yaml"

    info = {
        "name": pipeline_dir.name,
        "tool": tool_type,
        "description": "No description",
        "enabled": True,
        "source": "unknown",
        "destination": "unknown"
    }

    # Read dagster.yaml
    if dagster_yaml.exists():
        try:
            with open(dagster_yaml) as f:
                config = yaml.safe_load(f)
                if config:
                    info["description"] = config.get("description", info["description"])
                    info["enabled"] = config.get("enabled", info["enabled"])
        except Exception:
            pass

    # Read config.yaml
    if config_yaml.exists():
        try:
            with open(config_yaml) as f:
                config = yaml.safe_load(f)
                if config:
                    info["source"] = config.get("source_type", info["source"])
                    info["destination"] = config.get("destination_type", info["destination"])
                    info["config"] = config.get("configuration", {})
        except Exception:
            pass

    # Also read group, schedule, and metadata from dagster.yaml
    if dagster_yaml.exists():
        try:
            with open(dagster_yaml) as f:
                dagster_config = yaml.safe_load(f)
                if dagster_config:
                    info["group"] = dagster_config.get("group", dagster_config.get("group_name", ""))
                    if "schedule" in dagster_config:
                        info["schedule"] = dagster_config["schedule"]
                    info["owners"] = dagster_config.get("owners", [])
                    info["tags"] = dagster_config.get("tags", {})
                    info["kinds"] = dagster_config.get("kinds", [])

                    # Handle retry policy (new format) or legacy format
                    if "retry_policy" in dagster_config:
                        retry_policy = dagster_config["retry_policy"]
                        info["retries"] = retry_policy.get("max_retries", 2)
                        info["retry_delay"] = retry_policy.get("delay", 30)
                        info["retry_backoff"] = retry_policy.get("backoff", "LINEAR")
                        info["retry_jitter"] = retry_policy.get("jitter")
                    else:
                        # Legacy format
                        info["retries"] = dagster_config.get("retries", 2)
                        info["retry_delay"] = dagster_config.get("retry_delay", 30)
                        info["retry_backoff"] = "LINEAR"
                        info["retry_jitter"] = None
        except Exception:
            pass

    return info
