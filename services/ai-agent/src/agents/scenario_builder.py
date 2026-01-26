"""Scenario builder agent for creating test scenarios from natural language."""

import json
import logging
import re
from typing import Any, Optional
from uuid import uuid4

from anthropic import AsyncAnthropic

from src.api.schemas import (
    BuiltScenario,
    ScenarioStep,
    TestFramework,
)

logger = logging.getLogger(__name__)


SCENARIO_BUILDER_SYSTEM_PROMPT = """You are an expert test automation engineer specializing in creating detailed test scenarios from natural language descriptions.

When building test scenarios:
1. Break down the description into atomic, executable steps
2. Generate appropriate CSS selectors or XPath for UI elements
3. Include proper assertions after key actions
4. Handle common patterns like form submissions, navigation, and authentication
5. Consider edge cases and error scenarios
6. Generate framework-specific test code when requested

Always respond with structured JSON that can be parsed programmatically."""


SCENARIO_BUILD_PROMPT = """Convert the following natural language test description into a detailed test scenario:

Description: {description}

Base URL: {base_url}
Target Framework: {framework}
Include Assertions: {include_assertions}

Create a comprehensive test scenario with:
1. Clear step-by-step actions
2. Appropriate selectors (prefer data-testid when possible, fallback to CSS/XPath)
3. Assertions to verify expected behavior
4. Generated test code for {framework}

Respond with JSON:
{{
    "id": "scenario-{uuid}",
    "name": "generated_test_name",
    "description": "Clear description of what the test verifies",
    "steps": [
        {{
            "id": "step-1",
            "type": "navigation|action|assertion",
            "action": "navigate|click|type|select|hover|assert|wait",
            "target": "Description of target element",
            "selector": "[data-testid='element']",
            "value": "input value or expected value",
            "timeout": 5000
        }}
    ],
    "generated_code": "// Full test code for {framework}\\n...",
    "framework": "{framework}",
    "test_data": {{
        "key": "value"
    }},
    "preconditions": ["User is not logged in"],
    "tags": ["smoke", "login"]
}}

Common action patterns:
- navigate: Go to URL (value = URL path)
- click: Click element (selector required)
- type: Enter text (selector + value required)
- select: Select dropdown option (selector + value)
- hover: Hover over element (selector)
- assert: Verify condition (type: visible|contains|url|value)
- wait: Wait for condition (type: element|timeout|network)"""


CYPRESS_CODE_TEMPLATE = '''describe('{name}', () => {{
  beforeEach(() => {{
    {before_each}
  }});

  it('{test_name}', () => {{
    {test_body}
  }});
}});'''


PLAYWRIGHT_CODE_TEMPLATE = '''import {{ test, expect }} from '@playwright/test';

test.describe('{name}', () => {{
  test.beforeEach(async ({{ page }}) => {{
    {before_each}
  }});

  test('{test_name}', async ({{ page }}) => {{
    {test_body}
  }});
}});'''


