-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stytch_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_stytch_user_id ON users(stytch_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add FK constraint to projects (existing user_id column)
ALTER TABLE projects
ADD CONSTRAINT fk_projects_user_id
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
