use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::services::{
    manager::{ServiceManager, ServiceInfo, get_ai_agent_config, get_test_runner_config},
    health::{HealthChecker, ServiceHealth},
    ai_agent::{AiAgentClient, AnalyzeCodeRequest, AnalyzeCodeResponse, GenerateTestsRequest, GenerateTestsResponse, ParseRequirementsRequest, ParseRequirementsResponse},
    test_runner::{TestRunnerClient, RunTestsRequest, RunTestsResponse, ExecutionStatus, GenerateSpecRequest, GenerateSpecResponse, QueueStats},
    integrations::{JiraClient, JiraConfig, JiraIssue, CreateJiraIssueRequest, JiraSearchResult, GitHubClient, GitHubConfig, GitHubIssue, CreateGitHubIssueRequest, GitHubPullRequest},
};

pub type ServiceManagerState = Arc<RwLock<ServiceManager>>;

// ============================================================================
// Service Management Commands
// ============================================================================

#[tauri::command]
pub async fn get_services_status(
    manager: State<'_, ServiceManagerState>,
) -> Result<Vec<ServiceInfo>, String> {
    let manager = manager.read().await;
    Ok(manager.get_all_services().await)
}

#[tauri::command]
pub async fn check_service_health(service_name: String) -> Result<ServiceHealth, String> {
    let checker = HealthChecker::new();

    let config = match service_name.as_str() {
        "ai-agent" => get_ai_agent_config(),
        "test-runner" => get_test_runner_config(),
        _ => return Err(format!("Unknown service: {}", service_name)),
    };

    Ok(checker.check_service(&config).await)
}

