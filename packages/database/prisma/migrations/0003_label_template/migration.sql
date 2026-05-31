-- Add configurable label branding text, custom text, and template selection
ALTER TABLE "Organization" ADD COLUMN "labelBrandingText" TEXT;
ALTER TABLE "Organization" ADD COLUMN "labelCustomText" TEXT;
ALTER TABLE "Organization" ADD COLUMN "labelTemplate" TEXT NOT NULL DEFAULT 'SQUARE';
