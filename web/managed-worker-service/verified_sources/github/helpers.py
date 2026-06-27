from datetime import date, timedelta
from typing import Iterator, List, Optional, Tuple

from dlt.common.typing import DictStrAny, StrAny
from dlt.common.utils import chunks
from dlt.sources.helpers import requests

from .queries import (
    COMMENT_REACTIONS_QUERY,
    RATE_LIMIT,
    SEARCH_ISSUES_QUERY,
    STARGAZERS_QUERY,
    build_items_by_numbers_query,
    issues_list_query,
)
from .settings import GRAPHQL_API_BASE_URL, REST_API_BASE_URL


def _get_auth_header(access_token: Optional[str]) -> StrAny:
    if access_token:
        return {"Authorization": f"Bearer {access_token}"}
    return {}


def _normalize_since(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        return f"{text}T00:00:00Z"
    if text.endswith("Z") or "+" in text:
        return text
    return f"{text}T00:00:00Z"


def _normalize_until(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        return f"{text}T00:00:00Z"
    if text.endswith("Z") or "+" in text:
        return text
    return f"{text}T00:00:00Z"


def _updated_at_in_window(
    updated_at: str, since: Optional[str], until: Optional[str]
) -> bool:
    if not updated_at:
        return False
    if since and updated_at < since:
        return False
    if until and updated_at >= until:
        return False
    return True


def _search_date_range(since: str, until: str) -> Tuple[str, str]:
    start_d = since[:10]
    end_exclusive = date.fromisoformat(until[:10])
    end_inclusive = end_exclusive - timedelta(days=1)
    return start_d, end_inclusive.isoformat()


def get_rest_pages(access_token: Optional[str], query: str) -> Iterator[List[StrAny]]:
    def _request(page_url: str) -> requests.Response:
        r = requests.get(page_url, headers=_get_auth_header(access_token))
        print(
            f"got page {page_url}, requests left: " + r.headers["x-ratelimit-remaining"]
        )
        return r

    next_page_url = REST_API_BASE_URL + query
    while True:
        r: requests.Response = _request(next_page_url)
        page_items = r.json()
        if len(page_items) == 0:
            break
        yield page_items
        if "next" not in r.links:
            break
        next_page_url = r.links["next"]["url"]


def get_stargazers(
    owner: str,
    name: str,
    access_token: str,
    items_per_page: int,
    max_items: Optional[int],
) -> Iterator[Iterator[StrAny]]:
    variables = {"owner": owner, "name": name, "items_per_page": items_per_page}
    for page_items in _get_graphql_pages(
        access_token, STARGAZERS_QUERY, variables, "stargazers", max_items
    ):
        yield map(
            lambda item: {"starredAt": item["starredAt"], "user": item["node"]},
            page_items,
        )


def get_reactions_data(
    node_type: str,
    owner: str,
    name: str,
    access_token: str,
    items_per_page: int,
    max_items: Optional[int],
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> Iterator[Iterator[StrAny]]:
    since_norm = _normalize_since(since)
    until_norm = _normalize_until(until)

    if since_norm and until_norm:
        for page in _get_reactions_data_via_search(
            node_type,
            owner,
            name,
            access_token,
            items_per_page,
            max_items,
            since_norm,
            until_norm,
        ):
            yield page
        return

    variables = {
        "owner": owner,
        "name": name,
        "issues_per_page": items_per_page,
        "first_reactions": 100,
        "first_comments": 100,
        "node_type": node_type,
    }
    query = issues_list_query(node_type)
    matched_count = 0
    for page_items in _get_graphql_pages(
        access_token, query, variables, node_type, max_items=None
    ):
        filtered: List[DictStrAny] = []
        stop_paging = False
        for item in page_items:
            updated = str(item.get("updatedAt") or "")
            if since_norm and updated and updated < since_norm:
                stop_paging = True
                continue
            if not _updated_at_in_window(updated, since_norm, until_norm):
                continue
            filtered.append(item)
            matched_count += 1
            if max_items and matched_count >= max_items:
                break

        if filtered:
            yield from _yield_processed_items(filtered, access_token)

        if stop_paging or (max_items and matched_count >= max_items):
            if max_items and matched_count >= max_items:
                print(f"Max items limit reached: {matched_count} >= {max_items}")
            return


def _get_reactions_data_via_search(
    node_type: str,
    owner: str,
    name: str,
    access_token: str,
    items_per_page: int,
    max_items: Optional[int],
    since: str,
    until: str,
) -> Iterator[Iterator[StrAny]]:
    type_filter = "issue" if node_type == "issues" else "pr"
    start_d, end_d = _search_date_range(since, until)
    query_text = f"repo:{owner}/{name} is:{type_filter} updated:{start_d}..{end_d}"
    print(f"GitHub search slice: {query_text}")

    numbers: List[int] = []
    variables: DictStrAny = {
        "q": query_text,
        "first": min(items_per_page, 100),
    }
    while True:
        data, rate_limit = _run_graphql_query(
            access_token, SEARCH_ISSUES_QUERY, variables
        )
        search = data.get("search") or {}
        nodes = search.get("nodes") or []
        for node in nodes:
            num = node.get("number")
            if num is not None:
                numbers.append(int(num))
        print(
            f"Search collected {len(numbers)} {node_type} numbers, query cost {rate_limit['cost']}, remaining credits: {rate_limit['remaining']}"
        )
        if max_items and len(numbers) >= max_items:
            numbers = numbers[:max_items]
            break
        page_info = search.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break
        variables["after"] = page_info.get("endCursor")
        if not variables["after"]:
            break

    if not numbers:
        return

    batch_size = 10
    for number_batch in chunks(numbers, batch_size):
        items = _fetch_items_by_numbers(
            node_type,
            owner,
            name,
            access_token,
            list(number_batch),
        )
        if items:
            yield from _yield_processed_items(items, access_token)


def _fetch_items_by_numbers(
    node_type: str,
    owner: str,
    name: str,
    access_token: str,
    numbers: List[int],
) -> List[DictStrAny]:
    if not numbers:
        return []
    query = build_items_by_numbers_query(node_type, len(numbers))
    variables: DictStrAny = {
        "owner": owner,
        "name": name,
        "first_reactions": 100,
        "first_comments": 100,
    }
    for idx, num in enumerate(numbers):
        variables[f"n{idx}"] = num

    data, rate_limit = _run_graphql_query(access_token, query, variables)
    repo = data.get("repository") or {}
    items: List[DictStrAny] = []
    for idx in range(len(numbers)):
        item = repo.get(f"item_{idx}")
        if item:
            items.append(item)
    print(
        f"Fetched {len(items)} {node_type} by number, query cost {rate_limit['cost']}, remaining credits: {rate_limit['remaining']}"
    )
    return items


def _yield_processed_items(
    page_items: List[DictStrAny], access_token: str
) -> Iterator[Iterator[StrAny]]:
    reacted_comment_ids = {}
    for item in page_items:
        for comment in item["comments"]["nodes"]:
            if any(group["createdAt"] for group in comment["reactionGroups"]):
                reacted_comment_ids[comment["id"]] = comment
            comment.pop("reactionGroups", None)

    comment_reactions = _get_comment_reaction(
        list(reacted_comment_ids.keys()), access_token
    )
    for comment in comment_reactions.values():
        comment_id = comment["id"]
        reacted_comment_ids[comment_id]["reactions"] = comment["reactions"]
    yield map(_extract_nested_nodes, page_items)


def _extract_top_connection(data: StrAny, node_type: str) -> StrAny:
    assert (
        isinstance(data, dict) and len(data) == 1
    ), f"The data with list of {node_type} must be a dictionary and contain only one element"
    data = next(iter(data.values()))
    return data[node_type]  # type: ignore


def _extract_nested_nodes(item: DictStrAny) -> DictStrAny:
    """Recursively moves `nodes` and `totalCount` to reduce nesting."""
    item["reactions_totalCount"] = item["reactions"].get("totalCount", 0)
    item["reactions"] = item["reactions"]["nodes"]
    comments = item["comments"]
    item["comments_totalCount"] = item["comments"].get("totalCount", 0)
    for comment in comments["nodes"]:
        if "reactions" in comment:
            comment["reactions_totalCount"] = comment["reactions"].get("totalCount", 0)
            comment["reactions"] = comment["reactions"]["nodes"]
    item["comments"] = comments["nodes"]
    return item


def _run_graphql_query(
    access_token: str, query: str, variables: DictStrAny
) -> Tuple[StrAny, StrAny]:
    def _request() -> requests.Response:
        r = requests.post(
            GRAPHQL_API_BASE_URL,
            json={"query": query, "variables": variables},
            headers=_get_auth_header(access_token),
        )
        return r

    data = _request().json()
    if "errors" in data:
        raise ValueError(data)
    data = data["data"]
    rate_limit = data.pop("rateLimit", {"cost": 0, "remaining": 0})
    return data, rate_limit


def _get_graphql_pages(
    access_token: str,
    query: str,
    variables: DictStrAny,
    node_type: str,
    max_items: Optional[int],
) -> Iterator[List[DictStrAny]]:
    items_count = 0
    while True:
        data, rate_limit = _run_graphql_query(access_token, query, variables)
        top_connection = _extract_top_connection(data, node_type)
        data_items = (
            top_connection["nodes"]
            if "nodes" in top_connection
            else top_connection["edges"]
        )
        items_count += len(data_items)
        print(
            f'Got {len(data_items)}/{items_count} {node_type}s, query cost {rate_limit["cost"]}, remaining credits: {rate_limit["remaining"]}'
        )
        if data_items:
            yield data_items
        else:
            return
        variables["page_after"] = _extract_top_connection(data, node_type)["pageInfo"][
            "endCursor"
        ]
        if max_items and items_count >= max_items:
            print(f"Max items limit reached: {items_count} >= {max_items}")
            return


def _get_comment_reaction(comment_ids: List[str], access_token: str) -> StrAny:
    """Builds a query from a list of comment nodes and returns associated reactions."""
    idx = 0
    data: DictStrAny = {}
    for page_chunk in chunks(comment_ids, 50):
        subs = []
        for comment_id in page_chunk:
            subs.append(COMMENT_REACTIONS_QUERY % (idx, comment_id))
            idx += 1
        subs.append(RATE_LIMIT)
        query = "{" + ",\n".join(subs) + "}"
        page, rate_limit = _run_graphql_query(access_token, query, {})
        print(
            f'Got {len(page)} comments, query cost {rate_limit["cost"]}, remaining credits: {rate_limit["remaining"]}'
        )
        data.update(page)
    return data
