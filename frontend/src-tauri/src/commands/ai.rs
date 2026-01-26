use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::env;
use std::process::Command;
use std::path::PathBuf;
use regex::Regex;

/// Find the ADB executable path
fn get_adb_path() -> String {
    let home = env::var("HOME").unwrap_or_default();
    let possible_paths = vec![
        format!("{}/Library/Android/sdk/platform-tools/adb", home),
        format!("{}/Android/Sdk/platform-tools/adb", home),
        "/usr/local/bin/adb".to_string(),
        "/opt/homebrew/bin/adb".to_string(),
        "adb".to_string(),
    ];
    for path in possible_paths {
        let path_buf = PathBuf::from(&path);
        if path_buf.exists() || path == "adb" {
            return path;
        }
    }
    "adb".to_string()
}

/// Represents a UI element found in the dump
struct UiElement {
    text: String,
    content_desc: String,
    class: String,
    bounds: (u32, u32, u32, u32), // x1, y1, x2, y2
    clickable: bool,
}

/// Semantic synonyms for common UI terms
fn get_synonyms(word: &str) -> Vec<&'static str> {
    match word {
        "login" => vec!["sign", "signin", "log"],
        "sign" => vec!["login", "log", "signin"],
        "signin" => vec!["login", "sign", "log"],
        "button" => vec!["btn", "submit", "action"],
        "submit" => vec!["send", "confirm", "done", "ok"],
        "cancel" => vec!["close", "dismiss", "back", "no"],
        "ok" | "okay" => vec!["confirm", "yes", "done", "accept"],
        "next" => vec!["continue", "proceed", "forward"],
        "continue" => vec!["next", "proceed", "forward"],
        "skip" => vec!["later", "dismiss", "not"],
        "back" => vec!["return", "previous", "cancel"],
        "username" => vec!["email", "user", "account", "id"],
        "email" => vec!["username", "mail", "address"],
        "password" => vec!["pass", "pwd", "secret", "pin"],
        "settings" => vec!["preferences", "options", "config"],
        "search" => vec!["find", "lookup", "query"],
        "home" => vec!["main", "dashboard", "start"],
        "profile" => vec!["account", "user", "me"],
        "save" => vec!["store", "keep", "confirm"],
        "delete" => vec!["remove", "trash", "clear"],
        "edit" => vec!["modify", "change", "update"],
        "add" => vec!["create", "new", "plus"],
        _ => vec![],
    }
}

/// Check if two words are semantically similar
fn words_match(word1: &str, word2: &str) -> f32 {
    if word1 == word2 {
        return 1.0;
    }

    // Check synonyms
    let synonyms = get_synonyms(word1);
    if synonyms.contains(&word2) {
        return 0.9; // High score for semantic match
    }

    // Check reverse synonyms
    let reverse_synonyms = get_synonyms(word2);
    if reverse_synonyms.contains(&word1) {
        return 0.9;
    }

    // Partial string match
    if word1.contains(word2) || word2.contains(word1) {
        return 0.7;
    }

    // Fuzzy match for typos
    if word1.len() > 3 && word2.len() > 3 && levenshtein_distance(word1, word2) <= 2 {
        return 0.5;
    }

    0.0
}

/// Calculate similarity between two strings using word overlap, fuzzy matching, and semantic synonyms
fn calculate_similarity(query: &str, target: &str) -> f32 {
    let query_lower = query.to_lowercase();
    let target_lower = target.to_lowercase();

    // Exact match
    if query_lower == target_lower {
        return 1.0;
    }

    // Check if one contains the other (case-insensitive)
    if target_lower.contains(&query_lower) || query_lower.contains(&target_lower) {
        return 0.95;
    }

    // Normalize: remove common action words from query
    let action_words = ["tap", "click", "press", "enter", "type", "input", "select", "choose", "find", "locate", "the", "a", "an", "on", "in", "to", "for", "field"];
    let query_words: Vec<&str> = query_lower
        .split_whitespace()
        .filter(|w| !action_words.contains(w))
        .collect();

    let target_words: Vec<&str> = target_lower
        .split_whitespace()
        .collect();

    if query_words.is_empty() || target_words.is_empty() {
        return 0.0;
    }

    // Count matching words with semantic matching
    let mut total_match_score = 0.0;

    for qw in &query_words {
        let mut best_word_match = 0.0f32;
        for tw in &target_words {
            let match_score = words_match(qw, tw);
            best_word_match = best_word_match.max(match_score);
        }
        total_match_score += best_word_match;
    }

    let max_possible = query_words.len() as f32;
    let similarity = (total_match_score / max_possible).min(1.0);

    log::info!("Similarity '{}' vs '{}': query_words={:?}, target_words={:?}, score={:.2}",
               query, target, query_words, target_words, similarity);

    similarity
}

