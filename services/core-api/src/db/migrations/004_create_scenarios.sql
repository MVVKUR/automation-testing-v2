-- Create scenarios table
CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scenarios_test_case_id ON scenarios(test_case_id);
CREATE INDEX idx_scenarios_order_index ON scenarios(order_index);
CREATE INDEX idx_scenarios_is_active ON scenarios(is_active);

CREATE TRIGGER update_scenarios_updated_at
    BEFORE UPDATE ON scenarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
