-- Add agent_url column to sandbox_sessions
ALTER TABLE "sandbox_sessions" ADD COLUMN IF NOT EXISTS "agent_url" varchar(512);

-- Add suspend_reason column to sandbox_sessions
ALTER TABLE "sandbox_sessions" ADD COLUMN IF NOT EXISTS "suspend_reason" varchar(50);

-- Remove sandbox_port column from sandbox_sessions
ALTER TABLE "sandbox_sessions" DROP COLUMN IF EXISTS "sandbox_port";
