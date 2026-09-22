-- iMali Circle database schema
-- Run this once against your PostgreSQL database (Railway or otherwise) before starting the API.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(150) NOT NULL,
    phone           VARCHAR(20) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    language        VARCHAR(5) NOT NULL DEFAULT 'en',
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    biometric_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stokvels (
    stokvel_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(150) NOT NULL,
    contribution_amount NUMERIC(12,2) NOT NULL,
    frequency           VARCHAR(20) NOT NULL CHECK (frequency IN ('weekly','fortnightly','monthly')),
    created_by          UUID NOT NULL REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    stokvel_id    UUID NOT NULL REFERENCES stokvels(stokvel_id) ON DELETE CASCADE,
    role          VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin','treasurer','member')),
    payout_order  INTEGER,
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, stokvel_id)
);

CREATE TABLE IF NOT EXISTS contributions (
    contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id       UUID NOT NULL REFERENCES stokvels(stokvel_id) ON DELETE CASCADE,
    membership_id    UUID NOT NULL REFERENCES memberships(membership_id) ON DELETE CASCADE,
    amount           NUMERIC(12,2) NOT NULL,
    contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    captured_by       UUID NOT NULL REFERENCES users(user_id), -- supports "capture on behalf"
    client_ref         VARCHAR(100), -- id generated on-device, used to dedupe offline sync
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (client_ref)
);

CREATE TABLE IF NOT EXISTS payouts (
    payout_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id    UUID NOT NULL REFERENCES stokvels(stokvel_id) ON DELETE CASCADE,
    recipient_id  UUID NOT NULL REFERENCES users(user_id),
    amount        NUMERIC(12,2) NOT NULL,
    payout_date   DATE,
    paid          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_log (
    notif_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type       VARCHAR(30) NOT NULL,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
