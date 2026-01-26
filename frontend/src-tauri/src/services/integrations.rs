use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::time::Duration;

// ============================================================================
// Jira Integration
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraConfig {
    pub base_url: String,
    pub email: String,
    pub api_token: String,
    pub project_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraIssue {
    pub id: String,
    pub key: String,
    pub summary: String,
    pub description: Option<String>,
    pub status: String,
    pub issue_type: String,
    pub priority: Option<String>,
    pub assignee: Option<String>,
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJiraIssueRequest {
    pub summary: String,
    pub description: String,
    pub issue_type: String,
    pub priority: Option<String>,
    pub labels: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraSearchResult {
    pub issues: Vec<JiraIssue>,
    pub total: u32,
}

pub struct JiraClient {
    client: Client,
    config: JiraConfig,
}

impl JiraClient {
    pub fn new(config: JiraConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, config }
    }

    fn auth_header(&self) -> String {
        let credentials = format!("{}:{}", self.config.email, self.config.api_token);
        format!("Basic {}", base64_encode(&credentials))
    }

    pub async fn get_issue(&self, issue_key: &str) -> Result<JiraIssue, String> {
        let url = format!("{}/rest/api/3/issue/{}", self.config.base_url, issue_key);

        let response = self.client
            .get(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch issue: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Jira API error: HTTP {}", response.status()));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(JiraIssue {
            id: data["id"].as_str().unwrap_or("").to_string(),
            key: data["key"].as_str().unwrap_or("").to_string(),
            summary: data["fields"]["summary"].as_str().unwrap_or("").to_string(),
            description: data["fields"]["description"].as_str().map(String::from),
            status: data["fields"]["status"]["name"].as_str().unwrap_or("").to_string(),
            issue_type: data["fields"]["issuetype"]["name"].as_str().unwrap_or("").to_string(),
            priority: data["fields"]["priority"]["name"].as_str().map(String::from),
            assignee: data["fields"]["assignee"]["displayName"].as_str().map(String::from),
            labels: data["fields"]["labels"]
                .as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
        })
    }

    pub async fn create_issue(&self, request: CreateJiraIssueRequest) -> Result<JiraIssue, String> {
        let url = format!("{}/rest/api/3/issue", self.config.base_url);

        let body = serde_json::json!({
            "fields": {
                "project": {
                    "key": self.config.project_key
                },
                "summary": request.summary,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [{
                        "type": "paragraph",
                        "content": [{
                            "type": "text",
                            "text": request.description
                        }]
                    }]
                },
                "issuetype": {
                    "name": request.issue_type
                },
                "labels": request.labels.unwrap_or_default()
            }
        });

        let response = self.client
            .post(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to create issue: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Jira API error: {}", error_text));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let issue_key = data["key"].as_str().unwrap_or("").to_string();
        self.get_issue(&issue_key).await
    }

    pub async fn search_issues(&self, jql: &str, max_results: u32) -> Result<JiraSearchResult, String> {
        let url = format!("{}/rest/api/3/search", self.config.base_url);

        let body = serde_json::json!({
            "jql": jql,
            "maxResults": max_results,
            "fields": ["summary", "description", "status", "issuetype", "priority", "assignee", "labels"]
        });

        let response = self.client
            .post(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to search issues: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Jira API error: HTTP {}", response.status()));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let issues = data["issues"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .map(|issue| JiraIssue {
                        id: issue["id"].as_str().unwrap_or("").to_string(),
                        key: issue["key"].as_str().unwrap_or("").to_string(),
                        summary: issue["fields"]["summary"].as_str().unwrap_or("").to_string(),
                        description: issue["fields"]["description"].as_str().map(String::from),
                        status: issue["fields"]["status"]["name"].as_str().unwrap_or("").to_string(),
                        issue_type: issue["fields"]["issuetype"]["name"].as_str().unwrap_or("").to_string(),
                        priority: issue["fields"]["priority"]["name"].as_str().map(String::from),
                        assignee: issue["fields"]["assignee"]["displayName"].as_str().map(String::from),
                        labels: issue["fields"]["labels"]
                            .as_array()
                            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                            .unwrap_or_default(),
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(JiraSearchResult {
            issues,
            total: data["total"].as_u64().unwrap_or(0) as u32,
        })
    }
}

// ============================================================================
// GitHub Integration
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubConfig {
    pub token: String,
    pub owner: String,
    pub repo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubIssue {
    pub id: u64,
    pub number: u32,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub labels: Vec<String>,
    pub assignee: Option<String>,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGitHubIssueRequest {
    pub title: String,
    pub body: String,
    pub labels: Option<Vec<String>>,
    pub assignees: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubPullRequest {
    pub id: u64,
    pub number: u32,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub head: String,
    pub base: String,
    pub html_url: String,
    pub merged: bool,
}

pub struct GitHubClient {
    client: Client,
    config: GitHubConfig,
}

impl GitHubClient {
    pub fn new(config: GitHubConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("AutoTest-AI/1.0")
            .build()
            .expect("Failed to create HTTP client");

        Self { client, config }
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.config.token)
    }

    pub async fn get_issue(&self, issue_number: u32) -> Result<GitHubIssue, String> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/issues/{}",
            self.config.owner, self.config.repo, issue_number
        );

        let response = self.client
            .get(&url)
            .header("Authorization", self.auth_header())
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch issue: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("GitHub API error: HTTP {}", response.status()));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(parse_github_issue(&data))
    }

    pub async fn create_issue(&self, request: CreateGitHubIssueRequest) -> Result<GitHubIssue, String> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/issues",
            self.config.owner, self.config.repo
        );

        let body = serde_json::json!({
            "title": request.title,
            "body": request.body,
            "labels": request.labels.unwrap_or_default(),
            "assignees": request.assignees.unwrap_or_default()
        });

        let response = self.client
            .post(&url)
            .header("Authorization", self.auth_header())
            .header("Accept", "application/vnd.github+json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to create issue: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("GitHub API error: {}", error_text));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(parse_github_issue(&data))
    }

    pub async fn list_issues(&self, state: Option<&str>, labels: Option<&[String]>) -> Result<Vec<GitHubIssue>, String> {
        let mut url = format!(
            "https://api.github.com/repos/{}/{}/issues?per_page=100",
            self.config.owner, self.config.repo
        );

        if let Some(state) = state {
            url = format!("{}&state={}", url, state);
        }

        if let Some(labels) = labels {
            url = format!("{}&labels={}", url, labels.join(","));
        }

        let response = self.client
            .get(&url)
            .header("Authorization", self.auth_header())
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch issues: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("GitHub API error: HTTP {}", response.status()));
        }

        let data: Vec<serde_json::Value> = response.json().await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(data.iter().map(parse_github_issue).collect())
    }

    pub async fn get_pull_request(&self, pr_number: u32) -> Result<GitHubPullRequest, String> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/pulls/{}",
            self.config.owner, self.config.repo, pr_number
        );

        let response = self.client
            .get(&url)
            .header("Authorization", self.auth_header())
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch PR: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("GitHub API error: HTTP {}", response.status()));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(GitHubPullRequest {
            id: data["id"].as_u64().unwrap_or(0),
            number: data["number"].as_u64().unwrap_or(0) as u32,
            title: data["title"].as_str().unwrap_or("").to_string(),
            body: data["body"].as_str().map(String::from),
            state: data["state"].as_str().unwrap_or("").to_string(),
            head: data["head"]["ref"].as_str().unwrap_or("").to_string(),
            base: data["base"]["ref"].as_str().unwrap_or("").to_string(),
            html_url: data["html_url"].as_str().unwrap_or("").to_string(),
            merged: data["merged"].as_bool().unwrap_or(false),
        })
    }
}

