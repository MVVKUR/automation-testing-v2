"""
Test Runner Service - Executes Cypress and Playwright tests
"""
import asyncio
import subprocess
import json
import os
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any, List
from enum import Enum


class TestFramework(str, Enum):
    CYPRESS = "cypress"
    PLAYWRIGHT = "playwright"


class TestRunner:
    """Service to run Cypress and Playwright tests"""

    def __init__(self):
        self.processes: Dict[str, subprocess.Popen] = {}

    async def run_cypress(
        self,
        spec_content: str,
        base_url: str,
        browser: str = "chrome",
        headless: bool = True,
        timeout: int = 60000
    ) -> Dict[str, Any]:
        """
        Run a Cypress test from spec content

        Args:
            spec_content: The Cypress test spec content (JavaScript)
            base_url: The base URL for the test
            browser: Browser to use (chrome, firefox, electron)
            headless: Run in headless mode
            timeout: Test timeout in ms
        """
        # Create temp directory for the test
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # Create minimal cypress structure
            cypress_dir = temp_path / "cypress"
            cypress_dir.mkdir()
            (cypress_dir / "e2e").mkdir()
            (cypress_dir / "support").mkdir()

            # Write spec file
            spec_file = cypress_dir / "e2e" / "test.cy.js"
            spec_file.write_text(spec_content)

            # Write support file
            support_file = cypress_dir / "support" / "e2e.js"
            support_file.write_text("// Cypress support file\n")

            # Write cypress config
            config = {
                "e2e": {
                    "baseUrl": base_url,
                    "supportFile": "cypress/support/e2e.js",
                    "specPattern": "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
                    "video": False,
                    "screenshotOnRunFailure": True,
                    "defaultCommandTimeout": timeout
                }
            }
            config_file = temp_path / "cypress.config.js"
            config_file.write_text(f"module.exports = {json.dumps(config, indent=2)}")

            # Build command
            cmd = [
                "npx", "cypress", "run",
                "--browser", browser,
                "--spec", str(spec_file)
            ]
            if headless:
                cmd.append("--headless")

            # Run cypress
            result = await self._run_process(cmd, temp_path, timeout // 1000 + 30)

            return result

    async def run_playwright(
        self,
        spec_content: str,
        base_url: str,
        browser: str = "chromium",
        headless: bool = True,
        timeout: int = 60000
    ) -> Dict[str, Any]:
        """
        Run a Playwright test from spec content

        Args:
            spec_content: The Playwright test spec content (JavaScript/TypeScript)
            base_url: The base URL for the test
            browser: Browser to use (chromium, firefox, webkit)
            headless: Run in headless mode
            timeout: Test timeout in ms
        """
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # Write spec file
            spec_file = temp_path / "test.spec.js"
            spec_file.write_text(spec_content)

            # Write playwright config
            config_content = f"""
const {{ defineConfig }} = require('@playwright/test');

module.exports = defineConfig({{
  testDir: '.',
  timeout: {timeout},
  use: {{
    baseURL: '{base_url}',
    headless: {str(headless).lower()},
    browserName: '{browser}',
  }},
}});
"""
            config_file = temp_path / "playwright.config.js"
            config_file.write_text(config_content)

            # Build command
            cmd = ["npx", "playwright", "test", str(spec_file)]

            # Run playwright
            result = await self._run_process(cmd, temp_path, timeout // 1000 + 30)

            return result

    async def run_steps_as_cypress(
        self,
        steps: List[Dict[str, Any]],
        base_url: str,
        browser: str = "chrome",
        headless: bool = True
    ) -> Dict[str, Any]:
        """
        Convert test steps to Cypress spec and run

        Args:
            steps: List of test steps with type, selector, value, etc.
            base_url: The base URL for the test
            browser: Browser to use
            headless: Run in headless mode
        """
        spec_content = self._steps_to_cypress(steps, base_url)
        return await self.run_cypress(spec_content, base_url, browser, headless)

    async def run_steps_as_playwright(
        self,
        steps: List[Dict[str, Any]],
        base_url: str,
        browser: str = "chromium",
        headless: bool = True
    ) -> Dict[str, Any]:
        """
        Convert test steps to Playwright spec and run
        """
        spec_content = self._steps_to_playwright(steps, base_url)
        return await self.run_playwright(spec_content, base_url, browser, headless)

    def _steps_to_cypress(self, steps: List[Dict[str, Any]], base_url: str) -> str:
        """Convert test steps to Cypress spec content"""
        lines = [
            "describe('Test', () => {",
            "  it('runs the test steps', () => {"
        ]

        for step in steps:
            step_type = step.get("type", "")
            selector = step.get("selector", "")
            value = step.get("value", "")

            if step_type == "navigate":
                url = step.get("url", base_url)
                lines.append(f"    cy.visit('{url}');")
            elif step_type == "click":
                lines.append(f"    cy.get('{selector}').click();")
            elif step_type == "type":
                lines.append(f"    cy.get('{selector}').type('{value}');")
            elif step_type == "verify":
                lines.append(f"    cy.get('{selector}').should('exist');")
            elif step_type == "wait":
                wait_time = step.get("duration", 1000)
                lines.append(f"    cy.wait({wait_time});")

        lines.extend([
            "  });",
            "});"
        ])

        return "\n".join(lines)

    def _steps_to_playwright(self, steps: List[Dict[str, Any]], base_url: str) -> str:
        """Convert test steps to Playwright spec content"""
        lines = [
            "const { test, expect } = require('@playwright/test');",
            "",
            "test('runs the test steps', async ({ page }) => {"
        ]

        for step in steps:
            step_type = step.get("type", "")
            selector = step.get("selector", "")
            value = step.get("value", "")

            if step_type == "navigate":
                url = step.get("url", base_url)
                lines.append(f"  await page.goto('{url}');")
            elif step_type == "click":
                lines.append(f"  await page.click('{selector}');")
            elif step_type == "type":
                lines.append(f"  await page.fill('{selector}', '{value}');")
            elif step_type == "verify":
                lines.append(f"  await expect(page.locator('{selector}')).toBeVisible();")
            elif step_type == "wait":
                wait_time = step.get("duration", 1000)
                lines.append(f"  await page.waitForTimeout({wait_time});")

        lines.append("});")

        return "\n".join(lines)

    async def _run_process(
        self,
        cmd: List[str],
        cwd: Path,
        timeout: int
    ) -> Dict[str, Any]:
        """Run a subprocess and capture output"""
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(cwd),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, "CI": "true"}
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                return {
                    "success": False,
                    "error": "Test timed out",
                    "stdout": "",
                    "stderr": "",
                    "exit_code": -1
                }

            return {
                "success": process.returncode == 0,
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
                "exit_code": process.returncode,
                "error": None if process.returncode == 0 else "Test failed"
            }

        except FileNotFoundError:
            return {
                "success": False,
                "error": "npx not found. Make sure Node.js is installed.",
                "stdout": "",
                "stderr": "",
                "exit_code": -1
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "stdout": "",
                "stderr": "",
                "exit_code": -1
            }


# Singleton instance
test_runner = TestRunner()
