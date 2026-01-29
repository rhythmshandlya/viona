-- Add llm_model column to visuals table for tracking which model was used
ALTER TABLE visuals ADD COLUMN llm_model VARCHAR(100);
