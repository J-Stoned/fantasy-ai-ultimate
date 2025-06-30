-- Cron job logs table
CREATE TABLE IF NOT EXISTS cron_job_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('success', 'error')),
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  payload JSONB,
  source_ip TEXT,
  headers JSONB,
  received_at TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cron_logs_job_name ON cron_job_logs(job_name, executed_at DESC);
CREATE INDEX idx_cron_logs_status ON cron_job_logs(status, executed_at DESC);
CREATE INDEX idx_webhook_logs_type ON webhook_logs(type, received_at DESC);
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed, received_at DESC);

-- Cleanup old logs automatically (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM cron_job_logs 
  WHERE executed_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM webhook_logs 
  WHERE received_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;