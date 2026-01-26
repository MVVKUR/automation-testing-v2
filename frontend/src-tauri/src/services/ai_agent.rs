use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const AI_AGENT_BASE_URL: &str = "http://127.0.0.1:8001";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeCodeRequest {
    pub code: String,
    pub language: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeCodeResponse {
    pub analysis: CodeAnalysis,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeAnalysis {
    pub functions: Vec<FunctionInfo>,
    pub complexity: String,
    pub test_coverage_suggestion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionInfo {
    pub name: String,
    pub parameters: Vec<String>,
    pub return_type: Option<String>,
    pub line_start: u32,
    pub line_end: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateTestsRequest {
    pub code: String,
    pub language: String,
    pub framework: String,
    pub test_type: String,
    pub requirements: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateTestsResponse {
    pub tests: Vec<GeneratedTest>,
    pub coverage_estimate: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedTest {
    pub name: String,
    pub description: String,
    pub code: String,
    pub test_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseRequirementsRequest {
    pub requirements: String,
    pub format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseRequirementsResponse {
    pub test_cases: Vec<ExtractedTestCase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedTestCase {
    pub title: String,
    pub description: String,
    pub preconditions: Vec<String>,
    pub steps: Vec<TestStep>,
    pub expected_results: Vec<String>,
    pub priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestStep {
    pub order: u32,
    pub action: String,
    pub expected: Option<String>,
}

pub struct AiAgentClient {
    client: Client,
    base_url: String,
}

impl AiAgentClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120)) // AI operations can take longer
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: AI_AGENT_BASE_URL.to_string(),
        }
    }

    pub fn with_base_url(base_url: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: base_url.to_string(),
        }
    }

    pub async fn analyze_code(&self, request: AnalyzeCodeRequest) -> Result<AnalyzeCodeResponse, String> {
        let url = format!("{}/api/v1/analyze", self.base_url);

        self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn generate_tests(&self, request: GenerateTestsRequest) -> Result<GenerateTestsResponse, String> {
        let url = format!("{}/api/v1/generate-tests", self.base_url);

        self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn parse_requirements(&self, request: ParseRequirementsRequest) -> Result<ParseRequirementsResponse, String> {
        let url = format!("{}/api/v1/parse-requirements", self.base_url);

        self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn is_available(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        self.client.get(&url).send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }
}

impl Default for AiAgentClient {
    fn default() -> Self {
        Self::new()
    }
}
