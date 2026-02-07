/**
 * Currency Conversion Service for NFS-e generation (Bun Hono)
 *
 * Converts foreign currencies to BRL using:
 * 1. Stripe Balance Transaction (most accurate)
 * 2. PTAX (Banco Central do Brasil oficial rate)
 * 3. Conservative fallback rates
 */

import Stripe from "stripe";

// Currency mappings
const CURRENCIES = [
  { code: "USD", bacenCode: "220", name: "US Dollar", symbol: "$" },
  { code: "EUR", bacenCode: "978", name: "Euro", symbol: "€" },
  { code: "GBP", bacenCode: "540", name: "British Pound", symbol: "£" },
  { code: "CAD", bacenCode: "165", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", bacenCode: "150", name: "Australian Dollar", symbol: "A$" },
  { code: "JPY", bacenCode: "470", name: "Japanese Yen", symbol: "¥" },
  { code: "CHF", bacenCode: "510", name: "Swiss Franc", symbol: "CHF" },
  { code: "BRL", bacenCode: "986", name: "Brazilian Real", symbol: "R$" },
];

const ISO_TO_BACEN: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.bacenCode]),
);

const FALLBACK_RATES: Record<string, number> = {
  USD: 5.5,
  EUR: 6.0,
  GBP: 7.0,
  CAD: 4.0,
  AUD: 3.5,
  JPY: 0.037,
  CHF: 6.2,
};

export interface CurrencyConversionResult {
  amountBrl: number;
  originalAmount: number;
  originalCurrency: string;
  exchangeRate: number;
  source: "stripe_balance" | "ptax" | "fallback";
  rateDate: string;
  auditDescription: string;
  stripeFeesBrl?: number;
  netAmountBrl?: number;
}

export interface StripeBalanceInfo {
  grossAmountBrl: number;
  feesBrl: number;
  netAmountBrl: number;
  exchangeRate: number;
  originalAmount: number;
  originalCurrency: string;
}

export class CurrencyConversionService {
  private stripe: Stripe;

  constructor(stripeApiKey: string) {
    this.stripe = new Stripe(stripeApiKey, {
      apiVersion: "2025-12-15.clover",
    });
  }

  async getStripeBalanceInfo(chargeId: string): Promise<StripeBalanceInfo | null> {
    try {
      const charge = await this.stripe.charges.retrieve(chargeId, {
        expand: ["balance_transaction"],
      });

      const balanceTransaction = charge.balance_transaction as
        | Stripe.BalanceTransaction
        | undefined;

      if (!balanceTransaction || typeof balanceTransaction === "string") {
        return null;
      }

      const grossAmount = balanceTransaction.amount;
      const feeAmount = balanceTransaction.fee;
      const netAmount = balanceTransaction.net;

      let exchangeRate = 1;
      const originalCurrency = charge.currency.toUpperCase();

      if (originalCurrency !== "BRL") {
        exchangeRate = grossAmount / charge.amount;
      }

      return {
        grossAmountBrl: grossAmount / 100,
        feesBrl: feeAmount / 100,
        netAmountBrl: netAmount / 100,
        exchangeRate,
        originalAmount: charge.amount,
        originalCurrency,
      };
    } catch (error) {
      console.error(`Failed to get balance for charge ${chargeId}:`, error);
      return null;
    }
  }

