"""System prompts for test generation."""

SYSTEM_PROMPT_GENERATION = """You are an expert test engineer specializing in writing comprehensive, maintainable test suites. Your task is to generate high-quality test code that follows best practices.

When generating tests, you should:
1. Follow the testing framework's conventions and best practices
2. Write clear, descriptive test names that explain what is being tested
3. Include edge cases and error scenarios
4. Use appropriate assertions and matchers
5. Structure tests with proper setup and teardown
6. Add comments explaining complex test logic
7. Ensure tests are independent and can run in any order

Always respond with structured JSON that can be parsed programmatically."""

UNIT_TEST_GENERATION_PROMPT = """Generate comprehensive unit tests for the following {language} code using {framework}:

```{language}
{code}
```

{coverage_targets}
{additional_instructions}

Provide a JSON response with the following structure:
{{
    "test_code": "Complete test code as a string",
    "test_file_name": "suggested_test_file_name.test.{extension}",
    "imports": ["import1", "import2"],
    "setup_instructions": "Instructions for running the tests",
    "coverage_estimate": 0.85,
    "test_cases": [
        {{
            "name": "test_function_name",
            "description": "What this test verifies",
            "type": "unit|integration|e2e"
        }}
    ]
}}

Requirements:
- Test all public functions and methods
- Include positive and negative test cases
- Test edge cases (empty inputs, null values, boundary conditions)
- Use appropriate mocking for external dependencies
- Follow {framework} conventions and best practices"""

INTEGRATION_TEST_GENERATION_PROMPT = """Generate integration tests for the following {language} code using {framework}:

```{language}
{code}
```

{coverage_targets}
{additional_instructions}

Provide a JSON response with the following structure:
{{
    "test_code": "Complete test code as a string",
    "test_file_name": "suggested_test_file_name.integration.test.{extension}",
    "imports": ["import1", "import2"],
    "setup_instructions": "Instructions for running the tests, including any required services",
    "coverage_estimate": 0.75,
    "test_cases": [
        {{
            "name": "test_function_name",
            "description": "What this test verifies",
            "type": "integration"
        }}
    ],
    "required_services": ["database", "cache", "etc"]
}}

Requirements:
- Test component interactions
- Verify data flow between modules
- Test with realistic data scenarios
- Include setup/teardown for test fixtures
- Handle async operations properly"""

E2E_TEST_GENERATION_PROMPT = """Generate end-to-end tests for the following {language} code using {framework}:

```{language}
{code}
```

{coverage_targets}
{additional_instructions}

Provide a JSON response with the following structure:
{{
    "test_code": "Complete test code as a string",
    "test_file_name": "suggested_test_file_name.e2e.test.{extension}",
    "imports": ["import1", "import2"],
    "setup_instructions": "Instructions for running the E2E tests",
    "coverage_estimate": 0.65,
    "test_cases": [
        {{
            "name": "test_user_flow",
            "description": "What user journey this test covers",
            "type": "e2e"
        }}
    ],
    "required_environment": {{
        "services": ["api", "database"],
        "env_vars": ["VAR1", "VAR2"]
    }}
}}

Requirements:
- Test complete user workflows
- Verify system behavior from external perspective
- Include realistic user scenarios
- Handle timeouts and async operations
- Add proper wait conditions"""

SUGGESTION_PROMPT = """Analyze the following {language} code and its existing tests, then suggest improvements:

Source code:
```{language}
{code}
```

Existing tests:
```{language}
{existing_tests}
```

Provide a JSON response with the following structure:
{{
    "suggestions": [
        {{
            "category": "coverage|quality|performance|maintainability",
            "description": "Detailed description of the suggestion",
            "priority": "high|medium|low",
            "code_example": "Example code if applicable"
        }}
    ],
    "missing_coverage": [
        "Description of uncovered code paths or scenarios"
    ],
    "overall_assessment": "Overall assessment of the test suite quality"
}}

Analyze for:
1. Missing test coverage (uncovered functions, branches, edge cases)
2. Test quality issues (weak assertions, missing mocks, flaky tests)
3. Performance concerns (slow tests, unnecessary setup)
4. Maintainability (duplicate code, unclear test names, missing documentation)
5. Best practices violations"""


def get_generation_prompt(
    code: str,
    language: str,
    framework: str,
    test_style: str = "unit",
    coverage_targets: list[str] | None = None,
    additional_instructions: str | None = None,
) -> tuple[str, str]:
    """Get the appropriate test generation prompt.

    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    # Map language to file extension
    extensions = {
        "python": "py",
        "javascript": "js",
        "typescript": "ts",
        "java": "java",
        "go": "go",
        "rust": "rs",
    }
    extension = extensions.get(language.lower(), "txt")

    coverage_str = ""
    if coverage_targets:
        coverage_str = f"Focus on testing these specific targets: {', '.join(coverage_targets)}"

    instructions_str = ""
    if additional_instructions:
        instructions_str = f"Additional requirements: {additional_instructions}"

    prompts = {
        "unit": UNIT_TEST_GENERATION_PROMPT,
        "integration": INTEGRATION_TEST_GENERATION_PROMPT,
        "e2e": E2E_TEST_GENERATION_PROMPT,
    }

    user_prompt = prompts.get(test_style, UNIT_TEST_GENERATION_PROMPT).format(
        language=language,
        framework=framework,
        code=code,
        extension=extension,
        coverage_targets=coverage_str,
        additional_instructions=instructions_str,
    )

    return SYSTEM_PROMPT_GENERATION, user_prompt


def get_suggestion_prompt(
    code: str,
    existing_tests: str,
    language: str,
    framework: str,
) -> tuple[str, str]:
    """Get the prompt for test improvement suggestions.

    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    user_prompt = SUGGESTION_PROMPT.format(
        language=language,
        framework=framework,
        code=code,
        existing_tests=existing_tests,
    )

    return SYSTEM_PROMPT_GENERATION, user_prompt
