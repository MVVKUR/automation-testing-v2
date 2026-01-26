"""System prompts for code analysis."""

SYSTEM_PROMPT_ANALYSIS = """You are an expert code analyst specializing in software quality, testing strategies, and code architecture. Your task is to analyze source code and provide detailed insights.

When analyzing code, you should:
1. Identify the code structure (classes, functions, modules)
2. Assess code complexity and maintainability
3. Identify dependencies and external integrations
4. Evaluate testability and suggest testing strategies
5. Identify potential issues or code smells
6. Provide actionable recommendations

Always respond with structured JSON that can be parsed programmatically."""

STRUCTURE_ANALYSIS_PROMPT = """Analyze the structure of the following {language} code:

```{language}
{code}
```

{context}

Provide a JSON response with the following structure:
{{
    "summary": "Brief summary of what the code does",
    "structure": {{
        "classes": [
            {{
                "name": "ClassName",
                "methods": ["method1", "method2"],
                "properties": ["prop1", "prop2"],
                "line_start": 1,
                "line_end": 50
            }}
        ],
        "functions": [
            {{
                "name": "function_name",
                "parameters": ["param1", "param2"],
                "return_type": "type or null",
                "line_start": 1,
                "line_end": 10
            }}
        ],
        "imports": ["module1", "module2"],
        "exports": ["export1", "export2"]
    }},
    "recommendations": ["recommendation1", "recommendation2"]
}}"""

COMPLEXITY_ANALYSIS_PROMPT = """Analyze the complexity of the following {language} code:

```{language}
{code}
```

{context}

Provide a JSON response with the following structure:
{{
    "summary": "Brief complexity assessment",
    "complexity": {{
        "cyclomatic_complexity": {{
            "total": 10,
            "by_function": {{
                "function_name": 5
            }}
        }},
        "cognitive_complexity": {{
            "total": 15,
            "high_complexity_areas": ["area1", "area2"]
        }},
        "lines_of_code": {{
            "total": 100,
            "code": 80,
            "comments": 10,
            "blank": 10
        }},
        "maintainability_index": 75
    }},
    "issues": [
        {{
            "type": "high_complexity",
            "location": "function_name",
            "description": "Description of the issue",
            "severity": "medium"
        }}
    ],
    "recommendations": ["recommendation1", "recommendation2"]
}}"""

TESTABILITY_ANALYSIS_PROMPT = """Analyze the testability of the following {language} code:

```{language}
{code}
```

{context}

Provide a JSON response with the following structure:
{{
    "summary": "Brief testability assessment",
    "testability_score": 0.75,
    "structure": {{
        "testable_units": [
            {{
                "name": "unit_name",
                "type": "function|class|method",
                "testability": "high|medium|low",
                "suggested_test_types": ["unit", "integration"]
            }}
        ],
        "dependencies": {{
            "external": ["dep1", "dep2"],
            "internal": ["module1", "module2"],
            "mockable": ["service1", "service2"]
        }}
    }},
    "issues": [
        {{
            "type": "tight_coupling",
            "location": "function_name",
            "description": "Description of the issue",
            "impact_on_testing": "Description of how this affects testing"
        }}
    ],
    "recommendations": [
        {{
            "category": "dependency_injection",
            "description": "Consider using dependency injection for better testability",
            "priority": "high"
        }}
    ]
}}"""

SECURITY_ANALYSIS_PROMPT = """Analyze the security aspects of the following {language} code:

```{language}
{code}
```

{context}

Provide a JSON response with the following structure:
{{
    "summary": "Brief security assessment",
    "security_score": 0.8,
    "issues": [
        {{
            "type": "sql_injection|xss|hardcoded_secrets|etc",
            "severity": "critical|high|medium|low",
            "location": "line or function name",
            "description": "Description of the vulnerability",
            "recommendation": "How to fix this issue"
        }}
    ],
    "dependencies": {{
        "potentially_vulnerable": ["package@version"],
        "needs_audit": ["package1", "package2"]
    }},
    "recommendations": ["recommendation1", "recommendation2"]
}}"""

FULL_ANALYSIS_PROMPT = """Perform a comprehensive analysis of the following {language} code:

```{language}
{code}
```

{context}

Provide a complete JSON response with the following structure:
{{
    "summary": "Comprehensive summary of the code analysis",
    "structure": {{
        "classes": [],
        "functions": [],
        "imports": [],
        "exports": []
    }},
    "complexity": {{
        "cyclomatic_complexity": {{}},
        "cognitive_complexity": {{}},
        "lines_of_code": {{}},
        "maintainability_index": 0
    }},
    "dependencies": [],
    "issues": [],
    "recommendations": [],
    "testability_score": 0.0
}}"""


def get_analysis_prompt(
    analysis_type: str,
    code: str,
    language: str,
    context: str | None = None,
) -> tuple[str, str]:
    """Get the appropriate analysis prompt based on type.

    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    context_str = f"Additional context: {context}" if context else ""

    prompts = {
        "structure": STRUCTURE_ANALYSIS_PROMPT,
        "complexity": COMPLEXITY_ANALYSIS_PROMPT,
        "testability": TESTABILITY_ANALYSIS_PROMPT,
        "security": SECURITY_ANALYSIS_PROMPT,
        "full": FULL_ANALYSIS_PROMPT,
    }

    user_prompt = prompts.get(analysis_type, FULL_ANALYSIS_PROMPT).format(
        language=language,
        code=code,
        context=context_str,
    )

    return SYSTEM_PROMPT_ANALYSIS, user_prompt