  async getStripeBalanceInfoFromPaymentIntent(
    paymentIntentId: string,
  ): Promise<StripeBalanceInfo | null> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      });

      const charge = paymentIntent.latest_charge as Stripe.Charge | undefined;

      if (!charge || typeof charge === "string") {
        return null;
      }

      return this.getStripeBalanceInfo(charge.id);
    } catch (error) {
      console.error(`Failed to get balance from payment intent ${paymentIntentId}:`, error);
      return null;
    }
  }

  async getPTAXRate(
    currency: string,
    date?: Date,
  ): Promise<{ buyRate: number; sellRate: number; date: string } | null> {
    try {
      const targetDate = date || new Date();
      const formattedDate = this.formatDateForBACEN(targetDate);

      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@data)?@moeda='${currency}'&@data='${formattedDate}'&$format=json`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as {
        value?: Array<{
          cotacaoCompra: number;
          cotacaoVenda: number;
          dataHoraCotacao: string;
        }>;
      };

      if (!data.value || data.value.length === 0) {
        // Try previous day
        const previousDay = new Date(targetDate);
        previousDay.setDate(previousDay.getDate() - 1);

        if ((targetDate.getTime() - previousDay.getTime()) / (1000 * 60 * 60 * 24) <= 7) {
          return this.getPTAXRate(currency, previousDay);
        }

        return null;
      }

      const latestRate = data.value.at(-1);
      if (!latestRate) return null;

      return {
        buyRate: latestRate.cotacaoCompra,
        sellRate: latestRate.cotacaoVenda,
        date: latestRate.dataHoraCotacao,
      };
    } catch (error) {
      console.error(`Failed to get PTAX rate for ${currency}:`, error);
      return null;
    }
  }

  getFallbackRate(currency: string): number {
    return FALLBACK_RATES[currency.toUpperCase()] || 5.5;
  }

  async convertToBRL(params: {
    amount: number;
    currency: string;
    chargeId?: string;
    paymentIntentId?: string;
  }): Promise<CurrencyConversionResult> {
    const { amount, currency, chargeId, paymentIntentId } = params;
    const currencyUpper = currency.toUpperCase();

    if (currencyUpper === "BRL") {
      return {
        amountBrl: amount,
        originalAmount: amount,
        originalCurrency: "BRL",
        exchangeRate: 1,
        source: "stripe_balance",
        rateDate: new Date().toISOString(),
        auditDescription: "Pagamento em BRL - sem conversão necessária",
      };
    }

    const today = new Date().toISOString().split("T")[0] || "";

    // 1. Try Stripe Balance
    if (chargeId) {
      const stripeInfo = await this.getStripeBalanceInfo(chargeId);
      if (stripeInfo) {
        return {
          amountBrl: stripeInfo.grossAmountBrl,
          originalAmount: amount,
          originalCurrency: currencyUpper,
          exchangeRate: stripeInfo.exchangeRate,
          source: "stripe_balance",
          stripeFeesBrl: stripeInfo.feesBrl,
          netAmountBrl: stripeInfo.netAmountBrl,
          rateDate: today,
          auditDescription: this.buildAuditDescription(
            amount,
            currencyUpper,
            stripeInfo.exchangeRate,
            "stripe_balance",
            stripeInfo.feesBrl,
          ),
        };
      }
    }

    if (paymentIntentId) {
      const stripeInfo = await this.getStripeBalanceInfoFromPaymentIntent(paymentIntentId);
      if (stripeInfo) {
        return {
          amountBrl: stripeInfo.grossAmountBrl,
          originalAmount: amount,
          originalCurrency: currencyUpper,
          exchangeRate: stripeInfo.exchangeRate,
          source: "stripe_balance",
          stripeFeesBrl: stripeInfo.feesBrl,
          netAmountBrl: stripeInfo.netAmountBrl,
          rateDate: today,
          auditDescription: this.buildAuditDescription(
            amount,
            currencyUpper,
            stripeInfo.exchangeRate,
            "stripe_balance",
            stripeInfo.feesBrl,
          ),
        };
      }
    }

    // 2. Try PTAX
    const ptaxRate = await this.getPTAXRate(currencyUpper);
    if (ptaxRate) {
      const amountBrl = amount * ptaxRate.sellRate;
      return {
        amountBrl,
        originalAmount: amount,
        originalCurrency: currencyUpper,
        exchangeRate: ptaxRate.sellRate,
        source: "ptax",
        rateDate: ptaxRate.date,
        auditDescription: this.buildAuditDescription(
          amount,
          currencyUpper,
          ptaxRate.sellRate,
          "ptax",
        ),
      };
    }

    // 3. Fallback
    const fallbackRate = this.getFallbackRate(currencyUpper);
    const amountBrl = amount * fallbackRate;

    console.warn(`Using fallback rate for ${currencyUpper}: ${fallbackRate}`);

    return {
      amountBrl,
      originalAmount: amount,
      originalCurrency: currencyUpper,
      exchangeRate: fallbackRate,
      source: "fallback",
      rateDate: today,
      auditDescription: this.buildAuditDescription(amount, currencyUpper, fallbackRate, "fallback"),
    };
  }

  private buildAuditDescription(
    originalAmount: number,
    currency: string,
    rate: number,
    source: "stripe_balance" | "ptax" | "fallback",
    fees?: number,
  ): string {
    const sourceLabels = {
      stripe_balance: "Taxa de Conversão Stripe",
      ptax: "Taxa PTAX (Banco Central)",
      fallback: "Taxa de Conversão Estimada",
    };

    const currencyObj = CURRENCIES.find((c) => c.code === currency);
    const symbol = currencyObj?.symbol || currency;

    let description = `Valor original: ${symbol}${originalAmount.toFixed(2)} - ${sourceLabels[source]}: R$ ${rate.toFixed(4)}`;

    if (fees && fees > 0) {
      description += ` - Taxas operacionais: R$ ${fees.toFixed(2)}`;
    }

    return description;
  }

  private formatDateForBACEN(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  }

  static getBACENCode(isoCurrency: string): string | undefined {
    return ISO_TO_BACEN[isoCurrency.toUpperCase()];
  }
}

export function createCurrencyConversionService(stripeApiKey: string): CurrencyConversionService {
  return new CurrencyConversionService(stripeApiKey);
}
