import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// ============================================================================
// User Tax Information
// ============================================================================

export const userTaxInfo = pgTable("user_tax_info", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  // Location
  country: varchar("country", { length: 2 }).notNull(), // ISO 3166-1 alpha-2
  isBrazilian: boolean("is_brazilian").default(false).notNull(),

  // Identity documents
  cpfCnpj: varchar("cpf_cnpj", { length: 20 }), // Brazilian CPF or CNPJ
  nif: varchar("nif", { length: 50 }), // Foreign tax ID
  nifExemptionCode: varchar("nif_exemption_code", { length: 10 }), // For exempt entities

  // Personal info
  fullName: varchar("full_name", { length: 255 }).notNull(),

  // Brazilian address (required for Brazilian customers)
  address: varchar("address", { length: 255 }), // Street address
  number: varchar("number", { length: 20 }), // Street number
  complement: varchar("complement", { length: 100 }), // Apt/Suite
  neighborhood: varchar("neighborhood", { length: 100 }), // Bairro
  city: varchar("city", { length: 100 }), // City name
  cityCode: varchar("city_code", { length: 10 }), // IBGE code
  state: varchar("state", { length: 2 }), // State code (UF)
  postalCode: varchar("postal_code", { length: 10 }), // CEP
  inscricaoMunicipal: varchar("inscricao_municipal", { length: 50 }), // Municipal registration

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// NFS-e Records
// ============================================================================

export const nfse = pgTable("nfse", {
  id: serial("id").primaryKey(),

  // Foreign keys
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taxInfoId: integer("tax_info_id")
    .notNull()
    .references(() => userTaxInfo.id, { onDelete: "restrict" }),

  // Fiscal Nacional identifiers
  fiscalNacionalId: varchar("fiscal_nacional_id", { length: 255 }).unique(),
  fiscalNacionalReference: varchar("fiscal_nacional_reference", {
    length: 255,
  })
    .notNull()
    .unique(),

  // Stripe identifiers
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeChargeId: varchar("stripe_charge_id", { length: 255 }),

  // Transaction info
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // subscription, credit_purchase
  nfseNumber: varchar("nfse_number", { length: 50 }), // Official NFS-e number
  status: varchar("status", { length: 50 }).default("processing").notNull(), // processing, authorized, error, cancelled

  // Service details
  serviceDescription: text("service_description").notNull(),
  productName: varchar("product_name", { length: 255 }), // Clean display name

  // Values
  valueBrl: doublePrecision("value_brl").notNull(),
  valueUsd: doublePrecision("value_usd"),
  originalAmount: doublePrecision("original_amount"),
  originalCurrency: varchar("original_currency", { length: 3 }),
  currencyCode: varchar("currency_code", { length: 3 }), // BACEN code
  exchangeRate: doublePrecision("exchange_rate"),

  // Tax calculation
  issRate: doublePrecision("iss_rate").default(0.02).notNull(), // 2%
  issValue: doublePrecision("iss_value").default(0.0).notNull(),

  // Customer snapshot (denormalized for historical record)
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  customerCountry: varchar("customer_country", { length: 2 }).notNull(),
  customerDocument: varchar("customer_document", { length: 50 }),

  // Document URLs
  pdfUrl: varchar("pdf_url", { length: 500 }),
  xmlUrl: varchar("xml_url", { length: 500 }),

  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: text("error_details"),

  // Timestamps
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// Relations
// ============================================================================

export const userTaxInfoRelations = relations(userTaxInfo, ({ one, many }) => ({
  user: one(users, {
    fields: [userTaxInfo.userId],
    references: [users.id],
  }),
  nfseRecords: many(nfse),
}));

export const nfseRelations = relations(nfse, ({ one }) => ({
  user: one(users, {
    fields: [nfse.userId],
    references: [users.id],
  }),
  taxInfo: one(userTaxInfo, {
    fields: [nfse.taxInfoId],
    references: [userTaxInfo.id],
  }),
}));
