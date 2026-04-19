-- Read-only compat view bridging the new assets + asset_project_links schema
-- into the row shape that legacy projectAssets consumers expect. The existing
-- project_assets table is NOT modified; callers opt into the v2 view when they
-- migrate (gated behind ASSET_SYSTEM_V2 feature flag at the application layer).

CREATE OR REPLACE VIEW "project_assets_v2" AS
SELECT
  l."id"               AS "id",
  l."project_id"       AS "project_id",
  a."id"               AS "asset_id",
  a."user_id"          AS "user_id",
  a."filename"         AS "filename",
  a."label"            AS "label",
  a."user_description" AS "description",
  a."storage_key"      AS "storage_key",
  a."mime_type"        AS "content_type",
  a."file_size"        AS "file_size",
  a."duration_ms"      AS "duration_ms",
  a."width"            AS "width",
  a."height"           AS "height",
  a."thumbnail_key"    AS "thumbnail_key",
  a."status"           AS "status",
  l."added_at"         AS "created_at"
FROM "asset_project_links" l
JOIN "assets" a ON a."id" = l."asset_id"
WHERE a."status" = 'ready';
