"""Requirements parser agent for extracting test scenarios from documents."""

import json
import logging
import re
from typing import Any, Optional

from anthropic import AsyncAnthropic

from src.api.schemas import (
    ParsedRequirement,
    RequirementType,
    TestScenario,
    TestStep,
)

logger = logging.getLogger(__name__)


REQUIREMENTS_PARSER_SYSTEM_PROMPT = """You are an expert requirements analyst and test engineer. Your task is to analyze requirements documents and extract structured test scenarios.

When parsing requirements:
1. Identify functional requirements, user stories, and acceptance criteria
2. Extract testable scenarios from each requirement
3. Define clear test steps with expected outcomes
4. Identify preconditions and test data needs
5. Categorize requirements by type (functional, non-functional, security, performance)
6. Assign priority based on business impact

Always respond with structured JSON that can be parsed programmatically."""


REQUIREMENTS_PARSING_PROMPT = """Analyze the following requirements document and extract structured test scenarios:

---
{content}
---

{context}

Provide a JSON response with the following structure:
{{
    "requirements": [
        {{
            "id": "REQ-001",
            "title": "Requirement title",
            "description": "Full requirement description",
            "type": "functional|non_functional|security|performance|accessibility",
            "priority": "critical|high|medium|low",
            "acceptance_criteria": ["Criterion 1", "Criterion 2"],
            "source_text": "Original text from document"
        }}
    ],
    "test_scenarios": [
        {{
            "id": "TC-001",
            "requirement_id": "REQ-001",
            "name": "Test scenario name",
            "description": "What this test verifies",
            "preconditions": ["Precondition 1", "Precondition 2"],
            "steps": [
                {{
                    "order": 1,
                    "action": "User action or system input",
                    "expected_result": "Expected outcome",
                    "test_data": {{"field": "value"}}
                }}
            ],
            "postconditions": ["Expected state after test"],
            "test_type": "functional|integration|e2e|api|ui",
            "priority": "critical|high|medium|low",
            "tags": ["login", "authentication"]
        }}
    ],
    "summary": {{
        "total_requirements": 5,
        "total_scenarios": 10,
        "coverage_assessment": "Assessment of test coverage",
        "missing_areas": ["Areas that need more requirements or tests"]
    }}
}}

Requirements to analyze:
1. Extract ALL testable requirements from the document
2. Create comprehensive test scenarios covering positive, negative, and edge cases
3. Include clear, actionable test steps
4. Identify dependencies between requirements
5. Suggest additional scenarios for thorough coverage"""


USER_STORY_PARSING_PROMPT = """Parse the following user stories and generate test scenarios:

---
{content}
---

For each user story in format "As a [role], I want [feature], so that [benefit]":
1. Extract the role, feature, and benefit
2. Generate acceptance criteria if not provided
3. Create test scenarios covering the feature

Provide a JSON response with:
{{
    "user_stories": [
        {{
            "id": "US-001",
            "role": "user role",
            "feature": "desired feature",
            "benefit": "expected benefit",
            "acceptance_criteria": ["AC1", "AC2"]
        }}
    ],
    "test_scenarios": [
        {{
            "id": "TC-001",
            "user_story_id": "US-001",
            "name": "Test scenario name",
            "description": "What this test verifies",
            "gherkin": {{
                "given": ["Given context"],
                "when": ["When action"],
                "then": ["Then outcome"]
            }},
            "steps": [
                {{
                    "order": 1,
                    "action": "Test action",
                    "expected_result": "Expected outcome"
                }}
            ],
            "test_type": "functional|e2e|api",
            "priority": "high|medium|low"
        }}
    ]
}}"""


