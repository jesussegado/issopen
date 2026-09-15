CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"version" text DEFAULT gen_random_uuid()::text NOT NULL,
	"avatar_png" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_avatar_size_check" CHECK ("user_profile"."avatar_png" IS NULL OR length("user_profile"."avatar_png") <= 131094)
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;