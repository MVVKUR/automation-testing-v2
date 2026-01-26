#!/bin/bash
# =============================================================================
# Database Initialization Script
# =============================================================================
# This script initializes the PostgreSQL database with required extensions
# and creates the initial schema structure.

set -e

echo "=== Initializing Automation Testing E2E Database ==="

# Use environment variables or defaults
DB_USER="${POSTGRES_USER:-ate2e}"
DB_NAME="${POSTGRES_DB:-ate2e_db}"

# Wait for PostgreSQL to be ready
until pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL to be ready..."
    sleep 2
done

echo "PostgreSQL is ready. Running initialization..."

# Connect to the database and run initialization
psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" <<-EOSQL
    -- Enable required extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";

    -- Create custom types
    DO \$\$ BEGIN
        CREATE TYPE project_status AS ENUM ('active', 'archived', 'deleted');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END \$\$;

    DO \$\$ BEGIN
        CREATE TYPE scenario_status AS ENUM ('draft', 'active', 'disabled', 'archived');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END \$\$;

    DO \$\$ BEGIN
        CREATE TYPE scenario_priority AS ENUM ('critical', 'high', 'medium', 'low');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END \$\$;

    DO \$\$ BEGIN
        CREATE TYPE test_result_status AS ENUM ('passed', 'failed', 'skipped', 'error', 'running', 'pending');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END \$\$;

    DO \$\$ BEGIN
        CREATE TYPE step_type AS ENUM (
            'navigate', 'click', 'fill', 'select', 'check', 'uncheck',
            'hover', 'scroll', 'wait', 'screenshot', 'assert', 'assertText',
            'assertVisible', 'assertHidden', 'assertValue', 'assertUrl',
            'assertTitle', 'keyboard', 'upload', 'download', 'iframe',
            'popup', 'dialog', 'api', 'script', 'custom'
        );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END \$\$;

    -- Create users table
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create teams table
    CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create team_members junction table
    CREATE TABLE IF NOT EXISTS team_members (
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (team_id, user_id)
    );

    -- Create projects table
    CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        base_url TEXT,
        settings JSONB DEFAULT '{}',
        environment_variables JSONB DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        status project_status DEFAULT 'active',
        scenario_count INTEGER DEFAULT 0,
        last_run_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create scenarios table
    CREATE TABLE IF NOT EXISTS scenarios (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        natural_language_description TEXT,
        priority scenario_priority DEFAULT 'medium',
        status scenario_status DEFAULT 'draft',
        tags TEXT[] DEFAULT '{}',
        preconditions JSONB DEFAULT '[]',
        settings JSONB DEFAULT '{}',
        data_variants JSONB DEFAULT '[]',
        generated_code TEXT,
        generated_at TIMESTAMP WITH TIME ZONE,
        execution_count INTEGER DEFAULT 0,
        pass_rate DECIMAL(5,2),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create steps table
    CREATE TABLE IF NOT EXISTS steps (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE NOT NULL,
        "order" INTEGER NOT NULL,
        type step_type NOT NULL,
        description TEXT,
        selector JSONB,
        parameters JSONB DEFAULT '{}',
        data_binding JSONB,
        conditions JSONB,
        error_handling JSONB DEFAULT '{"continueOnError": false, "retryCount": 0, "screenshotOnError": true}',
        enabled BOOLEAN DEFAULT true,
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create test_runs table
    CREATE TABLE IF NOT EXISTS test_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
        status test_result_status DEFAULT 'pending',
        duration INTEGER,
        error_message TEXT,
        screenshot_urls TEXT[],
        video_url TEXT,
        logs JSONB,
        browser VARCHAR(50),
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create step_results table
    CREATE TABLE IF NOT EXISTS step_results (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE NOT NULL,
        step_id UUID REFERENCES steps(id) ON DELETE SET NULL,
        status test_result_status NOT NULL,
        duration INTEGER,
        error_message TEXT,
        screenshot_url TEXT,
        element_snapshot JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create api_keys table
    CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(10) NOT NULL,
        scopes TEXT[] DEFAULT '{}',
        last_used_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
    CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_scenarios_project ON scenarios(project_id);
    CREATE INDEX IF NOT EXISTS idx_scenarios_status ON scenarios(status);
    CREATE INDEX IF NOT EXISTS idx_steps_scenario ON steps(scenario_id);
    CREATE INDEX IF NOT EXISTS idx_steps_order ON steps(scenario_id, "order");
    CREATE INDEX IF NOT EXISTS idx_test_runs_project ON test_runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_test_runs_scenario ON test_runs(scenario_id);
    CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
    CREATE INDEX IF NOT EXISTS idx_step_results_run ON step_results(test_run_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

    -- Full-text search indexes
    CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING gin(name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_scenarios_name_trgm ON scenarios USING gin(name gin_trgm_ops);

    -- Create updated_at trigger function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    \$\$ language 'plpgsql';

    -- Apply updated_at triggers
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
    CREATE TRIGGER update_teams_updated_at
        BEFORE UPDATE ON teams
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
    CREATE TRIGGER update_projects_updated_at
        BEFORE UPDATE ON projects
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_scenarios_updated_at ON scenarios;
    CREATE TRIGGER update_scenarios_updated_at
        BEFORE UPDATE ON scenarios
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_steps_updated_at ON steps;
    CREATE TRIGGER update_steps_updated_at
        BEFORE UPDATE ON steps
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

EOSQL

echo "=== Database initialization complete ==="
