/**
 * Fiscal Routes
 *
 * API endpoints for tax information and NFS-e management
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import { userTaxInfo, nfse } from "../../db/schema";
import { env } from "../../lib/env";
import { authMiddleware, requireAuth } from "../../middleware";
import { createHmac, timingSafeEqual } from "crypto";

// IBGE API city response type
interface IBGECity {
  id: number;
  nome: string;
}

const app = new Hono();

// Apply auth middleware to all routes except webhook
app.use("*", async (c, next) => {
  // Skip auth for webhook endpoint
  if (c.req.path.endsWith("/webhook") && c.req.method === "POST") {
    return next();
  }
  return authMiddleware(c, next);
});

// ============================================================================
// Tax Information Endpoints
// ============================================================================

/**
 * Get current user's tax information
 */
app.get("/tax-info", requireAuth, async (c) => {
  const userId = c.get("userId")!;

  const [taxInfo] = await db
    .select()
    .from(userTaxInfo)
    .where(eq(userTaxInfo.userId, userId))
    .limit(1);

  if (!taxInfo) {
    return c.json({ error: "Tax information not found" }, 404);
  }

  return c.json(taxInfo);
});

/**
 * Create or update tax information
 */
const createTaxInfoSchema = z.object({
  country: z.string().min(2).max(2),
  isBrazilian: z.boolean(),
  cpfCnpj: z.string().optional(),
  nif: z.string().optional(),
  fullName: z.string().min(1),
  address: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  cityCode: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  internationalAddress: z.string().optional(),
});

app.post("/tax-info", requireAuth, zValidator("json", createTaxInfoSchema), async (c) => {
  const userId = c.get("userId")!;

  const data = c.req.valid("json");

  // Validation
  if (data.isBrazilian) {
    if (!data.cpfCnpj || !data.address || !data.cityCode) {
      return c.json(
        {
          error: "Brazilian customers must provide CPF/CNPJ and complete address",
        },
        400,
      );
    }
  } else {
    if (!data.fullName) {
      return c.json({ error: "International customers must provide full name" }, 400);
    }
  }

  // Check if exists
  const [existing] = await db
    .select()
    .from(userTaxInfo)
    .where(eq(userTaxInfo.userId, userId))
    .limit(1);

  if (existing) {
    // Update
    const [updated] = await db
      .update(userTaxInfo)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userTaxInfo.userId, userId))
      .returning();
    return c.json(updated);
  } else {
    // Create
    const [created] = await db
      .insert(userTaxInfo)
      .values({ ...data, userId })
      .returning();
    return c.json(created, 201);
  }
});

// ============================================================================
// Brazilian Data Endpoints
// ============================================================================

/**
 * Get Brazilian states
 */
app.get("/brazilian-states", async (c) => {
  const states = [
    { code: "AC", name: "Acre" },
    { code: "AL", name: "Alagoas" },
    { code: "AP", name: "Amapá" },
    { code: "AM", name: "Amazonas" },
    { code: "BA", name: "Bahia" },
    { code: "CE", name: "Ceará" },
    { code: "DF", name: "Distrito Federal" },
    { code: "ES", name: "Espírito Santo" },
    { code: "GO", name: "Goiás" },
    { code: "MA", name: "Maranhão" },
    { code: "MT", name: "Mato Grosso" },
    { code: "MS", name: "Mato Grosso do Sul" },
    { code: "MG", name: "Minas Gerais" },
    { code: "PA", name: "Pará" },
    { code: "PB", name: "Paraíba" },
    { code: "PR", name: "Paraná" },
    { code: "PE", name: "Pernambuco" },
    { code: "PI", name: "Piauí" },
    { code: "RJ", name: "Rio de Janeiro" },
    { code: "RN", name: "Rio Grande do Norte" },
    { code: "RS", name: "Rio Grande do Sul" },
    { code: "RO", name: "Rondônia" },
    { code: "RR", name: "Roraima" },
    { code: "SC", name: "Santa Catarina" },
    { code: "SP", name: "São Paulo" },
    { code: "SE", name: "Sergipe" },
    { code: "TO", name: "Tocantins" },
  ];

  return c.json(states);
});

