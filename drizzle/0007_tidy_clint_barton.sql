CREATE TABLE "mcp_idempotency_record" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"tool_name" varchar(64) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"response" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_idempotency_record_request_hash_check" CHECK ("mcp_idempotency_record"."request_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "mcp_idempotency_record" ADD CONSTRAINT "mcp_idempotency_record_identity_workspace_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent_identity"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_idempotency_record_scope_key_uidx" ON "mcp_idempotency_record" USING btree ("workspace_id","agent_id","tool_name","idempotency_key");--> statement-breakpoint
CREATE INDEX "mcp_idempotency_record_expiry_idx" ON "mcp_idempotency_record" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "mcp_idempotency_record_workspace_id_idx" ON "mcp_idempotency_record" USING btree ("workspace_id");