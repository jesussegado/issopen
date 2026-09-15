ALTER TABLE "membership_event" ADD COLUMN "actor_name" varchar(120);--> statement-breakpoint
ALTER TABLE "membership_event" ADD COLUMN "subject_name" varchar(120);--> statement-breakpoint
ALTER TABLE "workspace_invitation_event" ADD COLUMN "actor_name" varchar(120);--> statement-breakpoint
ALTER TABLE "workspace_invitation_event" ADD COLUMN "subject_user_id" text;--> statement-breakpoint
ALTER TABLE "workspace_invitation_event" ADD COLUMN "subject_name" varchar(120);--> statement-breakpoint
ALTER TABLE "workspace_invitation_event" ADD CONSTRAINT "workspace_invitation_event_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- Snapshot only new events; a current name is not a historical name for old rows.
CREATE FUNCTION issopen_membership_attribution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT left(name,120) INTO NEW.actor_name FROM "user" WHERE id=NEW.actor_user_id;
  SELECT left(name,120) INTO NEW.subject_name FROM "user" WHERE id=NEW.subject_user_id;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER membership_attribution BEFORE INSERT ON membership_event FOR EACH ROW EXECUTE FUNCTION issopen_membership_attribution();--> statement-breakpoint
CREATE FUNCTION issopen_invitation_attribution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT left(name,120) INTO NEW.actor_name FROM "user" WHERE id=NEW.actor_user_id;
  SELECT claimed_by_user_id INTO NEW.subject_user_id FROM workspace_invitation WHERE id=NEW.invitation_id AND workspace_id=NEW.workspace_id;
  SELECT left(name,120) INTO NEW.subject_name FROM "user" WHERE id=NEW.subject_user_id;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER invitation_attribution BEFORE INSERT ON workspace_invitation_event FOR EACH ROW EXECUTE FUNCTION issopen_invitation_attribution();--> statement-breakpoint
CREATE TRIGGER ownership_event_append_only BEFORE UPDATE OR DELETE ON ownership_event FOR EACH ROW EXECUTE FUNCTION reject_membership_audit_mutation();
