ALTER TABLE "epic" ADD COLUMN "number" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "next_epic_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Preserve IDs, titles, timestamps and ticket associations while assigning
-- deterministic, project-local numbers to existing Epics.
WITH numbered AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "project_id" ORDER BY "created_at", "id"
  )::integer AS "number"
  FROM "epic"
)
UPDATE "epic" SET "number" = numbered."number"
FROM numbered WHERE "epic"."id" = numbered."id";--> statement-breakpoint
UPDATE "project" SET "next_epic_number" = numbers."next_number"
FROM (
  SELECT "project_id", max("number") + 1 AS "next_number"
  FROM "epic" GROUP BY "project_id"
) AS numbers WHERE "project"."id" = numbers."project_id";--> statement-breakpoint
ALTER TABLE "epic" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "epic_project_number_uidx" ON "epic" USING btree ("project_id","number");--> statement-breakpoint
ALTER TABLE "epic" ADD CONSTRAINT "epic_number_check" CHECK ("epic"."number" > 0);--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_next_epic_number_check" CHECK ("project"."next_epic_number" > 0);
