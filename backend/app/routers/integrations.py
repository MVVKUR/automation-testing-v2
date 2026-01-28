from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/integrations", tags=["integrations"])


# ============================================
# Jira Models
# ============================================


class JiraCredentials(BaseModel):
    base_url: str
    email: str
    api_token: str
    project_key: str


class JiraIssue(BaseModel):
    id: str
    key: str
    summary: str
    description: Optional[str]
    status: str
    issue_type: str
    priority: Optional[str]
    assignee: Optional[str]
    labels: List[str]


class CreateJiraIssueRequest(BaseModel):
    credentials: JiraCredentials
    summary: str
    description: str
    issue_type: str
    labels: Optional[List[str]] = None


class SearchJiraRequest(BaseModel):
    credentials: JiraCredentials
    jql: str
    max_results: Optional[int] = 50


# ============================================
# GitHub Models
# ============================================


class GitHubCredentials(BaseModel):
    token: str
    owner: str
    repo: str


class GitHubIssue(BaseModel):
    id: int
    number: int
    title: str
    body: Optional[str]
    state: str
    labels: List[str]
    assignee: Optional[str]
    html_url: str


class GitHubPullRequest(BaseModel):
    id: int
    number: int
    title: str
    body: Optional[str]
    state: str
    head: str
    base: str
    html_url: str
    merged: bool


class CreateGitHubIssueRequest(BaseModel):
    credentials: GitHubCredentials
    title: str
    body: str
    labels: Optional[List[str]] = None
    assignees: Optional[List[str]] = None


# ============================================
# Jira Endpoints
# ============================================


@router.post("/jira/issue/{issue_key}", response_model=JiraIssue)
async def get_jira_issue(issue_key: str, credentials: JiraCredentials):
    """Get a Jira issue by key"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{credentials.base_url}/rest/api/3/issue/{issue_key}",
                auth=(credentials.email, credentials.api_token),
            )
            response.raise_for_status()
            data = response.json()

            return JiraIssue(
                id=data["id"],
                key=data["key"],
                summary=data["fields"]["summary"],
                description=data["fields"].get("description"),
                status=data["fields"]["status"]["name"],
                issue_type=data["fields"]["issuetype"]["name"],
                priority=data["fields"].get("priority", {}).get("name"),
                assignee=data["fields"].get("assignee", {}).get("displayName") if data["fields"].get("assignee") else None,
                labels=data["fields"].get("labels", []),
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Jira API error: {str(e)}")


@router.post("/jira/issue", response_model=JiraIssue)
async def create_jira_issue(request: CreateJiraIssueRequest):
    """Create a Jira issue"""
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "fields": {
                    "project": {"key": request.credentials.project_key},
                    "summary": request.summary,
                    "description": {
                        "type": "doc",
                        "version": 1,
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": request.description}],
                            }
                        ],
                    },
                    "issuetype": {"name": request.issue_type},
                }
            }
            if request.labels:
                payload["fields"]["labels"] = request.labels

            response = await client.post(
                f"{request.credentials.base_url}/rest/api/3/issue",
                auth=(request.credentials.email, request.credentials.api_token),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            # Fetch the created issue
            return await get_jira_issue(data["key"], request.credentials)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Jira API error: {str(e)}")


@router.post("/jira/search")
async def search_jira_issues(request: SearchJiraRequest):
    """Search Jira issues using JQL"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{request.credentials.base_url}/rest/api/3/search",
                auth=(request.credentials.email, request.credentials.api_token),
                params={"jql": request.jql, "maxResults": request.max_results},
            )
            response.raise_for_status()
            data = response.json()

            issues = []
            for item in data.get("issues", []):
                issues.append(
                    JiraIssue(
                        id=item["id"],
                        key=item["key"],
                        summary=item["fields"]["summary"],
                        description=item["fields"].get("description"),
                        status=item["fields"]["status"]["name"],
                        issue_type=item["fields"]["issuetype"]["name"],
                        priority=item["fields"].get("priority", {}).get("name"),
                        assignee=item["fields"].get("assignee", {}).get("displayName") if item["fields"].get("assignee") else None,
                        labels=item["fields"].get("labels", []),
                    )
                )

            return {"issues": issues, "total": data.get("total", 0)}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Jira API error: {str(e)}")


# ============================================
# GitHub Endpoints
# ============================================


@router.post("/github/issue/{issue_number}", response_model=GitHubIssue)
async def get_github_issue(issue_number: int, credentials: GitHubCredentials):
    """Get a GitHub issue by number"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.github.com/repos/{credentials.owner}/{credentials.repo}/issues/{issue_number}",
                headers={
                    "Authorization": f"token {credentials.token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            response.raise_for_status()
            data = response.json()

            return GitHubIssue(
                id=data["id"],
                number=data["number"],
                title=data["title"],
                body=data.get("body"),
                state=data["state"],
                labels=[label["name"] for label in data.get("labels", [])],
                assignee=data.get("assignee", {}).get("login") if data.get("assignee") else None,
                html_url=data["html_url"],
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {str(e)}")


@router.post("/github/issue", response_model=GitHubIssue)
async def create_github_issue(request: CreateGitHubIssueRequest):
    """Create a GitHub issue"""
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "title": request.title,
                "body": request.body,
            }
            if request.labels:
                payload["labels"] = request.labels
            if request.assignees:
                payload["assignees"] = request.assignees

            response = await client.post(
                f"https://api.github.com/repos/{request.credentials.owner}/{request.credentials.repo}/issues",
                headers={
                    "Authorization": f"token {request.credentials.token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            return GitHubIssue(
                id=data["id"],
                number=data["number"],
                title=data["title"],
                body=data.get("body"),
                state=data["state"],
                labels=[label["name"] for label in data.get("labels", [])],
                assignee=data.get("assignee", {}).get("login") if data.get("assignee") else None,
                html_url=data["html_url"],
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {str(e)}")


@router.post("/github/issues", response_model=List[GitHubIssue])
async def list_github_issues(
    credentials: GitHubCredentials,
    state: Optional[str] = "open",
    labels: Optional[List[str]] = None,
):
    """List GitHub issues"""
    try:
        async with httpx.AsyncClient() as client:
            params = {"state": state}
            if labels:
                params["labels"] = ",".join(labels)

            response = await client.get(
                f"https://api.github.com/repos/{credentials.owner}/{credentials.repo}/issues",
                headers={
                    "Authorization": f"token {credentials.token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                params=params,
            )
            response.raise_for_status()
            data = response.json()

            return [
                GitHubIssue(
                    id=item["id"],
                    number=item["number"],
                    title=item["title"],
                    body=item.get("body"),
                    state=item["state"],
                    labels=[label["name"] for label in item.get("labels", [])],
                    assignee=item.get("assignee", {}).get("login") if item.get("assignee") else None,
                    html_url=item["html_url"],
                )
                for item in data
                if "pull_request" not in item  # Exclude PRs
            ]
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {str(e)}")


@router.post("/github/pr/{pr_number}", response_model=GitHubPullRequest)
async def get_github_pull_request(pr_number: int, credentials: GitHubCredentials):
    """Get a GitHub pull request by number"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.github.com/repos/{credentials.owner}/{credentials.repo}/pulls/{pr_number}",
                headers={
                    "Authorization": f"token {credentials.token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            response.raise_for_status()
            data = response.json()

            return GitHubPullRequest(
                id=data["id"],
                number=data["number"],
                title=data["title"],
                body=data.get("body"),
                state=data["state"],
                head=data["head"]["ref"],
                base=data["base"]["ref"],
                html_url=data["html_url"],
                merged=data.get("merged", False),
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {str(e)}")