class ScenarioBuilder:
    """Agent for building test scenarios from natural language descriptions."""

    def __init__(
        self,
        api_key: str,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 8192,
    ):
        """Initialize the scenario builder.

        Args:
            api_key: Anthropic API key
            model: Claude model to use
            max_tokens: Maximum tokens in response
        """
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model
        self.max_tokens = max_tokens

    async def build_scenario(
        self,
        description: str,
        base_url: Optional[str] = None,
        framework: TestFramework = TestFramework.CYPRESS,
        include_assertions: bool = True,
    ) -> BuiltScenario:
        """Build a test scenario from natural language description.

        Args:
            description: Natural language description of the test
            base_url: Base URL for the application
            framework: Target test framework
            include_assertions: Whether to auto-generate assertions

        Returns:
            BuiltScenario with steps and generated code
        """
        logger.info(f"Building scenario for framework: {framework.value}")

        user_prompt = SCENARIO_BUILD_PROMPT.format(
            description=description,
            base_url=base_url or "https://example.com",
            framework=framework.value,
            include_assertions=include_assertions,
            uuid=str(uuid4())[:8],
        )

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=SCENARIO_BUILDER_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            response_text = response.content[0].text
            result_data = self._parse_response(response_text)

            # Build steps
            steps = []
            for step_data in result_data.get("steps", []):
                steps.append(
                    ScenarioStep(
                        id=step_data.get("id", f"step-{len(steps)+1}"),
                        type=step_data.get("type", "action"),
                        action=step_data.get("action", ""),
                        target=step_data.get("target"),
                        selector=step_data.get("selector"),
                        value=step_data.get("value"),
                        timeout=step_data.get("timeout"),
                    )
                )

            # Generate or use provided code
            generated_code = result_data.get("generated_code")
            if not generated_code:
                generated_code = self._generate_code(steps, framework, base_url)

            return BuiltScenario(
                id=result_data.get("id", f"scenario-{uuid4().hex[:8]}"),
                name=result_data.get("name", "generated_test"),
                description=result_data.get("description", description),
                steps=steps,
                generated_code=generated_code,
                framework=framework,
            )

        except Exception as e:
            logger.error(f"Scenario building failed: {e}")
            raise

    async def enhance_scenario(
        self,
        scenario: BuiltScenario,
        enhancement_type: str = "assertions",
    ) -> BuiltScenario:
        """Enhance an existing scenario with additional steps or assertions.

        Args:
            scenario: Existing scenario to enhance
            enhancement_type: Type of enhancement (assertions, edge_cases, error_handling)

        Returns:
            Enhanced BuiltScenario
        """
        logger.info(f"Enhancing scenario with {enhancement_type}")

        steps_json = [
            {
                "id": s.id,
                "type": s.type,
                "action": s.action,
                "target": s.target,
                "selector": s.selector,
                "value": s.value,
            }
            for s in scenario.steps
        ]

        prompt = f"""Enhance this test scenario with {enhancement_type}:

Current scenario:
Name: {scenario.name}
Description: {scenario.description}
Steps: {json.dumps(steps_json, indent=2)}

Enhancement type: {enhancement_type}
- assertions: Add verification steps after key actions
- edge_cases: Add steps for edge case testing
- error_handling: Add negative test scenarios and error checks

Respond with the enhanced scenario in the same JSON format as before."""

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=SCENARIO_BUILDER_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = response.content[0].text
            result_data = self._parse_response(response_text)

            # Build enhanced steps
            steps = []
            for step_data in result_data.get("steps", []):
                steps.append(
                    ScenarioStep(
                        id=step_data.get("id", f"step-{len(steps)+1}"),
                        type=step_data.get("type", "action"),
                        action=step_data.get("action", ""),
                        target=step_data.get("target"),
                        selector=step_data.get("selector"),
                        value=step_data.get("value"),
                        timeout=step_data.get("timeout"),
                    )
                )

            # Regenerate code with enhanced steps
            generated_code = self._generate_code(steps, scenario.framework, None)

            return BuiltScenario(
                id=scenario.id,
                name=result_data.get("name", scenario.name),
                description=result_data.get("description", scenario.description),
                steps=steps,
                generated_code=generated_code,
                framework=scenario.framework,
            )

        except Exception as e:
            logger.error(f"Scenario enhancement failed: {e}")
            raise

    async def convert_to_code(
        self,
        scenario: BuiltScenario,
        target_framework: TestFramework,
    ) -> str:
        """Convert a scenario to code for a specific framework.

        Args:
            scenario: Scenario to convert
            target_framework: Target test framework

        Returns:
            Generated test code
        """
        logger.info(f"Converting scenario to {target_framework.value} code")

        steps_json = [
            {
                "id": s.id,
                "type": s.type,
                "action": s.action,
                "target": s.target,
                "selector": s.selector,
                "value": s.value,
            }
            for s in scenario.steps
        ]

        prompt = f"""Generate {target_framework.value} test code for this scenario:

Name: {scenario.name}
Description: {scenario.description}
Steps: {json.dumps(steps_json, indent=2)}

Generate complete, runnable test code following {target_framework.value} best practices.
Include proper imports, setup, and teardown.

Respond with just the code, no JSON wrapper."""

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=SCENARIO_BUILDER_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = response.content[0].text

            # Extract code from markdown if present
            code_match = re.search(
                r"```(?:javascript|typescript|python)?\s*\n?(.*?)\n?```",
                response_text,
                re.DOTALL,
            )
            if code_match:
                return code_match.group(1).strip()

            return response_text.strip()

        except Exception as e:
            logger.error(f"Code conversion failed: {e}")
            raise

    def _generate_code(
        self,
        steps: list[ScenarioStep],
        framework: TestFramework,
        base_url: Optional[str],
    ) -> str:
        """Generate test code from steps.

        Args:
            steps: List of scenario steps
            framework: Target framework
            base_url: Base URL for the application

        Returns:
            Generated test code
        """
        if framework == TestFramework.CYPRESS:
            return self._generate_cypress_code(steps, base_url)
        elif framework == TestFramework.PLAYWRIGHT:
            return self._generate_playwright_code(steps, base_url)
        else:
            return self._generate_generic_code(steps, framework)

    def _generate_cypress_code(
        self, steps: list[ScenarioStep], base_url: Optional[str]
    ) -> str:
        """Generate Cypress test code."""
        before_each = ""
        if base_url:
            before_each = f"cy.visit('{base_url}');"

        test_lines = []
        for step in steps:
            if step.action == "navigate":
                test_lines.append(f"    cy.visit('{step.value}');")
            elif step.action == "click":
                test_lines.append(f"    cy.get('{step.selector}').click();")
            elif step.action == "type":
                test_lines.append(f"    cy.get('{step.selector}').type('{step.value}');")
            elif step.action == "select":
                test_lines.append(f"    cy.get('{step.selector}').select('{step.value}');")
            elif step.action == "assert":
                if step.type == "visible":
                    test_lines.append(f"    cy.get('{step.selector}').should('be.visible');")
                elif step.type == "contains":
                    test_lines.append(
                        f"    cy.get('{step.selector}').should('contain', '{step.value}');"
                    )
                elif step.type == "url":
                    test_lines.append(f"    cy.url().should('include', '{step.value}');")
            elif step.action == "wait":
                timeout = step.timeout or 5000
                test_lines.append(f"    cy.wait({timeout});")

        test_body = "\n".join(test_lines) if test_lines else "    // Add test steps"

        return CYPRESS_CODE_TEMPLATE.format(
            name="Generated Test Suite",
            before_each=before_each or "// Setup",
            test_name="should complete the test scenario",
            test_body=test_body,
        )

    def _generate_playwright_code(
        self, steps: list[ScenarioStep], base_url: Optional[str]
    ) -> str:
        """Generate Playwright test code."""
        before_each = ""
        if base_url:
            before_each = f"await page.goto('{base_url}');"

        test_lines = []
        for step in steps:
            if step.action == "navigate":
                test_lines.append(f"    await page.goto('{step.value}');")
            elif step.action == "click":
                test_lines.append(f"    await page.click('{step.selector}');")
            elif step.action == "type":
                test_lines.append(f"    await page.fill('{step.selector}', '{step.value}');")
            elif step.action == "select":
                test_lines.append(
                    f"    await page.selectOption('{step.selector}', '{step.value}');"
                )
            elif step.action == "assert":
                if step.type == "visible":
                    test_lines.append(
                        f"    await expect(page.locator('{step.selector}')).toBeVisible();"
                    )
                elif step.type == "contains":
                    test_lines.append(
                        f"    await expect(page.locator('{step.selector}')).toContainText('{step.value}');"
                    )
                elif step.type == "url":
                    test_lines.append(
                        f"    await expect(page).toHaveURL(/{step.value}/);"
                    )
            elif step.action == "wait":
                timeout = step.timeout or 5000
                test_lines.append(f"    await page.waitForTimeout({timeout});")

        test_body = "\n".join(test_lines) if test_lines else "    // Add test steps"

        return PLAYWRIGHT_CODE_TEMPLATE.format(
            name="Generated Test Suite",
            before_each=before_each or "// Setup",
            test_name="should complete the test scenario",
            test_body=test_body,
        )

    def _generate_generic_code(
        self, steps: list[ScenarioStep], framework: TestFramework
    ) -> str:
        """Generate generic pseudo-code."""
        lines = [f"// Test code for {framework.value}", ""]
        for i, step in enumerate(steps, 1):
            lines.append(f"// Step {i}: {step.action}")
            if step.target:
                lines.append(f"// Target: {step.target}")
            if step.selector:
                lines.append(f"// Selector: {step.selector}")
            if step.value:
                lines.append(f"// Value: {step.value}")
            lines.append("")
        return "\n".join(lines)

    def _parse_response(self, response_text: str) -> dict[str, Any]:
        """Parse the Claude response to extract JSON."""
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
        return {"error": "Failed to parse response"}