/// Calculate Levenshtein distance between two strings
fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let s1_chars: Vec<char> = s1.chars().collect();
    let s2_chars: Vec<char> = s2.chars().collect();
    let len1 = s1_chars.len();
    let len2 = s2_chars.len();

    if len1 == 0 { return len2; }
    if len2 == 0 { return len1; }

    let mut matrix = vec![vec![0usize; len2 + 1]; len1 + 1];

    for i in 0..=len1 { matrix[i][0] = i; }
    for j in 0..=len2 { matrix[0][j] = j; }

    for i in 1..=len1 {
        for j in 1..=len2 {
            let cost = if s1_chars[i-1] == s2_chars[j-1] { 0 } else { 1 };
            matrix[i][j] = (matrix[i-1][j] + 1)
                .min(matrix[i][j-1] + 1)
                .min(matrix[i-1][j-1] + cost);
        }
    }

    matrix[len1][len2]
}

/// Find element from UI dump using intelligent matching
async fn find_element_from_ui_dump(
    element_description: &str,
    device_id: &Option<String>,
) -> Result<AiElementLocation, String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    // Dump UI hierarchy
    args.extend(["shell".to_string(), "uiautomator".to_string(), "dump".to_string(), "/sdcard/ui_dump.xml".to_string()]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to dump UI: {}", e))?;

    if !output.status.success() {
        return Err("UI dump failed".to_string());
    }

    // Read the dump file
    let mut read_args = vec![];
    if let Some(ref id) = device_id {
        read_args.push("-s".to_string());
        read_args.push(id.clone());
    }
    read_args.extend(["shell".to_string(), "cat".to_string(), "/sdcard/ui_dump.xml".to_string()]);

    let read_output = Command::new(&get_adb_path())
        .args(&read_args)
        .output()
        .map_err(|e| format!("Failed to read UI dump: {}", e))?;

    let xml_content = String::from_utf8_lossy(&read_output.stdout);
    log::info!("UI dump size: {} bytes", xml_content.len());

    let description_lower = element_description.to_lowercase();

    // Extract target number if looking for numeric buttons (PIN pad, keyboard)
    let number_pattern = Regex::new(r"(?:number|digit|key|pin)\s*(\d+)").unwrap();
    let target_number: Option<String> = number_pattern
        .captures(&description_lower)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string());

    // Also check for standalone single digit at end of description
    let standalone_number: Option<String> = if target_number.is_none() {
        Regex::new(r"\b(\d)\s*$").unwrap()
            .captures(&description_lower)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
    } else {
        None
    };

    let search_number = target_number.or(standalone_number);

    log::info!("Searching for: '{}', target_number: {:?}", element_description, search_number);

    // Parse UI nodes
    let node_pattern = Regex::new(r#"<node[^>]+>"#)
        .map_err(|e| format!("Regex error: {}", e))?;

    let text_pattern = Regex::new(r#"text="([^"]*)""#).unwrap();
    let desc_pattern = Regex::new(r#"content-desc="([^"]*)""#).unwrap();
    let bounds_pattern = Regex::new(r#"bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]""#).unwrap();
    let class_pattern = Regex::new(r#"class="([^"]*)""#).unwrap();
    let clickable_pattern = Regex::new(r#"clickable="(true|false)""#).unwrap();

    let mut elements: Vec<UiElement> = vec![];

    for node_match in node_pattern.find_iter(&xml_content) {
        let node_str = node_match.as_str();

        let bounds = if let Some(b) = bounds_pattern.captures(node_str) {
            let x1: u32 = b.get(1).map_or(0, |m| m.as_str().parse().unwrap_or(0));
            let y1: u32 = b.get(2).map_or(0, |m| m.as_str().parse().unwrap_or(0));
            let x2: u32 = b.get(3).map_or(0, |m| m.as_str().parse().unwrap_or(0));
            let y2: u32 = b.get(4).map_or(0, |m| m.as_str().parse().unwrap_or(0));
            (x1, y1, x2, y2)
        } else {
            continue;
        };

        if bounds.0 == bounds.2 || bounds.1 == bounds.3 {
            continue;
        }

        let text = text_pattern.captures(node_str)
            .and_then(|c| c.get(1))
            .map_or("".to_string(), |m| m.as_str().to_string());

        let content_desc = desc_pattern.captures(node_str)
            .and_then(|c| c.get(1))
            .map_or("".to_string(), |m| m.as_str().to_string());

        let class = class_pattern.captures(node_str)
            .and_then(|c| c.get(1))
            .map_or("".to_string(), |m| m.as_str().to_string());

        let clickable = clickable_pattern.captures(node_str)
            .and_then(|c| c.get(1))
            .map_or(false, |m| m.as_str() == "true");

        if !text.is_empty() || !content_desc.is_empty() {
            elements.push(UiElement {
                text,
                content_desc,
                class,
                bounds,
                clickable,
            });
        }
    }

    log::info!("Found {} UI elements with text", elements.len());

    let mut best_match: Option<&UiElement> = None;
    let mut best_score: f32 = 0.0;

    for element in &elements {
        let text_lower = element.text.to_lowercase();
        let desc_lower = element.content_desc.to_lowercase();

        // Skip empty elements
        if text_lower.is_empty() && desc_lower.is_empty() {
            continue;
        }

        let mut score: f32 = 0.0;

        // Priority 1: Exact number match for PIN pads
        if let Some(ref num) = search_number {
            if text_lower == *num || text_lower.trim() == *num {
                score = 1.0;
                log::info!("Exact number match: '{}' == '{}'", text_lower, num);
            }
        }

        // Priority 2: Calculate semantic similarity with element text
        if score < 0.5 {
            let text_similarity = calculate_similarity(element_description, &element.text);
            let desc_similarity = calculate_similarity(element_description, &element.content_desc);
            score = text_similarity.max(desc_similarity);
        }

        // Boost for clickable elements
        if element.clickable && score > 0.3 {
            score += 0.1;
        }

        // Boost for Button class
        if element.class.contains("Button") && score > 0.3 {
            score += 0.1;
        }

        score = score.min(1.0);

        if score > best_score {
            best_score = score;
            best_match = Some(element);
            log::info!("New best: '{}' / '{}' with score {:.2}", element.text, element.content_desc, score);
        }
    }

    // Only return if we have a good match (> 0.4 similarity)
    if let Some(element) = best_match {
        if best_score >= 0.4 {
            let (x1, y1, x2, y2) = element.bounds;
            let center_x = (x1 + x2) / 2;
            let center_y = (y1 + y2) / 2;

            let display_text = if !element.text.is_empty() {
                &element.text
            } else {
                &element.content_desc
            };

            log::info!("Found element '{}' at ({}, {}) with confidence {:.2}", display_text, center_x, center_y, best_score);

            return Ok(AiElementLocation {
                found: true,
                x: center_x,
                y: center_y,
                element_type: if element.clickable { "button".to_string() } else { "element".to_string() },
                confidence: best_score,
                description: format!("Found '{}' via UI dump (similarity: {:.0}%)", display_text, best_score * 100.0),
            });
        }
    }

    Err("Element not found in UI dump".to_string())
}

/// Suggested test step from AI analysis
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiSuggestedStep {
    pub step_type: String,  // tap, swipe, input, wait, verify
    pub label: String,      // Human readable description
    pub config: AiStepConfig,
    pub confidence: f32,    // 0.0 - 1.0 confidence score
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiStepConfig {
    pub x: Option<u32>,
    pub y: Option<u32>,
    pub x2: Option<u32>,
    pub y2: Option<u32>,
    pub value: Option<String>,
    pub duration: Option<u32>,
    pub timeout: Option<u32>,
    pub element_description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiAnalysisResult {
    pub screen_description: String,
    pub detected_elements: Vec<DetectedElement>,
    pub suggested_steps: Vec<AiSuggestedStep>,
    pub test_context: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DetectedElement {
    pub element_type: String,  // button, input, text, image, etc.
    pub description: String,
    pub bounds: Option<ElementBounds>,
    pub text_content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ElementBounds {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Analyze a screenshot and suggest test steps using AI
#[tauri::command]
pub async fn ai_analyze_screen(
    screenshot_base64: String,
    current_steps: Vec<serde_json::Value>,
    test_context: Option<String>,
) -> Result<AiAnalysisResult, String> {
    // Get API key from environment
    let api_key = env::var("ANTHROPIC_API_KEY")
        .or_else(|_| env::var("CLAUDE_API_KEY"))
        .map_err(|_| "ANTHROPIC_API_KEY environment variable not set. Please set it to use AI analysis.".to_string())?;

    let client = Client::new();

    // Build the prompt for Claude
    let current_steps_json = serde_json::to_string_pretty(&current_steps).unwrap_or_default();
    let context = test_context.unwrap_or_else(|| "Mobile app testing".to_string());

    let prompt = format!(
        r#"Analyze this mobile app screenshot and suggest the next test steps.

Current test context: {}

Current test steps already defined:
{}

Based on the screenshot, please:
1. Describe what you see on the screen (UI elements, text, buttons, input fields)
2. Identify interactive elements with their approximate coordinates (assuming 1080x1920 resolution)
3. Suggest 3-5 logical next test steps based on what's visible

Focus on:
- Login/authentication flows if visible
- Form inputs that need to be filled
- Buttons that should be tapped
- Navigation elements
- Verification points (text that confirms success/failure)

Respond in JSON format:
{{
    "screen_description": "Brief description of what's on screen",
    "detected_elements": [
        {{
            "element_type": "button|input|text|image|icon",
            "description": "What this element is",
            "bounds": {{"x": 540, "y": 800, "width": 200, "height": 50}},
            "text_content": "Button text if any"
        }}
    ],
    "suggested_steps": [
        {{
            "step_type": "tap|swipe|input|wait|verify",
            "label": "Human readable step description",
            "config": {{
                "x": 540,
                "y": 800,
                "value": "text to input if applicable",
                "element_description": "What element this targets"
            }},
            "confidence": 0.9
        }}
    ],
    "test_context": "Updated context based on analysis"
}}"#,
        context,
        current_steps_json
    );

    // Call Claude API with vision
    let request_body = serde_json::json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 2048,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_base64.trim_start_matches("data:image/png;base64,")
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to call AI API: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("AI API error: {}", error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse AI response: {}", e))?;

    // Extract the text content from Claude's response
    let content = response_json["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["text"].as_str())
        .ok_or("Invalid AI response format")?;

    // Parse the JSON from Claude's response
    // Find JSON in the response (it might be wrapped in markdown code blocks)
    let json_str = if content.contains("```json") {
        content
            .split("```json")
            .nth(1)
            .and_then(|s| s.split("```").next())
            .unwrap_or(content)
    } else if content.contains("```") {
        content
            .split("```")
            .nth(1)
            .and_then(|s| s.split("```").next())
            .unwrap_or(content)
    } else {
        content
    };

    let result: AiAnalysisResult = serde_json::from_str(json_str.trim())
        .map_err(|e| format!("Failed to parse AI analysis result: {}. Response: {}", e, json_str))?;

    Ok(result)
}

/// Get UI dump as structured data for AI analysis
async fn get_ui_elements_for_ai(device_id: &Option<String>) -> Result<Vec<(String, String, u32, u32, u32, u32)>, String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    args.extend(["shell".to_string(), "uiautomator".to_string(), "dump".to_string(), "/sdcard/ui_dump.xml".to_string()]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to dump UI: {}", e))?;

    if !output.status.success() {
        return Err("UI dump failed".to_string());
    }

    let mut read_args = vec![];
    if let Some(ref id) = device_id {
        read_args.push("-s".to_string());
        read_args.push(id.clone());
    }
    read_args.extend(["shell".to_string(), "cat".to_string(), "/sdcard/ui_dump.xml".to_string()]);

    let read_output = Command::new(&get_adb_path())
        .args(&read_args)
        .output()
        .map_err(|e| format!("Failed to read UI dump: {}", e))?;

    let xml_content = String::from_utf8_lossy(&read_output.stdout);

    let node_pattern = Regex::new(r#"<node[^>]+>"#).unwrap();
    let text_pattern = Regex::new(r#"text="([^"]*)""#).unwrap();
    let desc_pattern = Regex::new(r#"content-desc="([^"]*)""#).unwrap();
    let bounds_pattern = Regex::new(r#"bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]""#).unwrap();
    let clickable_pattern = Regex::new(r#"clickable="(true)""#).unwrap();

    let mut elements = vec![];

    for node_match in node_pattern.find_iter(&xml_content) {
        let node_str = node_match.as_str();

        let bounds = if let Some(b) = bounds_pattern.captures(node_str) {
            let x1: u32 = b.get(1).map_or(0, |m| m.as_str().parse().unwrap_or(0));
            let y1: u32 = b.get(2).map_or(0, |m| m.as_str().parse().unwrap_or(0));
            let x2: u32 = b.get(3).map_or(0, |m| m.as_str().parse().unwrap_or(0));
            let y2: u32 = b.get(4).map_or(0, |m| m.as_str().parse().unwrap_or(0));
            (x1, y1, x2, y2)
        } else {
            continue;
        };

        if bounds.0 == bounds.2 || bounds.1 == bounds.3 {
            continue;
        }

        let text = text_pattern.captures(node_str)
            .and_then(|c| c.get(1))
            .map_or("".to_string(), |m| m.as_str().to_string());

        let content_desc = desc_pattern.captures(node_str)
            .and_then(|c| c.get(1))
            .map_or("".to_string(), |m| m.as_str().to_string());

        let is_clickable = clickable_pattern.is_match(node_str);

        // Only include elements with text or that are clickable
        if !text.is_empty() || !content_desc.is_empty() || is_clickable {
            let label = if !text.is_empty() { text } else { content_desc };
            let clickable_str = if is_clickable { "clickable" } else { "not-clickable" };
            elements.push((label, clickable_str.to_string(), bounds.0, bounds.1, bounds.2, bounds.3));
        }
    }

    Ok(elements)
}

/// Find element coordinates using AI with UI dump context - the most reliable approach
#[tauri::command]
pub async fn ai_find_element_coordinates(
    screenshot_base64: String,
    element_description: String,
    device_id: Option<String>,
) -> Result<AiElementLocation, String> {
    // Get UI elements from dump
    let ui_elements = get_ui_elements_for_ai(&device_id).await.unwrap_or_default();

    // Format UI elements for AI
    let elements_list: Vec<String> = ui_elements.iter()
        .filter(|(label, _, _, _, _, _)| !label.is_empty())
        .map(|(label, clickable, x1, y1, x2, y2)| {
            let center_x = (x1 + x2) / 2;
            let center_y = (y1 + y2) / 2;
            format!("- \"{}\" ({}) at center ({}, {})", label, clickable, center_x, center_y)
        })
        .collect();

    let elements_text = if elements_list.is_empty() {
        "No UI elements detected from device.".to_string()
    } else {
        elements_list.join("\n")
    };

    log::info!("UI Elements for AI:\n{}", elements_text);

    // Use AI with both screenshot and UI dump context
    let api_key = env::var("ANTHROPIC_API_KEY")
        .or_else(|_| env::var("CLAUDE_API_KEY"))
        .map_err(|_| "ANTHROPIC_API_KEY environment variable not set".to_string())?;

    let client = Client::new();

    let prompt = format!(
        r#"Find the UI element matching: "{}"

I have extracted the UI elements from the device. Here are all interactive elements with their EXACT center coordinates:

{}

YOUR TASK:
1. Look at the screenshot to understand the UI
2. Find which element from the list above best matches "{}" semantically
3. Return the EXACT coordinates from the list above

SEMANTIC MATCHING RULES:
- "Login Button", "Tap Login", "Login" → matches "Sign In", "Login", "Log In"
- "Submit" → matches "Submit", "Send", "Confirm", "Done"
- "Skip" → matches "Skip", "Skip This Step", "Not Now", "Later"
- "Continue" → matches "Continue", "Next", "Proceed", "Go"
- "Back" → matches "Back", "Return", "Cancel"
- Numbers like "1", "2" → match digit buttons on keypads

IMPORTANT: Use the EXACT coordinates from the element list above. Do NOT estimate coordinates.

Respond with ONLY valid JSON (no markdown):
{{
    "found": true,
    "x": <exact x from list>,
    "y": <exact y from list>,
    "element_type": "button",
    "confidence": 0.95,
    "description": "Matched '<element text from list>'"
}}

If no match found:
{{
    "found": false,
    "x": 0,
    "y": 0,
    "element_type": "unknown",
    "confidence": 0,
    "description": "No matching element found"
}}"#,
        element_description, elements_text, element_description
    );

    let request_body = serde_json::json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 256,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_base64.trim_start_matches("data:image/png;base64,")
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to call AI API: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("AI API error: {}", error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse AI response: {}", e))?;

    let content = response_json["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["text"].as_str())
        .ok_or("Invalid AI response format")?;

    let json_str = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let result: AiElementLocation = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse AI location: {}. Response: {}", e, json_str))?;

    Ok(result)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiElementLocation {
    pub found: bool,
    pub x: u32,
    pub y: u32,
    pub element_type: String,
    pub confidence: f32,
    pub description: String,
}

// ============================================================================
// WEB AUTOMATION AI COMMANDS
// ============================================================================

/// Suggested test step for web automation from AI analysis
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiWebSuggestedStep {
    pub step_type: String,  // click, type, navigate, wait, verify, select, hover, scroll
    pub label: String,      // Human readable description
    pub config: AiWebStepConfig,
    pub confidence: f32,    // 0.0 - 1.0 confidence score
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiWebStepConfig {
    pub selector: Option<String>,           // CSS selector for the element
    pub xpath: Option<String>,              // XPath alternative
    pub url: Option<String>,                // For navigate steps
    pub value: Option<String>,              // For type/input steps
    pub timeout: Option<u32>,               // Wait timeout in ms
    pub element_description: Option<String>, // Human description of element
    pub assertion_type: Option<String>,     // For verify steps: visible, hidden, text, value
    pub expected_value: Option<String>,     // Expected value for assertions
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiWebAnalysisResult {
    pub page_description: String,
    pub page_url: Option<String>,
    pub detected_elements: Vec<DetectedWebElement>,
    pub suggested_steps: Vec<AiWebSuggestedStep>,
    pub test_context: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DetectedWebElement {
    pub element_type: String,  // button, input, link, text, image, select, checkbox, etc.
    pub description: String,
    pub selector: String,      // CSS selector
    pub xpath: Option<String>, // XPath alternative
    pub text_content: Option<String>,
    pub attributes: Option<serde_json::Value>, // id, class, name, etc.
}

/// Analyze a web page screenshot and suggest test steps using AI
#[tauri::command]
pub async fn ai_analyze_web_page(
    screenshot_base64: String,
    page_html: Option<String>,
    current_url: Option<String>,
    current_steps: Vec<serde_json::Value>,
    test_context: Option<String>,
) -> Result<AiWebAnalysisResult, String> {
    let api_key = env::var("ANTHROPIC_API_KEY")
        .or_else(|_| env::var("CLAUDE_API_KEY"))
        .map_err(|_| "ANTHROPIC_API_KEY environment variable not set. Please set it to use AI analysis.".to_string())?;

    let client = Client::new();

    let current_steps_json = serde_json::to_string_pretty(&current_steps).unwrap_or_default();
    let context = test_context.unwrap_or_else(|| "Web application testing".to_string());
    let url_info = current_url.clone().unwrap_or_else(|| "Unknown URL".to_string());

    // If HTML is provided, extract key elements for better analysis
    let html_context = if let Some(ref html) = page_html {
        extract_html_elements(html)
    } else {
        "No HTML provided".to_string()
    };

    let prompt = format!(
        r#"Analyze this web page screenshot and suggest the next test steps for automated testing.

Current URL: {}
Current test context: {}

Current test steps already defined:
{}

Key HTML elements detected:
{}

Based on the screenshot, please:
1. Describe what you see on the page (UI elements, forms, buttons, navigation)
2. Identify interactive elements with their likely CSS selectors
3. Suggest 3-5 logical next test steps based on what's visible

Focus on:
- Login/authentication forms if visible
- Form inputs that need to be filled (use appropriate CSS selectors)
- Buttons and links that should be clicked
- Navigation elements
- Verification points (text that confirms success/failure)

IMPORTANT CSS SELECTOR PRIORITY:
1. data-testid attribute: [data-testid="login-button"]
2. id attribute: #login-button
3. name attribute: [name="username"]
4. aria-label: [aria-label="Submit"]
5. Unique class combinations: .btn.btn-primary.login
6. Text content for links: a:contains("Sign In") or use XPath
7. Type + placeholder: input[placeholder="Email"]

Respond in JSON format:
{{
    "page_description": "Brief description of the page",
    "page_url": "{}",
    "detected_elements": [
        {{
            "element_type": "button|input|link|text|select|checkbox|radio",
            "description": "What this element is for",
            "selector": "CSS selector like #id, .class, [data-testid='x']",
            "xpath": "//button[@type='submit']",
            "text_content": "Button text if any",
            "attributes": {{"id": "submit-btn", "class": "btn primary"}}
        }}
    ],
    "suggested_steps": [
        {{
            "step_type": "click|type|navigate|wait|verify|select|hover|scroll",
            "label": "Human readable step description",
            "config": {{
                "selector": "CSS selector",
                "xpath": "XPath alternative",
                "url": "URL for navigate steps",
                "value": "text to input if applicable",
                "timeout": 5000,
                "element_description": "What element this targets",
                "assertion_type": "visible|hidden|text|value|url|title",
                "expected_value": "expected text or value for verify steps"
            }},
            "confidence": 0.9
        }}
    ],
    "test_context": "Updated context based on analysis"
}}"#,
        url_info, context, current_steps_json, html_context, url_info
    );

    let request_body = serde_json::json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 2048,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_base64.trim_start_matches("data:image/png;base64,")
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to call AI API: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("AI API error: {}", error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse AI response: {}", e))?;

    let content = response_json["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["text"].as_str())
        .ok_or("Invalid AI response format")?;

    // Parse the JSON from Claude's response
    let json_str = if content.contains("```json") {
        content
            .split("```json")
            .nth(1)
            .and_then(|s| s.split("```").next())
            .unwrap_or(content)
    } else if content.contains("```") {
        content
            .split("```")
            .nth(1)
            .and_then(|s| s.split("```").next())
            .unwrap_or(content)
    } else {
        content
    };

    let result: AiWebAnalysisResult = serde_json::from_str(json_str.trim())
        .map_err(|e| format!("Failed to parse AI analysis result: {}. Response: {}", e, json_str))?;

    Ok(result)
}

/// Extract key HTML elements for AI context
fn extract_html_elements(html: &str) -> String {
    let mut elements = Vec::new();

    // Extract forms
    let form_re = Regex::new(r#"<form[^>]*>"#).unwrap();
    for cap in form_re.find_iter(html).take(5) {
        elements.push(format!("Form: {}", cap.as_str()));
    }

    // Extract inputs with attributes
    let input_re = Regex::new(r#"<input[^>]*(id|name|placeholder|type)="([^"]*)"[^>]*>"#).unwrap();
    for cap in input_re.captures_iter(html).take(10) {
        elements.push(format!("Input: {}", cap.get(0).map_or("", |m| m.as_str())));
    }

    // Extract buttons
    let button_re = Regex::new(r#"<button[^>]*>([^<]*)</button>"#).unwrap();
    for cap in button_re.captures_iter(html).take(10) {
        let full = cap.get(0).map_or("", |m| m.as_str());
        let text = cap.get(1).map_or("", |m| m.as_str());
        elements.push(format!("Button '{}': {}", text.trim(), full));
    }

    // Extract links
    let link_re = Regex::new(r#"<a[^>]*href="([^"]*)"[^>]*>([^<]*)</a>"#).unwrap();
    for cap in link_re.captures_iter(html).take(10) {
        let href = cap.get(1).map_or("", |m| m.as_str());
        let text = cap.get(2).map_or("", |m| m.as_str());
        elements.push(format!("Link '{}' -> {}", text.trim(), href));
    }

    // Extract data-testid elements
    let testid_re = Regex::new(r#"data-testid="([^"]*)""#).unwrap();
    for cap in testid_re.captures_iter(html).take(15) {
        let testid = cap.get(1).map_or("", |m| m.as_str());
        elements.push(format!("data-testid: {}", testid));
    }

    if elements.is_empty() {
        "No specific elements extracted from HTML".to_string()
    } else {
        elements.join("\n")
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiWebElementLocation {
    pub found: bool,
    pub selector: String,          // Primary CSS selector
    pub xpath: Option<String>,     // XPath alternative
    pub element_type: String,      // button, input, link, etc.
    pub confidence: f32,
    pub description: String,
    pub alternatives: Vec<String>, // Alternative selectors
}

/// Find a web element's selector using AI with screenshot and optional HTML
#[tauri::command]
pub async fn ai_find_web_element(
    screenshot_base64: String,
    element_description: String,
    page_html: Option<String>,
) -> Result<AiWebElementLocation, String> {
    let api_key = env::var("ANTHROPIC_API_KEY")
        .or_else(|_| env::var("CLAUDE_API_KEY"))
        .map_err(|_| "ANTHROPIC_API_KEY environment variable not set".to_string())?;

    let client = Client::new();

    // Extract elements from HTML if provided
    let html_context = if let Some(ref html) = page_html {
        extract_selectable_elements(html)
    } else {
        "No HTML provided - analyzing screenshot only".to_string()
    };

    let prompt = format!(
        r#"Find the web element matching: "{}"

I have extracted selectable elements from the page HTML:

{}

YOUR TASK:
1. Look at the screenshot to visually identify the element
2. Find the best CSS selector for the element described
3. Provide alternative selectors as fallbacks

SELECTOR PRIORITY (use the most reliable available):
1. data-testid: [data-testid="login-btn"]
2. id: #login-button
3. name: [name="username"]
4. aria-label: [aria-label="Submit form"]
5. Unique class combo: .btn.primary.submit
6. Type + attribute: button[type="submit"]
7. Text-based (use XPath): //button[contains(text(), "Login")]

SEMANTIC MATCHING:
- "Login button" → matches "Sign In", "Log In", "Login", "Enter"
- "Submit" → matches "Submit", "Send", "Confirm", "Done", "OK"
- "Email field" → matches input with type="email", placeholder="Email", name="email"
- "Password field" → matches input with type="password", name="password"
- "Search box" → matches input with type="search", placeholder containing "Search"

Respond with ONLY valid JSON (no markdown):
{{
    "found": true,
    "selector": "best CSS selector",
    "xpath": "//xpath/alternative",
    "element_type": "button|input|link|select|checkbox",
    "confidence": 0.95,
    "description": "Found element description",
    "alternatives": ["selector1", "selector2", "selector3"]
}}

If no match found:
{{
    "found": false,
    "selector": "",
    "xpath": null,
    "element_type": "unknown",
    "confidence": 0,
    "description": "No matching element found",
    "alternatives": []
}}"#,
        element_description, html_context
    );

    let request_body = serde_json::json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 512,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_base64.trim_start_matches("data:image/png;base64,")
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to call AI API: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("AI API error: {}", error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse AI response: {}", e))?;

    let content = response_json["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["text"].as_str())
        .ok_or("Invalid AI response format")?;

    let json_str = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let result: AiWebElementLocation = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse AI location: {}. Response: {}", e, json_str))?;

    Ok(result)
}

/// Extract selectable elements from HTML for AI context
fn extract_selectable_elements(html: &str) -> String {
    let mut elements = Vec::new();

    // data-testid elements (highest priority)
    let testid_re = Regex::new(r#"<([a-z]+)[^>]*data-testid="([^"]*)"[^>]*>"#).unwrap();
    for cap in testid_re.captures_iter(html).take(20) {
        let tag = cap.get(1).map_or("", |m| m.as_str());
        let testid = cap.get(2).map_or("", |m| m.as_str());
        elements.push(format!("{} [data-testid=\"{}\"]", tag, testid));
    }

    // Elements with id
    let id_re = Regex::new(r#"<([a-z]+)[^>]*id="([^"]*)"[^>]*>"#).unwrap();
    for cap in id_re.captures_iter(html).take(20) {
        let tag = cap.get(1).map_or("", |m| m.as_str());
        let id = cap.get(2).map_or("", |m| m.as_str());
        elements.push(format!("{} #{}", tag, id));
    }

    // Input elements with name
    let input_name_re = Regex::new(r#"<input[^>]*name="([^"]*)"[^>]*type="([^"]*)"[^>]*>"#).unwrap();
    for cap in input_name_re.captures_iter(html).take(15) {
        let name = cap.get(1).map_or("", |m| m.as_str());
        let input_type = cap.get(2).map_or("text", |m| m.as_str());
        elements.push(format!("input[name=\"{}\"] (type={})", name, input_type));
    }

    // Input elements with placeholder
    let placeholder_re = Regex::new(r#"<input[^>]*placeholder="([^"]*)"[^>]*>"#).unwrap();
    for cap in placeholder_re.captures_iter(html).take(10) {
        let placeholder = cap.get(1).map_or("", |m| m.as_str());
        elements.push(format!("input[placeholder=\"{}\"]", placeholder));
    }

    // Buttons with text
    let button_re = Regex::new(r#"<button[^>]*>([^<]+)</button>"#).unwrap();
    for cap in button_re.captures_iter(html).take(10) {
        let text = cap.get(1).map_or("", |m| m.as_str()).trim();
        if !text.is_empty() {
            elements.push(format!("button with text \"{}\"", text));
        }
    }

    // Links
    let link_re = Regex::new(r#"<a[^>]*>([^<]+)</a>"#).unwrap();
    for cap in link_re.captures_iter(html).take(10) {
        let text = cap.get(1).map_or("", |m| m.as_str()).trim();
        if !text.is_empty() {
            elements.push(format!("link with text \"{}\"", text));
        }
    }

    // aria-label elements
    let aria_re = Regex::new(r#"<([a-z]+)[^>]*aria-label="([^"]*)"[^>]*>"#).unwrap();
    for cap in aria_re.captures_iter(html).take(10) {
        let tag = cap.get(1).map_or("", |m| m.as_str());
        let label = cap.get(2).map_or("", |m| m.as_str());
        elements.push(format!("{} [aria-label=\"{}\"]", tag, label));
    }

    if elements.is_empty() {
        "No selectable elements extracted from HTML".to_string()
    } else {
        elements.join("\n")
    }
}

/// Quick AI suggestion for a single web test step
#[tauri::command]
pub async fn ai_suggest_web_step(
    screenshot_base64: String,
    last_step_type: Option<String>,
    test_goal: Option<String>,
    page_html: Option<String>,
) -> Result<AiWebSuggestedStep, String> {
    let api_key = env::var("ANTHROPIC_API_KEY")
        .or_else(|_| env::var("CLAUDE_API_KEY"))
        .map_err(|_| "ANTHROPIC_API_KEY environment variable not set".to_string())?;

    let client = Client::new();

    let last_action = last_step_type.unwrap_or_else(|| "none".to_string());
    let goal = test_goal.unwrap_or_else(|| "test the web application functionality".to_string());

    let html_context = if let Some(ref html) = page_html {
        extract_selectable_elements(html)
    } else {
        "No HTML provided".to_string()
    };

    let prompt = format!(
        r#"Look at this web page screenshot. The last action was: {}. The test goal is: {}.

Available elements from HTML:
{}

Suggest ONE logical next test step. Focus on the most prominent interactive element.
Provide a reliable CSS selector.

Respond with ONLY a JSON object (no markdown):
{{
    "step_type": "click|type|navigate|wait|verify|select",
    "label": "Short description",
    "config": {{
        "selector": "CSS selector like #id or [data-testid='x']",
        "xpath": "//xpath alternative",
        "value": "text if type step",
        "element_description": "what element"
    }},
    "confidence": 0.9
}}"#,
        last_action, goal, html_context
    );

    let request_body = serde_json::json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 512,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_base64.trim_start_matches("data:image/png;base64,")
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to call AI API: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("AI API error: {}", error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse AI response: {}", e))?;

    let content = response_json["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["text"].as_str())
        .ok_or("Invalid AI response format")?;

    let json_str = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let result: AiWebSuggestedStep = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse AI suggestion: {}. Response: {}", e, json_str))?;

    Ok(result)
}

// ============================================================================
// MOBILE AUTOMATION AI COMMANDS (existing)
// ============================================================================

/// Quick AI suggestion for a single step based on screen
#[tauri::command]
pub async fn ai_suggest_next_step(
    screenshot_base64: String,
    last_step_type: Option<String>,
    test_goal: Option<String>,
) -> Result<AiSuggestedStep, String> {
    let api_key = env::var("ANTHROPIC_API_KEY")
        .or_else(|_| env::var("CLAUDE_API_KEY"))
        .map_err(|_| "ANTHROPIC_API_KEY environment variable not set".to_string())?;

    let client = Client::new();

    let last_action = last_step_type.unwrap_or_else(|| "none".to_string());
    let goal = test_goal.unwrap_or_else(|| "test the app functionality".to_string());

    let prompt = format!(
        r#"Look at this mobile app screenshot. The last action was: {}. The test goal is: {}.

Suggest ONE logical next test step. Focus on the most prominent interactive element.

Respond with ONLY a JSON object (no markdown):
{{
    "step_type": "tap|swipe|input|wait",
    "label": "Short description",
    "config": {{
        "x": 540,
        "y": 800,
        "value": "text if input step",
        "element_description": "what element"
    }},
    "confidence": 0.9
}}"#,
        last_action, goal
    );

    let request_body = serde_json::json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 512,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_base64.trim_start_matches("data:image/png;base64,")
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to call AI API: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("AI API error: {}", error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse AI response: {}", e))?;

    let content = response_json["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["text"].as_str())
        .ok_or("Invalid AI response format")?;

    // Clean up the response
    let json_str = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let result: AiSuggestedStep = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse AI suggestion: {}. Response: {}", e, json_str))?;

    Ok(result)
}
