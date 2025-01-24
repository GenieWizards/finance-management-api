CREATE TABLE "settlement" (
	"id" varchar(60) PRIMARY KEY NOT NULL,
	"sender_id" varchar(60) NOT NULL,
	"receiver_id" varchar(60) NOT NULL,
	"group_id" varchar(60),
	"amount" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "split" DROP COLUMN "is_settled";