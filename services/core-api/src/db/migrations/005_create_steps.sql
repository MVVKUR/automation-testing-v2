-- Create steps table
CREATE TABLE IF NOT EXISTS steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    target VARCHAR(500),
    value TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    timeout_ms INTEGER DEFAULT 30000,
    is_optional BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_steps_scenario_id ON steps(scenario_id);
CREATE INDEX idx_steps_order_index ON steps(order_index);
CREATE INDEX idx_steps_action_type ON steps(action_type);

CREATE TRIGGER update_steps_updated_at
    BEFORE UPDATE ON steps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
