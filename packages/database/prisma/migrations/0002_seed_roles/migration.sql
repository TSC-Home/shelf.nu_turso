-- Seed required Role lookup rows
INSERT OR IGNORE INTO "Role" ("id", "name", "createdAt", "updatedAt")
VALUES
  ('role_user',  'USER',  datetime('now'), datetime('now')),
  ('role_admin', 'ADMIN', datetime('now'), datetime('now'));
