CREATE TABLE "nfse" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tax_info_id" integer NOT NULL,
	"fiscal_nacional_id" varchar(255),
	"fiscal_nacional_reference" varchar(255) NOT NULL,
	"stripe_subscription_id" varchar(255),
	"stripe_invoice_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"transaction_type" varchar(50) NOT NULL,
	"nfse_number" varchar(50),
	"status" varchar(50) DEFAULT 'processing' NOT NULL,
	"service_description" text NOT NULL,
	"product_name" varchar(255),
	"value_brl" double precision NOT NULL,
	"value_usd" double precision,
	"original_amount" double precision,
	"original_currency" varchar(3),
	"currency_code" varchar(3),
	"exchange_rate" double precision,
	"iss_rate" double precision DEFAULT 0.02 NOT NULL,
	"iss_value" double precision DEFAULT 0 NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_country" varchar(2) NOT NULL,
	"customer_document" varchar(50),
	"pdf_url" varchar(500),
	"xml_url" varchar(500),
	"error_message" text,
	"error_details" text,
	"issued_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nfse_fiscal_nacional_id_unique" UNIQUE("fiscal_nacional_id"),
	CONSTRAINT "nfse_fiscal_nacional_reference_unique" UNIQUE("fiscal_nacional_reference")
);
--> statement-breakpoint
CREATE TABLE "user_tax_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"country" varchar(2) NOT NULL,
	"is_brazilian" boolean DEFAULT false NOT NULL,
	"cpf_cnpj" varchar(20),
	"nif" varchar(50),
	"nif_exemption_code" varchar(10),
	"full_name" varchar(255) NOT NULL,
	"address" varchar(255),
	"number" varchar(20),
	"complement" varchar(100),
	"neighborhood" varchar(100),
	"city" varchar(100),
	"city_code" varchar(10),
	"state" varchar(2),
	"postal_code" varchar(10),
	"inscricao_municipal" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tax_info_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tax_id" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address_street" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address_city" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address_state" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address_postal_code" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_name" varchar(255);--> statement-breakpoint
ALTER TABLE "nfse" ADD CONSTRAINT "nfse_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nfse" ADD CONSTRAINT "nfse_tax_info_id_user_tax_info_id_fk" FOREIGN KEY ("tax_info_id") REFERENCES "public"."user_tax_info"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tax_info" ADD CONSTRAINT "user_tax_info_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;