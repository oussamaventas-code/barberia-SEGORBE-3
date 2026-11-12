CREATE TABLE "appointment_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"actor_role" text NOT NULL,
	"actor_label" text NOT NULL,
	"previous_status" text,
	"new_status" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"service_name_snapshot" text NOT NULL,
	"price_cents_snapshot" integer,
	"duration_minutes_snapshot" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_code" text NOT NULL,
	"access_token" text NOT NULL,
	"idempotency_key" text,
	"customer_id" integer NOT NULL,
	"staff_id" integer NOT NULL,
	"start_at_utc" timestamp with time zone NOT NULL,
	"end_at_utc" timestamp with time zone NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'CONFIRMED' NOT NULL,
	"total_price_cents" integer,
	"total_duration_minutes" integer NOT NULL,
	"source" text DEFAULT 'WEB' NOT NULL,
	"customer_notes" text,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_booking_code_unique" UNIQUE("booking_code"),
	CONSTRAINT "appointments_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "appointments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_uid" text,
	"actor_email" text,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer,
	"start_at_utc" timestamp with time zone NOT NULL,
	"end_at_utc" timestamp with time zone NOT NULL,
	"block_type" text DEFAULT 'BLOCKED' NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_name" text DEFAULT 'Club Segorbe' NOT NULL,
	"city" text DEFAULT 'Murcia' NOT NULL,
	"address" text,
	"phone" text,
	"email" text,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"min_lead_minutes" integer DEFAULT 60 NOT NULL,
	"max_advance_days" integer DEFAULT 30 NOT NULL,
	"cancel_cutoff_hours" integer DEFAULT 24 NOT NULL,
	"reschedule_cutoff_hours" integer DEFAULT 12 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"default_return_cadence_days" integer DEFAULT 28 NOT NULL,
	"reminder_hours_before" integer DEFAULT 24 NOT NULL,
	"waitlist_auto_offer" boolean DEFAULT false NOT NULL,
	"email_provider" text DEFAULT 'PENDING' NOT NULL,
	"sms_provider" text DEFAULT 'PENDING' NOT NULL,
	"whatsapp_provider" text DEFAULT 'PENDING' NOT NULL,
	"legal_entity_name" text,
	"legal_tax_id" text,
	"cancellation_policy_text" text,
	"is_setup_complete" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"privacy_policy_accepted" boolean DEFAULT false NOT NULL,
	"privacy_policy_accepted_at" timestamp with time zone,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"marketing_opt_in_at" timestamp with time zone,
	"preferred_channel" text DEFAULT 'NONE' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communication_consents_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "customer_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"author_uid" text NOT NULL,
	"author_name" text NOT NULL,
	"note_type" text DEFAULT 'NOTE' NOT NULL,
	"content" text NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_code" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"profile_uid" text,
	"preferred_staff_id" integer,
	"preferences" text,
	"relationship_status" text DEFAULT 'NEW' NOT NULL,
	"visit_cadence_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_public_code_unique" UNIQUE("public_code")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"channel" text DEFAULT 'INTERNAL' NOT NULL,
	"recipient" text NOT NULL,
	"customer_id" integer,
	"appointment_id" integer,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'PENDING_PROVIDER' NOT NULL,
	"provider" text DEFAULT 'NONE' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"method" text DEFAULT 'CASH' NOT NULL,
	"status" text DEFAULT 'PAID' NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"password_hash" text,
	"role" text DEFAULT 'CUSTOMER' NOT NULL,
	"staff_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price_cents" integer,
	"duration_minutes" integer,
	"image_url" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_configured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role_title" text DEFAULT 'Barbero' NOT NULL,
	"bio" text,
	"specialties" text,
	"photo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer,
	"date" text NOT NULL,
	"type" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"custom_duration_minutes" integer,
	"custom_price_cents" integer
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"staff_id" integer,
	"preferred_date" text NOT NULL,
	"time_window_start" text,
	"time_window_end" text,
	"status" text DEFAULT 'WAITING' NOT NULL,
	"offered_slot_start_utc" timestamp with time zone,
	"offered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer,
	"day_of_week" integer NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"open_time" text DEFAULT '09:30' NOT NULL,
	"close_time" text DEFAULT '20:00' NOT NULL,
	"break_start" text,
	"break_end" text
);
--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_slots" ADD CONSTRAINT "blocked_slots_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_availability" ADD CONSTRAINT "staff_availability_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_events_appt_idx" ON "appointment_events" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointments_staff_time_idx" ON "appointments" USING btree ("staff_id","start_at_utc","end_at_utc");--> statement-breakpoint
CREATE INDEX "appointments_customer_idx" ON "appointments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "blocked_slots_staff_time_idx" ON "blocked_slots" USING btree ("staff_id","start_at_utc","end_at_utc");--> statement-breakpoint
CREATE INDEX "customer_notes_customer_idx" ON "customer_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_appt_idx" ON "payments" USING btree ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_idx" ON "profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "staff_availability_date_idx" ON "staff_availability" USING btree ("date","staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_services_unique_idx" ON "staff_services" USING btree ("staff_id","service_id");--> statement-breakpoint
CREATE INDEX "waitlist_date_status_idx" ON "waitlist" USING btree ("preferred_date","status");--> statement-breakpoint
CREATE INDEX "working_hours_staff_day_idx" ON "working_hours" USING btree ("staff_id","day_of_week");