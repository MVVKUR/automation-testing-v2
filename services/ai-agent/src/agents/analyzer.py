"""Code analysis agent using tree-sitter and Claude."""

import json
import logging
import re
from typing import Any, Optional

from anthropic import AsyncAnthropic

from src.api.schemas import AnalysisResult, AnalysisType
from src.prompts.analysis import get_analysis_prompt

logger = logging.getLogger(__name__)

# Cache for loaded parsers
_parser_cache: dict[str, Any] = {}


class CodeAnalyzer:
    """Agent for analyzing source code using Claude AI and tree-sitter."""

    # Supported languages and their tree-sitter package names
    SUPPORTED_LANGUAGES = {
        "python": "tree_sitter_python",
        "javascript": "tree_sitter_javascript",
        "typescript": "tree_sitter_typescript",
        "java": "tree_sitter_java",
        "go": "tree_sitter_go",
        "rust": "tree_sitter_rust",
        "c": "tree_sitter_c",
        "cpp": "tree_sitter_cpp",
        "ruby": "tree_sitter_ruby",
    }

    def __init__(
        self,
        api_key: str,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096,
    ):
        """Initialize the code analyzer.

        Args:
            api_key: Anthropic API key
            model: Claude model to use
            max_tokens: Maximum tokens in response
        """
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model
        self.max_tokens = max_tokens

    async def analyze(
        self,
        code: str,
        language: str,
        analysis_type: AnalysisType = AnalysisType.FULL,
        context: Optional[str] = None,
    ) -> AnalysisResult:
        """Analyze source code.

        Args:
            code: Source code to analyze
            language: Programming language
            analysis_type: Type of analysis to perform
            context: Additional context for analysis

        Returns:
            AnalysisResult with analysis findings
        """
        logger.info(f"Starting {analysis_type} analysis for {language} code")

        # Get static analysis first using tree-sitter if available
        static_analysis = await self._static_analyze(code, language)

        # Get AI-powered analysis
        system_prompt, user_prompt = get_analysis_prompt(
            analysis_type=analysis_type.value,
            code=code,
            language=language,
            context=context,
        )

        # Include static analysis results in context if available
        if static_analysis:
            user_prompt += f"\n\nStatic analysis results:\n{json.dumps(static_analysis, indent=2)}"

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            # Extract and parse the response
            response_text = response.content[0].text
            result_data = self._parse_response(response_text)

            return AnalysisResult(
                summary=result_data.get("summary", "Analysis complete"),
                structure=result_data.get("structure"),
                complexity=result_data.get("complexity"),
                dependencies=result_data.get("dependencies"),
                issues=result_data.get("issues"),
                recommendations=result_data.get("recommendations", []),
                testability_score=result_data.get("testability_score"),
            )

        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            raise

    async def _static_analyze(
        self,
        code: str,
        language: str,
    ) -> Optional[dict[str, Any]]:
        """Perform static analysis using tree-sitter.

        Args:
            code: Source code to analyze
            language: Programming language

        Returns:
            Dictionary with static analysis results or None
        """
        try:
            # Try to use tree-sitter for parsing
            parser = self._get_parser(language)
            if parser is None:
                return None

            tree = parser.parse(bytes(code, "utf8"))
            root_node = tree.root_node

            return {
                "syntax_valid": not root_node.has_error,
                "node_count": self._count_nodes(root_node),
                "structure": self._extract_structure(root_node, language),
            }

        except Exception as e:
            logger.warning(f"Static analysis failed: {e}")
            return None

    def _get_parser(self, language: str) -> Any:
        """Get tree-sitter parser for the language.

        Args:
            language: Programming language

        Returns:
            Parser instance or None if language not supported
        """
        global _parser_cache

        lang_key = language.lower()

        # Return cached parser if available
        if lang_key in _parser_cache:
            return _parser_cache[lang_key]

        try:
            import tree_sitter

            # Get the language module name
            lang_module_name = self.SUPPORTED_LANGUAGES.get(lang_key)
            if not lang_module_name:
                logger.warning(f"Language {language} not supported")
                return None

            # Try to import the language-specific module
            try:
                # Try tree-sitter-language-pack first (newer approach)
                from tree_sitter_language_pack import get_language

                lang = get_language(lang_key)
                parser = tree_sitter.Parser(lang)
                _parser_cache[lang_key] = parser
                logger.info(f"Loaded {lang_key} parser from language pack")
                return parser

            except ImportError:
                # Fall back to individual language packages
                try:
                    lang_module = __import__(lang_module_name)
                    lang = lang_module.language()
                    parser = tree_sitter.Parser(lang)
                    _parser_cache[lang_key] = parser
                    logger.info(f"Loaded {lang_key} parser from {lang_module_name}")
                    return parser

                except ImportError:
                    logger.warning(
                        f"tree-sitter language package for {language} not installed. "
                        f"Install with: pip install {lang_module_name.replace('_', '-')}"
                    )
                    return None

        except ImportError:
            logger.warning("tree-sitter not available, skipping static analysis")
            return None
        except Exception as e:
            logger.warning(f"Failed to get parser for {language}: {e}")
            return None

    def _count_nodes(self, node: Any) -> int:
        """Count total nodes in the syntax tree.

        Args:
            node: Tree-sitter node

        Returns:
            Total node count
        """
        count = 1
        for child in node.children:
            count += self._count_nodes(child)
        return count

    def _extract_structure(self, node: Any, language: str) -> dict[str, Any]:
        """Extract code structure from syntax tree.

        Args:
            node: Tree-sitter root node
            language: Programming language

        Returns:
            Dictionary with extracted structure
        """
        structure = {
            "functions": [],
            "classes": [],
            "imports": [],
        }

        # Node types vary by language
        function_types = {
            "python": ["function_definition"],
            "javascript": ["function_declaration", "arrow_function"],
            "typescript": ["function_declaration", "arrow_function"],
        }

        class_types = {
            "python": ["class_definition"],
            "javascript": ["class_declaration"],
            "typescript": ["class_declaration"],
        }

        import_types = {
            "python": ["import_statement", "import_from_statement"],
            "javascript": ["import_statement"],
            "typescript": ["import_statement"],
        }

        lang = language.lower()
        self._traverse_tree(
            node,
            structure,
            function_types.get(lang, []),
            class_types.get(lang, []),
            import_types.get(lang, []),
        )

        return structure

    def _traverse_tree(
        self,
        node: Any,
        structure: dict[str, list],
        function_types: list[str],
        class_types: list[str],
        import_types: list[str],
    ) -> None:
        """Recursively traverse syntax tree and extract structure.

        Args:
            node: Current tree-sitter node
            structure: Structure dictionary to populate
            function_types: Node types for functions
            class_types: Node types for classes
            import_types: Node types for imports
        """
        node_type = node.type

        if node_type in function_types:
            structure["functions"].append({
                "type": node_type,
                "start_line": node.start_point[0] + 1,
                "end_line": node.end_point[0] + 1,
            })
        elif node_type in class_types:
            structure["classes"].append({
                "type": node_type,
                "start_line": node.start_point[0] + 1,
                "end_line": node.end_point[0] + 1,
            })
        elif node_type in import_types:
            structure["imports"].append({
                "type": node_type,
                "start_line": node.start_point[0] + 1,
            })

        for child in node.children:
            self._traverse_tree(
                child, structure, function_types, class_types, import_types
            )

    def _extract_function_names(self, node: Any, language: str, code_bytes: bytes) -> list[dict]:
        """Extract function names and signatures from the AST.

        Args:
            node: Tree-sitter root node
            language: Programming language
            code_bytes: Source code as bytes

        Returns:
            List of function information dictionaries
        """
        functions = []

        # Node types for functions by language
        function_types = {
            "python": ["function_definition", "async_function_definition"],
            "javascript": ["function_declaration", "arrow_function", "method_definition"],
            "typescript": ["function_declaration", "arrow_function", "method_definition"],
            "java": ["method_declaration"],
            "go": ["function_declaration", "method_declaration"],
            "rust": ["function_item"],
        }

        target_types = function_types.get(language.lower(), [])

        def traverse(n: Any) -> None:
            if n.type in target_types:
                # Try to get function name
                name = None
                for child in n.children:
                    if child.type in ["identifier", "name", "property_identifier"]:
                        name = code_bytes[child.start_byte : child.end_byte].decode("utf8")
                        break

                functions.append(
                    {
                        "name": name or "anonymous",
                        "type": n.type,
                        "start_line": n.start_point[0] + 1,
                        "end_line": n.end_point[0] + 1,
                        "lines": n.end_point[0] - n.start_point[0] + 1,
                    }
                )

            for child in n.children:
                traverse(child)

        traverse(node)
        return functions

    def _calculate_complexity(self, node: Any, language: str) -> dict[str, Any]:
        """Calculate code complexity metrics from the AST.

        Args:
            node: Tree-sitter root node
            language: Programming language

        Returns:
            Complexity metrics dictionary
        """
        # Nodes that contribute to cyclomatic complexity
        branching_nodes = {
            "python": ["if_statement", "elif_clause", "for_statement", "while_statement",
                       "try_statement", "except_clause", "with_statement", "match_statement"],
            "javascript": ["if_statement", "for_statement", "while_statement", "do_statement",
                           "switch_statement", "try_statement", "catch_clause", "ternary_expression"],
            "typescript": ["if_statement", "for_statement", "while_statement", "do_statement",
                           "switch_statement", "try_statement", "catch_clause", "ternary_expression"],
        }

        target_nodes = branching_nodes.get(language.lower(), [])
        complexity = {"cyclomatic": 1, "branches": 0, "nesting_depth": 0}

        def traverse(n: Any, depth: int = 0) -> None:
            if n.type in target_nodes:
                complexity["cyclomatic"] += 1
                complexity["branches"] += 1

            # Track nesting depth
            if n.type in ["if_statement", "for_statement", "while_statement", "function_definition"]:
                complexity["nesting_depth"] = max(complexity["nesting_depth"], depth)
                depth += 1

            for child in n.children:
                traverse(child, depth)

        traverse(node)
        return complexity

    async def analyze_testability(
        self,
        code: str,
        language: str,
    ) -> dict[str, Any]:
        """Analyze code specifically for testability.

        Args:
            code: Source code to analyze
            language: Programming language

        Returns:
            Testability analysis results
        """
        logger.info(f"Analyzing testability for {language} code")

        prompt = f"""Analyze the following {language} code for testability:

```{language}
{code}
```

Evaluate:
1. Function purity (side effects, external dependencies)
2. Dependency injection patterns
3. Modularity and coupling
4. Mock-ability of dependencies
5. Test data requirements
6. Edge cases to consider

Respond with JSON:
{{
    "testability_score": 0.85,
    "factors": {{
        "purity": {{"score": 0.9, "issues": []}},
        "coupling": {{"score": 0.8, "issues": ["tight coupling to database"]}},
        "modularity": {{"score": 0.85, "issues": []}},
        "mockability": {{"score": 0.7, "issues": ["hard to mock external API"]}}
    }},
    "test_recommendations": [
        {{
            "type": "unit",
            "target": "function_name",
            "approach": "How to test this",
            "mocks_needed": ["dependency1", "dependency2"]
        }}
    ],
    "edge_cases": ["empty input", "null values", "concurrent access"],
    "improvement_suggestions": ["Suggestion for improving testability"]
}}"""

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system="You are an expert in software testing and code quality analysis.",
                messages=[{"role": "user", "content": prompt}],
            )

            return self._parse_response(response.content[0].text)

        except Exception as e:
            logger.error(f"Testability analysis failed: {e}")
            raise

    def _parse_response(self, response_text: str) -> dict[str, Any]:
        """Parse the Claude response to extract JSON.

        Args:
            response_text: Raw response text from Claude

        Returns:
            Parsed dictionary from JSON response
        """
        # Try to extract JSON from the response
        try:
            # First, try direct JSON parsing
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

        # Return a basic structure if parsing fails
        logger.warning("Failed to parse JSON from response, returning basic structure")
        return {
            "summary": response_text[:500] if len(response_text) > 500 else response_text,
            "recommendations": [],
        }
