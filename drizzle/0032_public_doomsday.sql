DROP INDEX "agent_credential_agent_uidx";--> statement-breakpoint
ALTER TABLE "agent_credential" ADD COLUMN "label" varchar(80) DEFAULT 'Primary' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_credential_agent_label_uidx" ON "agent_credential" USING btree ("agent_id",lower("label"));