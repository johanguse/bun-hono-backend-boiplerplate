/**
 * NFS-e Service
 *
 * High-level service for managing NFS-e generation and lifecycle
 */

import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { FiscalNacionalClient, type FiscalNacionalConfig } from "./fiscal-nacional";
import { CurrencyConversionService } from "./currency-conversion.service";
import { nfse, userTaxInfo } from "../db/schema";
import type * as schema from "../db/schema";

export class NFSeService {
  private readonly fiscalClient: FiscalNacionalClient;
  private readonly currencyService: CurrencyConversionService;
  private readonly config: FiscalNacionalConfig;

  constructor(config: {
    fiscalApiKey: string;
    stripeApiKey: string;
    environment?: "sandbox" | "production";
    companyConfig: FiscalNacionalConfig;
  }) {
    this.config = config.companyConfig;
    this.fiscalClient = new FiscalNacionalClient({
      apiKey: config.fiscalApiKey,
      environment: config.environment,
      companyConfig: config.companyConfig,
    });
    this.currencyService = new CurrencyConversionService(config.stripeApiKey);
  }

  /**
   * Create NFS-e for a subscription payment
   */
  async createNFSeForSubscription(
    db: DrizzleD1Database<typeof schema>,
    params: {
      userId: number;
      stripeSubscriptionId: string;
      stripeInvoiceId: string;
      stripeChargeId?: string;
      stripePaymentIntentId?: string;
      amount: number;
      currency: string;
      planName: string;
      userEmail: string;
    },
  ): Promise<number> {
    // Get user's tax info
    const [taxInfo] = await db
      .select()
      .from(userTaxInfo)
      .where(eq(userTaxInfo.userId, params.userId))
      .limit(1);

    if (!taxInfo) {
      throw new Error("User tax information not found");
    }

    // Convert to BRL
    const conversion = await this.currencyService.convertToBRL({
      amount: params.amount,
      currency: params.currency,
      chargeId: params.stripeChargeId,
      paymentIntentId: params.stripePaymentIntentId,
    });

    // Generate service description
    const serviceDescription = this._buildServiceDescription(
      params.planName,
      params.amount,
      params.currency,
      conversion.exchangeRate,
      conversion.source,
    );

    // Create NFS-e via Fiscal Nacional API
    const externalReference = `user_${params.userId}_sub_${params.stripeSubscriptionId}`;
    const fiscalResponse = await this.fiscalClient.createNFSe({
      tomador: this._buildTomadorFromTaxInfo(taxInfo, params.userEmail),
      servico: {
        valorServicos: conversion.amountBrl,
        itemListaServico: this.config.itemListaServico,
        codigoTributacaoMunicipio: this.config.codigoTributacaoMunicipio,
        discriminacao: serviceDescription,
        codigoCnae: this.config.codigoCnae,
      },
      impostos: {
        issRetido: false,
        aliquotaIss: this.config.aliquotaIss,
      },
      referenciaExterna: externalReference,
    });

    // Save to database
    const [created] = await db
      .insert(nfse)
      .values({
        userId: params.userId,
        taxInfoId: taxInfo.id,
        fiscalNacionalReference: fiscalResponse.reference,
        stripeSubscriptionId: params.stripeSubscriptionId,
        stripeInvoiceId: params.stripeInvoiceId,
        stripeChargeId: params.stripeChargeId || null,
        stripePaymentIntentId: params.stripePaymentIntentId || null,
        transactionType: "subscription",
        status: fiscalResponse.status as "processing" | "authorized" | "error" | "cancelled",
        productName: params.planName,
        serviceDescription,
        valueBrl: conversion.amountBrl,
        valueUsd: params.currency === "USD" ? params.amount : null,
        originalAmount: params.amount,
        originalCurrency: params.currency,
        exchangeRate: conversion.exchangeRate,
        customerName: taxInfo.fullName,
        customerEmail: params.userEmail,
        customerCountry: taxInfo.country,
        customerDocument: taxInfo.cpfCnpj || taxInfo.nif || null,
        nfseNumber: fiscalResponse.nfseNumber || null,
        pdfUrl: fiscalResponse.pdfUrl || null,
        xmlUrl: fiscalResponse.xmlUrl || null,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create NFS-e record");
    }

    return created.id;
  }

  /**
   * Create NFS-e for a credit purchase
   */
  async createNFSeForCreditPurchase(
    db: DrizzleD1Database<typeof schema>,
    params: {
      userId: number;
      stripePaymentIntentId: string;
      stripeChargeId?: string;
      amount: number;
      currency: string;
      creditAmount: number;
      userEmail: string;
    },
  ): Promise<number> {
    // Get user's tax info
    const [taxInfo] = await db
      .select()
      .from(userTaxInfo)
      .where(eq(userTaxInfo.userId, params.userId))
      .limit(1);

    if (!taxInfo) {
      throw new Error("User tax information not found");
    }

    // Convert to BRL
    const conversion = await this.currencyService.convertToBRL({
      amount: params.amount,
      currency: params.currency,
      chargeId: params.stripeChargeId,
      paymentIntentId: params.stripePaymentIntentId,
    });

    // Generate service description
    const serviceDescription = this._buildServiceDescription(
      `${params.creditAmount} Credits`,
      params.amount,
      params.currency,
      conversion.exchangeRate,
      conversion.source,
    );

    // Create NFS-e via Fiscal Nacional API
    const externalReference = `user_${params.userId}_credits_${params.stripePaymentIntentId}`;
    const fiscalResponse = await this.fiscalClient.createNFSe({
      tomador: this._buildTomadorFromTaxInfo(taxInfo, params.userEmail),
      servico: {
        valorServicos: conversion.amountBrl,
        itemListaServico: this.config.itemListaServico,
        codigoTributacaoMunicipio: this.config.codigoTributacaoMunicipio,
        discriminacao: serviceDescription,
        codigoCnae: this.config.codigoCnae,
      },
      impostos: {
        issRetido: false,
        aliquotaIss: this.config.aliquotaIss,
      },
      referenciaExterna: externalReference,
    });

    // Save to database
    const [created] = await db
      .insert(nfse)
      .values({
        userId: params.userId,
        taxInfoId: taxInfo.id,
        fiscalNacionalReference: fiscalResponse.reference,
        stripePaymentIntentId: params.stripePaymentIntentId,
        stripeChargeId: params.stripeChargeId || null,
        transactionType: "credit_purchase",
        status: fiscalResponse.status as "processing" | "authorized" | "error" | "cancelled",
        productName: `${params.creditAmount} Credits`,
        serviceDescription,
        valueBrl: conversion.amountBrl,
        valueUsd: params.currency === "USD" ? params.amount : null,
        originalAmount: params.amount,
        originalCurrency: params.currency,
        exchangeRate: conversion.exchangeRate,
        customerName: taxInfo.fullName,
        customerEmail: params.userEmail,
        customerCountry: taxInfo.country,
        customerDocument: taxInfo.cpfCnpj || taxInfo.nif || null,
        nfseNumber: fiscalResponse.nfseNumber || null,
        pdfUrl: fiscalResponse.pdfUrl || null,
        xmlUrl: fiscalResponse.xmlUrl || null,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create NFS-e record");
    }

    return created.id;
  }

  /**
   * Update NFS-e status from webhook
   */
  async updateNFSeFromWebhook(
    db: DrizzleD1Database<typeof schema>,
    params: {
      reference: string;
      status: string;
      nfseNumber?: string;
      pdfUrl?: string;
      xmlUrl?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    const updateData: Record<string, any> = {
      status: params.status,
      updatedAt: new Date(),
    };

    if (params.status === "authorized") {
      updateData.issuedAt = new Date();
      if (params.nfseNumber) updateData.nfseNumber = params.nfseNumber;
      if (params.pdfUrl) updateData.pdfUrl = params.pdfUrl;
      if (params.xmlUrl) updateData.xmlUrl = params.xmlUrl;
    }

    if (params.status === "error") {
      updateData.errorMessage = params.errorMessage || "Unknown error";
    }

    if (params.status === "cancelled") {
      updateData.cancelledAt = new Date();
    }

    await db.update(nfse).set(updateData).where(eq(nfse.fiscalNacionalReference, params.reference));
  }

  /**
   * Build tomador (customer) object from tax info
   */
  private _buildTomadorFromTaxInfo(taxInfo: typeof userTaxInfo.$inferSelect, email: string) {
    if (taxInfo.isBrazilian) {
      // Brazilian customer
      return {
        cpfCnpj: taxInfo.cpfCnpj!,
        nomeRazaoSocial:
          taxInfo.fullName ||
          (taxInfo.cpfCnpj!.length <= 11 ? "CPF" : "CNPJ") + " " + taxInfo.cpfCnpj!,
        email,
        endereco: {
          logradouro: taxInfo.address!,
          numero: taxInfo.number!,
          complemento: taxInfo.complement || undefined,
          bairro: taxInfo.neighborhood!,
          codigoMunicipio: taxInfo.cityCode!,
          uf: taxInfo.state!,
          cep: taxInfo.postalCode!.replace(/\D/g, ""),
        },
      };
    } else {
      // International customer
      // For international customers, combine available address fields
      const internationalAddress =
        [taxInfo.address, taxInfo.city, taxInfo.postalCode].filter(Boolean).join(", ") || undefined;

      return {
        nomeRazaoSocial: taxInfo.fullName!,
        email,
        pais: taxInfo.country!,
        nif: taxInfo.nif || undefined,
        enderecoExterior: internationalAddress,
      };
    }
  }

  /**
   * Build service description with conversion details
   */
  private _buildServiceDescription(
    productName: string,
    amount: number,
    currency: string,
    exchangeRate: number,
    source: string,
  ): string {
    const lines = [
      `Serviço: ${productName}`,
      `Valor Original: ${amount.toFixed(2)} ${currency}`,
      `Taxa de Câmbio: ${exchangeRate.toFixed(4)}`,
      `Fonte: ${source}`,
    ];

    return lines.join("\n");
  }
}
