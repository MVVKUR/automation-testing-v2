/**
 * Simple View Manager / Router for the AutoTest AI Prototype
 */
const app = {
    // Navigate between views
    navigateTo: function (viewId, params = {}) {
        // Hide all views
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

        // Show target view
        const target = document.getElementById(`view-${viewId}`);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('active');
        }

        // Handle specific logic based on view
        if (viewId === 'loading') {
            this.handleLoading(params);
        }
    },

    // Simulate async loading processes
    handleLoading: function (params) {
        const text = document.getElementById('loading-text');
        const subtext = document.getElementById('loading-subtext');

        if (params.source === 'github' || params.source === 'gitlab') {
            text.innerText = `Cloning ${params.source === 'github' ? 'GitHub' : 'GitLab'} Repository...`;
            subtext.innerText = "Fetching branches and dependency graph...";

            // Mock delay
            setTimeout(() => {
                this.navigateTo('project-details');
            }, 3000);
        } else if (params.action === 'ai_gen') {
            text.innerText = `AI Agent Working...`;
            subtext.innerText = "Analyzing project structure and generating Cypress test cases...";

            setTimeout(() => {
                this.navigateTo('test-list');
            }, 4000);
        }
    },

    // Trigger AI Generation sequence
    generateTests: function (strategy) {
        this.navigateTo('loading', { action: 'ai_gen', strategy: strategy });
    },

    // Open the Scenario Builder with a specific context
    loadScenario: function (scenarioName) {
        // Update the title in the builder
        document.querySelector('#view-scenario-builder .scenario-title').innerText = scenarioName;
        this.navigateTo('scenario-builder');
    }
};

// Initialize event listeners for the Scenario Builder specific UI
document.addEventListener('DOMContentLoaded', () => {

    // -- Scenario Builder Specific Logic (Preserved from original) --

    // Handle Step Selection
    const steps = document.querySelectorAll('.step-item.sub-step');
    steps.forEach(step => {
        step.addEventListener('click', () => {
            steps.forEach(s => s.classList.remove('active'));
            step.classList.add('active');
        });
    });

    // Handle Tab Switching
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const parent = tab.closest('.tabs');
            parent.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    // Simple interaction for chips
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chip.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-active');
            setTimeout(() => {
                chip.style.backgroundColor = '';
            }, 200);
        });
    });
});
