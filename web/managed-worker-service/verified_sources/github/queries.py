RATE_LIMIT = """
  rateLimit {
    limit
    cost
    remaining
    resetAt
  }
"""

ISSUE_NODE_FIELDS = """
        number
        url
        title
        body
        author {login avatarUrl url}
        authorAssociation
        closed
        closedAt
        createdAt
        state
        updatedAt
        reactions(first: $first_reactions) {
          totalCount
          nodes {
            user {login avatarUrl url}
            content
            createdAt
          }
        }
        comments(first: $first_comments) {
          totalCount
          nodes {
            id
            url
            body
            author {avatarUrl login url}
            authorAssociation
            createdAt
            reactionGroups {content createdAt}
          }
        }
"""

ISSUES_QUERY = """
query($owner: String!, $name: String!, $issues_per_page: Int!, $first_reactions: Int!, $first_comments: Int!, $page_after: String) {
  repository(owner: $owner, name: $name) {
    %s(first: $issues_per_page, orderBy: {field: UPDATED_AT, direction: DESC}, after: $page_after) {
      totalCount
      pageInfo {
        endCursor
        startCursor
      }
      nodes {
        %s
      }
    }
  }
  rateLimit {
    limit
    cost
    remaining
    resetAt
  }
}
"""

COMMENT_REACTIONS_QUERY = """
node_%s: node(id:"%s") {
     ... on IssueComment {
      id
      reactions(first: 100) {
        totalCount
        nodes {
            user {login avatarUrl url}
            content
            createdAt
          }
      }
    }
  }
"""

STARGAZERS_QUERY = """
query($owner: String!, $name: String!, $items_per_page: Int!, $page_after: String) {
  repository(owner: $owner, name: $name) {
    stargazers(first: $items_per_page, orderBy: {field: STARRED_AT, direction: DESC}, after: $page_after) {
      pageInfo {
        endCursor
        startCursor
      }
      edges {
        starredAt
        node {
          login
          avatarUrl
          url
        }
      }
    }
  }
  rateLimit {
    limit
    cost
    remaining
    resetAt
  }
}
"""

SEARCH_ISSUES_QUERY = """
query($q: String!, $first: Int!, $after: String) {
  search(query: $q, type: ISSUE, first: $first, after: $after) {
    issueCount
    pageInfo {
      endCursor
      hasNextPage
    }
    nodes {
      ... on Issue {
        number
        updatedAt
      }
      ... on PullRequest {
        number
        updatedAt
      }
    }
  }
  rateLimit {
    limit
    cost
    remaining
    resetAt
  }
}
"""


def issues_list_query(node_type: str) -> str:
    """GraphQL query listing issues or pull requests ordered by updated_at desc."""
    return ISSUES_QUERY % (node_type, ISSUE_NODE_FIELDS.strip())


def build_items_by_numbers_query(node_type: str, count: int) -> str:
    """Build a query that loads up to `count` issues/PRs by number in one request."""
    conn = "issue" if node_type == "issues" else "pullRequest"
    var_defs = ", ".join(f"$n{i}: Int!" for i in range(count))
    fields = ISSUE_NODE_FIELDS.strip()
    aliases = "\n".join(
        f"    item_{i}: {conn}(number: $n{i}) {{\n{fields}\n    }}"
        for i in range(count)
    )
    return f"""query($owner: String!, $name: String!, $first_reactions: Int!, $first_comments: Int!, {var_defs}) {{
  repository(owner: $owner, name: $name) {{
{aliases}
  }}
  rateLimit {{
    limit
    cost
    remaining
    resetAt
  }}
}}"""
