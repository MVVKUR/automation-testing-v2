-- Create test_cases table
CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    tags TEXT[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX idx_test_cases_status ON test_cases(status);
CREATE INDEX idx_test_cases_priority ON test_cases(priority);
CREATE INDEX idx_test_cases_created_by ON test_cases(created_by);

CREATE TRIGGER update_test_cases_updated_at
    BEFORE UPDATE ON test_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