fn parse_github_issue(data: &serde_json::Value) -> GitHubIssue {
    GitHubIssue {
        id: data["id"].as_u64().unwrap_or(0),
        number: data["number"].as_u64().unwrap_or(0) as u32,
        title: data["title"].as_str().unwrap_or("").to_string(),
        body: data["body"].as_str().map(String::from),
        state: data["state"].as_str().unwrap_or("").to_string(),
        labels: data["labels"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|l| l["name"].as_str().map(String::from)).collect())
            .unwrap_or_default(),
        assignee: data["assignee"]["login"].as_str().map(String::from),
        html_url: data["html_url"].as_str().unwrap_or("").to_string(),
    }
}

fn base64_encode(input: &str) -> String {
    use std::io::Write;
    let mut buf = Vec::new();
    {
        let mut encoder = base64_writer(&mut buf);
        encoder.write_all(input.as_bytes()).unwrap();
    }
    String::from_utf8(buf).unwrap()
}

fn base64_writer(output: &mut Vec<u8>) -> impl Write + '_ {
    struct Base64Writer<'a> {
        output: &'a mut Vec<u8>,
        buffer: [u8; 3],
        buffer_len: usize,
    }

    impl<'a> Write for Base64Writer<'a> {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

            for &byte in buf {
                self.buffer[self.buffer_len] = byte;
                self.buffer_len += 1;

                if self.buffer_len == 3 {
                    self.output.push(ALPHABET[(self.buffer[0] >> 2) as usize]);
                    self.output.push(ALPHABET[(((self.buffer[0] & 0x03) << 4) | (self.buffer[1] >> 4)) as usize]);
                    self.output.push(ALPHABET[(((self.buffer[1] & 0x0F) << 2) | (self.buffer[2] >> 6)) as usize]);
                    self.output.push(ALPHABET[(self.buffer[2] & 0x3F) as usize]);
                    self.buffer_len = 0;
                }
            }
            Ok(buf.len())
        }

        fn flush(&mut self) -> std::io::Result<()> {
            const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

            match self.buffer_len {
                1 => {
                    self.output.push(ALPHABET[(self.buffer[0] >> 2) as usize]);
                    self.output.push(ALPHABET[((self.buffer[0] & 0x03) << 4) as usize]);
                    self.output.push(b'=');
                    self.output.push(b'=');
                }
                2 => {
                    self.output.push(ALPHABET[(self.buffer[0] >> 2) as usize]);
                    self.output.push(ALPHABET[(((self.buffer[0] & 0x03) << 4) | (self.buffer[1] >> 4)) as usize]);
                    self.output.push(ALPHABET[((self.buffer[1] & 0x0F) << 2) as usize]);
                    self.output.push(b'=');
                }
                _ => {}
            }
            self.buffer_len = 0;
            Ok(())
        }
    }

    impl<'a> Drop for Base64Writer<'a> {
        fn drop(&mut self) {
            let _ = self.flush();
        }
    }

    Base64Writer {
        output,
        buffer: [0; 3],
        buffer_len: 0,
    }
}
