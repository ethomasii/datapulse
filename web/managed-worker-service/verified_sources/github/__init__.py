"""Source that load github issues, pull requests and reactions for a specific repository via customizable graphql query. Loads events incrementally."""

import urllib.parse
from typing import Iterator, Optional, Sequence

import dlt
from dlt.common.typing import TDataItems
from dlt.sources import DltResource

from .helpers import get_reactions_data, get_rest_pages, get_stargazers


def _reactions_resource(
    node_type: str,
    resource_name: str,
    owner: str,
    name: str,
    access_token: str,
    items_per_page: int,
    max_items: Optional[int],
    since: Optional[str],
    until: Optional[str],
) -> DltResource:
    """Build issues or pull_requests resource with merge + optional slice window."""

    if since is not None:
        @dlt.resource(
            name=resource_name,
            primary_key="number",
            write_disposition="merge",
        )
        def _slice_resource() -> Iterator[TDataItems]:
            for page in get_reactions_data(
                node_type,
                owner,
                name,
                access_token,
                items_per_page,
                max_items,
                since=since,
                until=until,
            ):
                yield page

        return _slice_resource

    @dlt.resource(
        name=resource_name,
        primary_key="number",
        write_disposition="merge",
    )
    def _incremental_resource(
        updated_at: dlt.sources.incremental[str] = dlt.sources.incremental(
            "updatedAt",
            initial_value="1970-01-01T00:00:00Z",
            last_value_func=max,
        ),
    ) -> Iterator[TDataItems]:
        for page in get_reactions_data(
            node_type,
            owner,
            name,
            access_token,
            items_per_page,
            max_items,
            since=updated_at.start_value,
            until=None,
        ):
            yield page

    return _incremental_resource


@dlt.source
def github_reactions(
    owner: str,
    name: str,
    access_token: str = dlt.secrets.value,
    items_per_page: int = 100,
    max_items: Optional[int] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> Sequence[DltResource]:
    """Get reactions associated with issues, pull requests and comments in the repo `name` with owner `owner`."""
    return (
        _reactions_resource(
            "issues",
            "issues",
            owner,
            name,
            access_token,
            items_per_page,
            max_items,
            since,
            until,
        ),
        _reactions_resource(
            "pullRequests",
            "pull_requests",
            owner,
            name,
            access_token,
            items_per_page,
            max_items,
            since,
            until,
        ),
    )


@dlt.source(max_table_nesting=2)
def github_repo_events(
    owner: str, name: str, access_token: Optional[str] = None
) -> DltResource:
    """Gets events for repository `name` with owner `owner` incrementally."""

    @dlt.resource(primary_key="id", table_name=lambda i: i["type"])
    def repo_events(
        last_created_at: dlt.sources.incremental[str] = dlt.sources.incremental(
            "created_at", initial_value="1970-01-01T00:00:00Z", last_value_func=max
        ),
    ) -> Iterator[TDataItems]:
        repos_path = (
            f"/repos/{urllib.parse.quote(owner)}/{urllib.parse.quote(name)}/events"
        )

        for page in get_rest_pages(access_token, repos_path + "?per_page=100"):
            yield page

            if last_created_at.start_out_of_range:
                print(
                    f"Overlap with previous run created at {last_created_at.initial_value}"
                )
                break

    return repo_events


@dlt.source
def github_stargazers(
    owner: str,
    name: str,
    access_token: str = dlt.secrets.value,
    items_per_page: int = 100,
    max_items: Optional[int] = None,
) -> Sequence[DltResource]:
    """Get stargazers in the repo `name` with owner `owner`."""
    return (
        dlt.resource(
            get_stargazers(
                owner,
                name,
                access_token,
                items_per_page,
                max_items,
            ),
            name="stargazers",
            write_disposition="merge",
        ),
    )
