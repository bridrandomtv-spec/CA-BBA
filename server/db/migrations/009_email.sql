CREATE TABLE IF NOT EXISTS email_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient VARCHAR(255) NOT NULL,
    kind VARCHAR(40) NOT NULL,
    event_key VARCHAR(255) UNIQUE,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_user_created ON email_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_status_created ON email_log(status, created_at DESC);
