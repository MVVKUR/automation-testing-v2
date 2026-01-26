-- Create executions table
CREATE TABLE IF NOT EXISTS executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    environment VARCHAR(100),
    browser VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create execution_results table for step-level results
CREATE TABLE IF NOT EXISTS execution_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    error_message TEXT,
    screenshot_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_executions_test_case_id ON executions(test_case_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_triggered_by ON executions(triggered_by);
CREATE INDEX idx_executions_started_at ON executions(started_at);

CREATE INDEX idx_execution_results_execution_id ON execution_results(execution_id);
CREATE INDEX idx_execution_results_step_id ON execution_results(step_id);
CREATE INDEX idx_execution_results_status ON execution_results(status);

CREATE TRIGGER update_executions_updated_at
    BEFORE UPDATE ON executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
