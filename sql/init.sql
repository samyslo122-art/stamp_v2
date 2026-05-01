-- School Event Passport — Database Schema
-- All DDL uses CREATE TABLE IF NOT EXISTS

CREATE SEQUENCE IF NOT EXISTS player_number_seq START 1 MAXVALUE 9999;

CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    group_code VARCHAR(20) UNIQUE NOT NULL,
    quota INTEGER NOT NULL DEFAULT 0,
    checked_in BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    player_number INTEGER NOT NULL UNIQUE,
    unique_id VARCHAR(6) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    group_id INTEGER NOT NULL REFERENCES groups(id),
    current_round INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stamps (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    booth_name VARCHAR(50) NOT NULL,
    booth_category VARCHAR(5) NOT NULL,
    stamp_value INTEGER NOT NULL DEFAULT 1,
    round_number INTEGER NOT NULL DEFAULT 1,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, booth_name, round_number)
);

CREATE TABLE IF NOT EXISTS redemptions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    tier_claimed VARCHAR(20) NOT NULL,
    gift_name VARCHAR(100) NOT NULL,
    round_number INTEGER NOT NULL DEFAULT 1,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, tier_claimed, round_number)
);

CREATE TABLE IF NOT EXISTS gift_inventory (
    id SERIAL PRIMARY KEY,
    tier VARCHAR(20) NOT NULL,
    gift_name VARCHAR(100) NOT NULL,
    total_qty INTEGER NOT NULL DEFAULT 0,
    remaining_qty INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tier, gift_name)
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    category_key VARCHAR(5) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS booths (
    id SERIAL PRIMARY KEY,
    booth_key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    category VARCHAR(5) NOT NULL REFERENCES categories(category_key),
    stamp_value INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS redemption_tiers (
    id SERIAL PRIMARY KEY,
    tier_key VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    required_stamps INTEGER NOT NULL,
    min_categories INTEGER NOT NULL,
    require_all_categories BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS security_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_players_unique_id ON players(unique_id);
CREATE INDEX IF NOT EXISTS idx_players_group_id ON players(group_id);
CREATE INDEX IF NOT EXISTS idx_stamps_player_round ON stamps(player_id, round_number);
CREATE INDEX IF NOT EXISTS idx_redemptions_player_round ON redemptions(player_id, round_number);
CREATE INDEX IF NOT EXISTS idx_groups_group_code ON groups(group_code);

-- Stored procedure: get_player_round_summary
CREATE OR REPLACE FUNCTION get_player_round_summary(p_unique_id VARCHAR)
RETURNS TABLE (
    player_id INTEGER,
    player_name VARCHAR,
    unique_id VARCHAR,
    current_round INTEGER,
    stamp_total BIGINT,
    categories_collected TEXT[],
    category_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS player_id,
        p.name AS player_name,
        p.unique_id,
        p.current_round,
        COALESCE(SUM(s.stamp_value), 0)::BIGINT AS stamp_total,
        ARRAY_AGG(DISTINCT s.booth_category) FILTER (WHERE s.booth_category IS NOT NULL) AS categories_collected,
        COUNT(DISTINCT s.booth_category) AS category_count
    FROM players p
    LEFT JOIN stamps s ON s.player_id = p.id AND s.round_number = p.current_round
    WHERE p.unique_id = p_unique_id
    GROUP BY p.id, p.name, p.unique_id, p.current_round;
END;
$$ LANGUAGE plpgsql;

-- Stored procedure: claim_redemption_atomic
CREATE OR REPLACE FUNCTION claim_redemption_atomic(
    p_player_id INTEGER,
    p_tier VARCHAR,
    p_gift_name VARCHAR,
    p_round INTEGER
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_remaining INTEGER;
    v_existing INTEGER;
BEGIN
    -- Check if already redeemed this tier this round
    SELECT COUNT(*) INTO v_existing
    FROM redemptions
    WHERE player_id = p_player_id AND tier_claimed = p_tier AND round_number = p_round;

    IF v_existing > 0 THEN
        RETURN QUERY SELECT FALSE, 'Already redeemed this tier in this round'::TEXT;
        RETURN;
    END IF;

    -- Lock and check inventory
    SELECT remaining_qty INTO v_remaining
    FROM gift_inventory
    WHERE tier = p_tier AND gift_name = p_gift_name
    FOR UPDATE;

    IF v_remaining IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Gift not found in inventory'::TEXT;
        RETURN;
    END IF;

    IF v_remaining <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Gift out of stock'::TEXT;
        RETURN;
    END IF;

    -- Decrement inventory
    UPDATE gift_inventory
    SET remaining_qty = remaining_qty - 1
    WHERE tier = p_tier AND gift_name = p_gift_name;

    -- Insert redemption
    INSERT INTO redemptions (player_id, tier_claimed, gift_name, round_number)
    VALUES (p_player_id, p_tier, p_gift_name, p_round);

    RETURN QUERY SELECT TRUE, 'Redemption successful'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Stored procedure: reset_player_round
CREATE OR REPLACE FUNCTION reset_player_round(p_player_id INTEGER, p_max_rounds INTEGER)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_round INTEGER
) AS $$
DECLARE
    v_current_round INTEGER;
BEGIN
    SELECT current_round INTO v_current_round
    FROM players WHERE id = p_player_id FOR UPDATE;

    IF v_current_round IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Player not found'::TEXT, 0;
        RETURN;
    END IF;

    IF v_current_round >= p_max_rounds THEN
        RETURN QUERY SELECT FALSE, 'Maximum rounds reached'::TEXT, v_current_round;
        RETURN;
    END IF;

    UPDATE players SET current_round = current_round + 1 WHERE id = p_player_id;

    RETURN QUERY SELECT TRUE, 'Round advanced'::TEXT, v_current_round + 1;
END;
$$ LANGUAGE plpgsql;