/**
 * Get Brazilian cities by state
 */
app.get("/brazilian-cities/:stateCode", async (c) => {
  const stateCode = c.req.param("stateCode");

  try {
    // Call IBGE API
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios`,
    );

    if (!response.ok) {
      return c.json({ error: "Failed to fetch cities" }, 500);
    }

    const cities = (await response.json()) as IBGECity[];
    const formatted = cities.map((city) => ({
      id: city.id.toString(),
      name: city.nome,
    }));

    return c.json(formatted);
  } catch (error) {
    console.error("Error fetching cities:", error);
    return c.json({ error: "Failed to fetch cities" }, 500);
  }
});

/**
 * Validate CPF/CNPJ
 */
app.get("/validate-cpf-cnpj/:document", async (c) => {
  const document = c.req.param("document").replace(/\D/g, "");

  const isCPF = document.length === 11;
  const isCNPJ = document.length === 14;

  if (!isCPF && !isCNPJ) {
    return c.json({
      valid: false,
      message: "Document must be 11 digits (CPF) or 14 digits (CNPJ)",
    });
  }

  // Basic validation (you can implement more complex validation)
  const allSame = /^(\d)\1+$/.test(document);
  if (allSame) {
    return c.json({
      valid: false,
      type: isCPF ? "cpf" : "cnpj",
      message: "Invalid document",
    });
  }

  // Format document
  const formatted = isCPF
    ? document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");

  return c.json({
    valid: true,
    type: isCPF ? "cpf" : "cnpj",
    formatted,
  });
});

// ============================================================================
// NFS-e Endpoints
// ============================================================================

/**
 * List user's NFS-e records
 */
app.get("/nfse", requireAuth, async (c) => {
  const userId = c.get("userId")!;

  const records = await db
    .select()
    .from(nfse)
    .where(eq(nfse.userId, userId))
    .orderBy(desc(nfse.createdAt));

  return c.json({
    items: records,
    total: records.length,
  });
});

/**
 * Get specific NFS-e by ID
 */
app.get("/nfse/:id", requireAuth, async (c) => {
  const userId = c.get("userId")!;

  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ error: "Invalid NFS-e ID" }, 400);
  }

  const [record] = await db.select().from(nfse).where(eq(nfse.id, id)).limit(1);

  if (!record) {
    return c.json({ error: "NFS-e not found" }, 404);
  }

  // Verify ownership
  if (record.userId !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json(record);
});

// ============================================================================
// Webhook Endpoint (Public - No Auth)
// ============================================================================

/**
 * Fiscal Nacional webhook handler
 */
const webhookSchema = z.object({
  event: z.string(),
  reference: z.string(),
  status: z.string(),
  nfse_number: z.string().optional(),
  pdf_url: z.string().optional(),
  xml_url: z.string().optional(),
  error_message: z.string().optional(),
  timestamp: z.string(),
});

app.post("/webhook", async (c) => {
  // Verify signature
  const signature = c.req.header("X-Fiscal-Signature");
  const webhookSecret = env.FISCAL_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const body = await c.req.text();
  const expectedSignature = createHmac("sha256", webhookSecret).update(body).digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  // Process webhook - parse from raw body since we already consumed it for signature
  const data = webhookSchema.parse(JSON.parse(body));

  try {
    const updateData: Record<string, any> = {
      status: data.status,
      updatedAt: new Date(),
    };

    if (data.status === "authorized") {
      updateData.issuedAt = new Date();
      if (data.nfse_number) updateData.nfseNumber = data.nfse_number;
      if (data.pdf_url) updateData.pdfUrl = data.pdf_url;
      if (data.xml_url) updateData.xmlUrl = data.xml_url;
    }

    if (data.status === "error") {
      updateData.errorMessage = data.error_message || "Unknown error";
    }

    if (data.status === "cancelled") {
      updateData.cancelledAt = new Date();
    }

    await db.update(nfse).set(updateData).where(eq(nfse.fiscalNacionalReference, data.reference));

    return c.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return c.json({ error: "Processing failed" }, 500);
  }
});

export default app;