#[tauri::command]
pub async fn check_all_services_health() -> Result<Vec<ServiceHealth>, String> {
    let checker = HealthChecker::new();
    let configs = vec![get_ai_agent_config(), get_test_runner_config()];
    Ok(checker.check_all_services(&configs).await)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceUrls {
    pub ai_agent: String,
    pub test_runner: String,
}

#[tauri::command]
pub fn get_service_urls() -> ServiceUrls {
    ServiceUrls {
        ai_agent: "http://127.0.0.1:8001".to_string(),
        test_runner: "http://127.0.0.1:8002".to_string(),
    }
}

// ============================================================================
// AI Agent Commands
// ============================================================================

#[tauri::command]
pub async fn ai_analyze_code(request: AnalyzeCodeRequest) -> Result<AnalyzeCodeResponse, String> {
    let client = AiAgentClient::new();
    client.analyze_code(request).await
}

#[tauri::command]
pub async fn ai_generate_tests(request: GenerateTestsRequest) -> Result<GenerateTestsResponse, String> {
    let client = AiAgentClient::new();
    client.generate_tests(request).await
}

#[tauri::command]
pub async fn ai_parse_requirements(request: ParseRequirementsRequest) -> Result<ParseRequirementsResponse, String> {
    let client = AiAgentClient::new();
    client.parse_requirements(request).await
}

#[tauri::command]
pub async fn ai_check_available() -> Result<bool, String> {
    let client = AiAgentClient::new();
    Ok(client.is_available().await)
}

// ============================================================================
// Test Runner Commands
// ============================================================================

#[tauri::command]
pub async fn runner_execute_tests(request: RunTestsRequest) -> Result<RunTestsResponse, String> {
    let client = TestRunnerClient::new();
    client.run_tests(request).await
}

#[tauri::command]
pub async fn runner_get_execution(execution_id: String) -> Result<ExecutionStatus, String> {
    let client = TestRunnerClient::new();
    client.get_execution(&execution_id).await
}

#[tauri::command]
pub async fn runner_cancel_execution(execution_id: String) -> Result<(), String> {
    let client = TestRunnerClient::new();
    client.cancel_execution(&execution_id).await
}

#[tauri::command]
pub async fn runner_generate_spec(request: GenerateSpecRequest) -> Result<GenerateSpecResponse, String> {
    let client = TestRunnerClient::new();
    client.generate_spec(request).await
}

#[tauri::command]
pub async fn runner_get_queue_stats() -> Result<QueueStats, String> {
    let client = TestRunnerClient::new();
    client.get_queue_stats().await
}

#[tauri::command]
pub async fn runner_check_available() -> Result<bool, String> {
    let client = TestRunnerClient::new();
    Ok(client.is_available().await)
}

// ============================================================================
// Jira Integration Commands
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct JiraCredentials {
    pub base_url: String,
    pub email: String,
    pub api_token: String,
    pub project_key: String,
}

#[tauri::command]
pub async fn jira_get_issue(credentials: JiraCredentials, issue_key: String) -> Result<JiraIssue, String> {
    let config = JiraConfig {
        base_url: credentials.base_url,
        email: credentials.email,
        api_token: credentials.api_token,
        project_key: credentials.project_key,
    };
    let client = JiraClient::new(config);
    client.get_issue(&issue_key).await
}

#[tauri::command]
pub async fn jira_create_issue(
    credentials: JiraCredentials,
    summary: String,
    description: String,
    issue_type: String,
    labels: Option<Vec<String>>,
) -> Result<JiraIssue, String> {
    let config = JiraConfig {
        base_url: credentials.base_url,
        email: credentials.email,
        api_token: credentials.api_token,
        project_key: credentials.project_key,
    };
    let client = JiraClient::new(config);
    client.create_issue(CreateJiraIssueRequest {
        summary,
        description,
        issue_type,
        priority: None,
        labels,
    }).await
}

#[tauri::command]
pub async fn jira_search_issues(
    credentials: JiraCredentials,
    jql: String,
    max_results: Option<u32>,
) -> Result<JiraSearchResult, String> {
    let config = JiraConfig {
        base_url: credentials.base_url,
        email: credentials.email,
        api_token: credentials.api_token,
        project_key: credentials.project_key,
    };
    let client = JiraClient::new(config);
    client.search_issues(&jql, max_results.unwrap_or(50)).await
}

// ============================================================================
// GitHub Integration Commands
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubCredentials {
    pub token: String,
    pub owner: String,
    pub repo: String,
}

#[tauri::command]
pub async fn github_get_issue(credentials: GitHubCredentials, issue_number: u32) -> Result<GitHubIssue, String> {
    let config = GitHubConfig {
        token: credentials.token,
        owner: credentials.owner,
        repo: credentials.repo,
    };
    let client = GitHubClient::new(config);
    client.get_issue(issue_number).await
}

#[tauri::command]
pub async fn github_create_issue(
    credentials: GitHubCredentials,
    title: String,
    body: String,
    labels: Option<Vec<String>>,
    assignees: Option<Vec<String>>,
) -> Result<GitHubIssue, String> {
    let config = GitHubConfig {
        token: credentials.token,
        owner: credentials.owner,
        repo: credentials.repo,
    };
    let client = GitHubClient::new(config);
    client.create_issue(CreateGitHubIssueRequest {
        title,
        body,
        labels,
        assignees,
    }).await
}

#[tauri::command]
pub async fn github_list_issues(
    credentials: GitHubCredentials,
    state: Option<String>,
    labels: Option<Vec<String>>,
) -> Result<Vec<GitHubIssue>, String> {
    let config = GitHubConfig {
        token: credentials.token,
        owner: credentials.owner,
        repo: credentials.repo,
    };
    let client = GitHubClient::new(config);
    client.list_issues(state.as_deref(), labels.as_deref()).await
}

#[tauri::command]
pub async fn github_get_pull_request(credentials: GitHubCredentials, pr_number: u32) -> Result<GitHubPullRequest, String> {
    let config = GitHubConfig {
        token: credentials.token,
        owner: credentials.owner,
        repo: credentials.repo,
    };
    let client = GitHubClient::new(config);
    client.get_pull_request(pr_number).await
}
