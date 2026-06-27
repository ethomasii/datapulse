"""Source that loads tables form Airtable.
Supports whitelisting of tables or loading of all tables from a specified base.
"""
from typing import Any, Dict, Iterable, Iterator, List, Optional

import dlt
import pyairtable
from dlt.sources import DltResource


@dlt.source
def airtable_source(
    base_id: str = dlt.config.value,
    table_names: Optional[List[str]] = dlt.config.value,
    access_token: str = dlt.secrets.value,
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> Iterable[DltResource]:
    """
    Represents tables for a single Airtable base.
    Args:
        base_id (str): The id of the base. Obtain it e.g. from the URL in your webbrowser.
            It starts with "app". See https://support.airtable.com/docs/finding-airtable-ids
        table_names (Optional[List[str]]): A list of table IDs or table names to load.
            Unless specified otherwise, all tables in the schema are loaded.
            Names are freely user-defined. IDs start with "tbl". See https://support.airtable.com/docs/finding-airtable-ids
        access_token (str): The personal access token.
            See https://support.airtable.com/docs/creating-and-using-api-keys-and-access-tokens#personal-access-tokens-basic-actions
    """
    api = pyairtable.Api(access_token)
    formula = _airtable_time_formula(since, until)
    all_tables_url = api.build_url(f"meta/bases/{base_id}/tables")
    tables = api.request(method="GET", url=all_tables_url).get("tables")
    for t in tables:
        if table_names:
            if t.get("id") in table_names or t.get("name") in table_names:
                yield airtable_resource(api, base_id, t, formula=formula)
        else:
            yield airtable_resource(api, base_id, t, formula=formula)


def _airtable_time_formula(since: Optional[str], until: Optional[str]) -> Optional[str]:
    """Airtable formula filter on last modified time for day run slices."""
    parts: List[str] = []
    if since:
        parts.append(f"IS_AFTER(LAST_MODIFIED_TIME(), '{since[:10]}')")
    if until:
        parts.append(f"IS_BEFORE(LAST_MODIFIED_TIME(), '{until[:10]}')")
    if not parts:
        return None
    if len(parts) == 1:
        return parts[0]
    return f"AND({','.join(parts)})"


def airtable_resource(
    api: pyairtable.Api,
    base_id: str,
    table: Dict[str, Any],
    formula: Optional[str] = None,
) -> DltResource:
    """
    Represents a single airtable.
    Args:
        api (pyairtable.Api): The API connection object
        base_id (str): The id of the base. Obtain it e.g. from the URL in your webbrowser.
            It starts with "app". See https://support.airtable.com/docs/finding-airtable-ids
        table (Dict[str, Any]): Metadata about an airtable, does not contain the actual records
    """
    primary_key_id = table["primaryFieldId"]
    primary_key_field = [
        field for field in table["fields"] if field["id"] == primary_key_id
    ][0]
    table_name: str = table["name"]
    primary_key: List[str] = [primary_key_field["name"]]
    air_table = api.table(base_id, table["id"])

    # Table.iterate() supports rich customization options, such as chunk size, fields, cell format, timezone, locale, and view
    air_table_generator: Iterator[List[Any]] = air_table.iterate(formula=formula)

    return dlt.resource(
        air_table_generator,
        name=table_name,
        primary_key=primary_key,
        write_disposition="merge" if formula else "replace",
    )