class RequirementsParser:
    """Agent for parsing requirements documents and extracting test scenarios."""

    def __init__(
        self,
        api_key: str,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 8192,
    ):
        """Initialize the requirements parser.

        Args:
            api_key: Anthropic API key
            model: Claude model to use
            max_tokens: Maximum tokens in response
        """
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model
        self.max_tokens = max_tokens

    async def parse_requirements(
        self,
        content: str,
        document_type: str = "requirements",
        context: Optional[str] = None,
    ) -> dict[str, Any]:
        """Parse a requirements document and extract test scenarios.

        Args:
            content: Requirements document content
            document_type: Type of document (requirements, user_stories, brd, prd)
            context: Additional context about the project

        Returns:
            Dictionary with parsed requirements and test scenarios
        """
        logger.info(f"Parsing {document_type} document")

        context_str = f"Additional context: {context}" if context else ""

        # Choose appropriate prompt based on document type
        if document_type == "user_stories":
            user_prompt = USER_STORY_PARSING_PROMPT.format(content=content)
        else:
            user_prompt = REQUIREMENTS_PARSING_PROMPT.format(
                content=content,
                context=context_str,
            )

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=REQUIREMENTS_PARSER_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            response_text = response.content[0].text
            result_data = self._parse_response(response_text)

            return result_data

        except Exception as e:
            logger.error(f"Requirements parsing failed: {e}")
            raise

    async def extract_test_cases(
        self,
        requirements: list[dict[str, Any]],
        test_framework: str = "cypress",
        include_negative_cases: bool = True,
    ) -> list[TestScenario]:
        """Generate detailed test cases from parsed requirements.

        Args:
            requirements: List of parsed requirements
            test_framework: Target test framework
            include_negative_cases: Whether to include negative test cases

        Returns:
            List of TestScenario objects
        """
        logger.info(f"Extracting test cases for {len(requirements)} requirements")

        prompt = f"""Given these requirements, generate detailed test cases for {test_framework}:

Requirements:
{json.dumps(requirements, indent=2)}

Generate test cases with:
1. Clear, descriptive names
2. Step-by-step actions with selectors (CSS/XPath for UI tests)
3. Assertions for each step
4. Test data suggestions
{"5. Include negative test cases (invalid inputs, error handling)" if include_negative_cases else ""}

Respond with JSON:
{{
    "test_cases": [
        {{
            "id": "TC-001",
            "requirement_id": "REQ-001",
            "name": "test_user_login_success",
            "description": "Verify successful user login with valid credentials",
            "tags": ["smoke", "login"],
            "steps": [
                {{
                    "order": 1,
                    "action": "navigate",
                    "target": "/login",
                    "selector": null,
                    "value": null,
                    "assertion": null
                }},
                {{
                    "order": 2,
                    "action": "type",
                    "target": "email field",
                    "selector": "[data-testid='email-input']",
                    "value": "test@example.com",
                    "assertion": null
                }},
                {{
                    "order": 3,
                    "action": "click",
                    "target": "submit button",
                    "selector": "[data-testid='submit-btn']",
                    "value": null,
                    "assertion": {{
                        "type": "url_contains",
                        "value": "/dashboard"
                    }}
                }}
            ],
            "test_data": {{
                "email": "test@example.com",
                "password": "password123"
            }},
            "expected_outcome": "User is redirected to dashboard",
            "is_negative": false
        }}
    ]
}}"""

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=REQUIREMENTS_PARSER_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = response.content[0].text
            result_data = self._parse_response(response_text)

            # Convert to TestScenario objects
            scenarios = []
            for tc in result_data.get("test_cases", []):
                steps = []
                for step in tc.get("steps", []):
                    steps.append(
                        TestStep(
                            order=step.get("order", 0),
                            action=step.get("action", ""),
                            target=step.get("target"),
                            selector=step.get("selector"),
                            value=step.get("value"),
                            assertion=step.get("assertion"),
                        )
                    )

                scenarios.append(
                    TestScenario(
                        id=tc.get("id", ""),
                        requirement_id=tc.get("requirement_id"),
                        name=tc.get("name", ""),
                        description=tc.get("description", ""),
                        steps=steps,
                        tags=tc.get("tags", []),
                        test_data=tc.get("test_data"),
                        expected_outcome=tc.get("expected_outcome"),
                        is_negative=tc.get("is_negative", False),
                    )
                )

            return scenarios

        except Exception as e:
            logger.error(f"Test case extraction failed: {e}")
            raise

    async def analyze_coverage(
        self,
        requirements: list[dict[str, Any]],
        existing_tests: Optional[str] = None,
    ) -> dict[str, Any]:
        """Analyze test coverage for requirements.

        Args:
            requirements: List of parsed requirements
            existing_tests: Existing test code to analyze

        Returns:
            Coverage analysis results
        """
        logger.info("Analyzing test coverage")

        existing_tests_section = ""
        if existing_tests:
            existing_tests_section = f"""
Existing tests:
```
{existing_tests}
```
"""

        prompt = f"""Analyze test coverage for these requirements:

Requirements:
{json.dumps(requirements, indent=2)}
{existing_tests_section}

Provide a coverage analysis in JSON format:
{{
    "overall_coverage": 0.75,
    "covered_requirements": ["REQ-001", "REQ-002"],
    "uncovered_requirements": ["REQ-003"],
    "partial_coverage": [
        {{
            "requirement_id": "REQ-004",
            "coverage_percentage": 0.5,
            "missing_scenarios": ["edge case 1", "error handling"]
        }}
    ],
    "recommendations": [
        {{
            "priority": "high",
            "requirement_id": "REQ-003",
            "suggestion": "Add tests for user registration flow"
        }}
    ],
    "risk_assessment": {{
        "high_risk_areas": ["payment processing"],
        "medium_risk_areas": ["user profile"],
        "low_risk_areas": ["static pages"]
    }}
}}"""

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=REQUIREMENTS_PARSER_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = response.content[0].text
            return self._parse_response(response_text)

        except Exception as e:
            logger.error(f"Coverage analysis failed: {e}")
            raise

    def _parse_response(self, response_text: str) -> dict[str, Any]:
        """Parse the Claude response to extract JSON.

        Args:
            response_text: Raw response text from Claude

        Returns:
            Parsed dictionary from JSON response
        """
        # Try direct JSON parsing
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass

        # Try to find JSON block in markdown
        json_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", response_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find JSON object directly
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass

        logger.warning("Failed to parse JSON from response")
        return {
            "error": "Failed to parse response",
            "raw_response": response_text[:1000],
        }
