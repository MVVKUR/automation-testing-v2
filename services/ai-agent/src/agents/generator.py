"""Test generation agent using Claude."""

import json
import logging
import re
from typing import Any, Optional

from anthropic import AsyncAnthropic

from src.api.schemas import (
    GeneratedTest,
    Suggestion,
    SuggestionsResult,
    TestFramework,
)
from src.prompts.generation import get_generation_prompt, get_suggestion_prompt

logger = logging.getLogger(__name__)


class TestGenerator:
    """Agent for generating test code using Claude AI."""

    def __init__(
        self,
        api_key: str,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 8192,
    ):
        """Initialize the test generator.

        Args:
            api_key: Anthropic API key
            model: Claude model to use
            max_tokens: Maximum tokens in response
        """
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model
        self.max_tokens = max_tokens

    async def generate(
        self,
        code: str,
        language: str,
        framework: TestFramework,
        coverage_targets: Optional[list[str]] = None,
        test_style: Optional[str] = "unit",
        additional_instructions: Optional[str] = None,
    ) -> GeneratedTest:
        """Generate test code for the provided source.

        Args:
            code: Source code to generate tests for
            language: Programming language
            framework: Test framework to use
            coverage_targets: Specific functions/methods to cover
            test_style: Type of tests (unit, integration, e2e)
            additional_instructions: Additional generation instructions

        Returns:
            GeneratedTest with generated test code
        """
        logger.info(f"Generating {test_style} tests using {framework} for {language}")

        system_prompt, user_prompt = get_generation_prompt(
            code=code,
            language=language,
            framework=framework.value,
            test_style=test_style or "unit",
            coverage_targets=coverage_targets,
            additional_instructions=additional_instructions,
        )

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            response_text = response.content[0].text
            result_data = self._parse_response(response_text)

            # Get file extension based on language
            extensions = {
                "python": "py",
                "javascript": "js",
                "typescript": "ts",
                "java": "java",
                "go": "go",
                "rust": "rs",
            }
            ext = extensions.get(language.lower(), "txt")

            return GeneratedTest(
                test_code=result_data.get("test_code", self._extract_code(response_text)),
                test_file_name=result_data.get(
                    "test_file_name", f"test_generated.{ext}"
                ),
                imports=result_data.get("imports", []),
                setup_instructions=result_data.get("setup_instructions"),
                coverage_estimate=result_data.get("coverage_estimate"),
            )

        except Exception as e:
            logger.error(f"Test generation failed: {e}")
            raise

    async def suggest_improvements(
        self,
        code: str,
        existing_tests: str,
        language: str,
        framework: TestFramework,
    ) -> SuggestionsResult:
        """Analyze existing tests and suggest improvements.

        Args:
            code: Source code
            existing_tests: Existing test code
            language: Programming language
            framework: Test framework

        Returns:
            SuggestionsResult with improvement suggestions
        """
        logger.info(f"Generating test improvement suggestions for {language}")

        system_prompt, user_prompt = get_suggestion_prompt(
            code=code,
            existing_tests=existing_tests,
            language=language,
            framework=framework.value,
        )

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            response_text = response.content[0].text
            result_data = self._parse_response(response_text)

            suggestions = []
            for s in result_data.get("suggestions", []):
                suggestions.append(
                    Suggestion(
                        category=s.get("category", "general"),
                        description=s.get("description", ""),
                        priority=s.get("priority", "medium"),
                        code_example=s.get("code_example"),
                    )
                )

            return SuggestionsResult(
                suggestions=suggestions,
                missing_coverage=result_data.get("missing_coverage", []),
                overall_assessment=result_data.get(
                    "overall_assessment", "Analysis complete"
                ),
            )

        except Exception as e:
            logger.error(f"Suggestion generation failed: {e}")
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

        # If no JSON found, try to extract code blocks
        logger.warning("Failed to parse JSON, extracting code directly")
        return {
            "test_code": self._extract_code(response_text),
            "imports": [],
        }

    def _extract_code(self, response_text: str) -> str:
        """Extract code from response when JSON parsing fails.

        Args:
            response_text: Raw response text

        Returns:
            Extracted code or the full response
        """
        # Try to find code block
        code_match = re.search(
            r"```(?:python|javascript|typescript|java|go|rust)?\s*\n?(.*?)\n?```",
            response_text,
            re.DOTALL,
        )
        if code_match:
            return code_match.group(1).strip()

        # Return full response if no code block found
        return response_text.strip()

    async def generate_with_langchain(
        self,
        code: str,
        language: str,
        framework: TestFramework,
        test_style: str = "unit",
    ) -> GeneratedTest:
        """Generate tests using LangChain for more complex workflows.

        This method uses LangChain for chain-of-thought reasoning
        and multi-step test generation.

        Args:
            code: Source code to generate tests for
            language: Programming language
            framework: Test framework to use
            test_style: Type of tests

        Returns:
            GeneratedTest with generated test code
        """
        try:
            from langchain_anthropic import ChatAnthropic
            from langchain_core.messages import HumanMessage, SystemMessage
            from langchain_core.output_parsers import JsonOutputParser

            # Initialize LangChain model
            llm = ChatAnthropic(
                model=self.model,
                anthropic_api_key=self.client.api_key,
                max_tokens=self.max_tokens,
            )

            # Create output parser
            parser = JsonOutputParser()

            system_prompt, user_prompt = get_generation_prompt(
                code=code,
                language=language,
                framework=framework.value,
                test_style=test_style,
            )

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

            response = await llm.ainvoke(messages)

            try:
                result_data = parser.parse(response.content)
            except Exception:
                result_data = self._parse_response(response.content)

            extensions = {
                "python": "py",
                "javascript": "js",
                "typescript": "ts",
            }
            ext = extensions.get(language.lower(), "txt")

            return GeneratedTest(
                test_code=result_data.get("test_code", ""),
                test_file_name=result_data.get(
                    "test_file_name", f"test_generated.{ext}"
                ),
                imports=result_data.get("imports", []),
                setup_instructions=result_data.get("setup_instructions"),
                coverage_estimate=result_data.get("coverage_estimate"),
            )

        except ImportError:
            logger.warning("LangChain not available, falling back to direct API")
            return await self.generate(
                code=code,
                language=language,
                framework=framework,
                test_style=test_style,
            )
