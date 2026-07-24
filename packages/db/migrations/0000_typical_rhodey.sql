CREATE EXTENSION IF NOT EXISTS "citext";--> statement-breakpoint
CREATE TYPE "public"."broker_provider" AS ENUM('PAPER', 'KITE', 'UPSTOX', 'ANGEL_ONE');--> statement-breakpoint
CREATE TYPE "public"."default_product" AS ENUM('CNC', 'MIS', 'NRML');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('NOT_STARTED', 'SUBMITTED', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('SIGNUP', 'LOGIN', 'RESET_PASSWORD', 'PHONE_VERIFY');--> statement-breakpoint
CREATE TYPE "public"."session_platform" AS ENUM('WEB', 'IOS', 'ANDROID');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('DARK', 'LIGHT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."trading_mode" AS ENUM('PAPER', 'LIVE');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING_KYC', 'ACTIVE', 'SUSPENDED', 'CLOSED');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "broker_provider" NOT NULL,
	"api_key" text,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT false NOT NULL,
	"connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"identifier" text NOT NULL,
	"otp_hash" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"device_id" text NOT NULL,
	"device_name" text,
	"ip_address" text,
	"user_agent" text,
	"platform" "session_platform" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text,
	"date_of_birth" date,
	"pan" text,
	"pan_hash" text,
	"aadhaar_last4" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"pincode" text,
	"bank_account_number" text,
	"bank_ifsc" text,
	"dp_id" text,
	"demat_account_number" text,
	"kyc_status" "kyc_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"kyc_rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"trading_mode" "trading_mode" DEFAULT 'PAPER' NOT NULL,
	"theme" "theme" DEFAULT 'DARK' NOT NULL,
	"default_product" "default_product" DEFAULT 'CNC' NOT NULL,
	"order_confirmation_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"is_phone_verified" boolean DEFAULT false NOT NULL,
	"totp_secret" text,
	"is_2fa_enabled" boolean DEFAULT false NOT NULL,
	"status" "user_status" DEFAULT 'PENDING_KYC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_connections" ADD CONSTRAINT "broker_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_user_id_created_at_idx" ON "audit_log" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "broker_connections_user_provider_unique" ON "broker_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "otp_verifications_identifier_purpose_idx" ON "otp_verifications" USING btree ("identifier","purpose");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_token_hash_unique" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_id_unique" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_pan_hash_unique" ON "user_profiles" USING btree ("pan_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "user_settings_user_id_unique" ON "user_settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone");