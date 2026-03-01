/**
 * Fiscal Nacional API Client
 *
 * Client for interacting with the Fiscal Nacional NFS-e API
 */

import type {
  CancelNFSeRequest,
  CancelNFSeResponse,
  CreateNFSeRequest,
  CreateNFSeResponse,
  FiscalNacionalConfig,
  GetNFSeStatusResponse,
} from "../shared/entities/fiscal";

export class FiscalNacionalClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly config: FiscalNacionalConfig;

  constructor(config: {
    apiKey: string;
    environment?: "sandbox" | "production";
    companyConfig: FiscalNacionalConfig;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl =
      config.environment === "production"
        ? "https://api.fiscalnacional.com.br/v1"
        : "https://sandbox.fiscalnacional.com.br/v1";
    this.config = config.companyConfig;
  }

  /**
   * Create a new NFS-e (electronic service invoice)
   */
  async createNFSe(request: CreateNFSeRequest): Promise<CreateNFSeResponse> {
    const response = await fetch(`${this.baseUrl}/nfse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        prestador: {
          cnpj: this.config.cnpj,
          inscricao_municipal: this.config.inscricaoMunicipal,
          codigo_municipio: this.config.codigoMunicipio,
        },
        tomador: {
          cpf_cnpj: request.tomador.cpfCnpj,
          nome_razao_social: request.tomador.nomeRazaoSocial,
          email: request.tomador.email,
          endereco: request.tomador.endereco
            ? {
                logradouro: request.tomador.endereco.logradouro,
                numero: request.tomador.endereco.numero,
                complemento: request.tomador.endereco.complemento,
                bairro: request.tomador.endereco.bairro,
                codigo_municipio: request.tomador.endereco.codigoMunicipio,
                uf: request.tomador.endereco.uf,
                cep: request.tomador.endereco.cep,
              }
            : undefined,
          // For international customers
          pais: request.tomador.pais,
          nif: request.tomador.nif,
          endereco_exterior: request.tomador.enderecoExterior,
        },
        servico: {
          valor_servicos: request.servico.valorServicos,
          item_lista_servico: request.servico.itemListaServico,
          codigo_tributacao_municipio: request.servico.codigoTributacaoMunicipio,
          discriminacao: request.servico.discriminacao,
          codigo_cnae: request.servico.codigoCnae,
        },
        impostos: {
          iss_retido: request.impostos?.issRetido ?? false,
          valor_iss: request.impostos?.valorIss,
          aliquota_iss: request.impostos?.aliquotaIss,
          valor_pis: request.impostos?.valorPis,
          valor_cofins: request.impostos?.valorCofins,
          valor_csrf: request.impostos?.valorCsrf,
          valor_inss: request.impostos?.valorInss,
          valor_ir: request.impostos?.valorIr,
        },
        observacoes: request.observacoes,
        referencia_externa: request.referenciaExterna,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(`Failed to create NFS-e: ${error.message || response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      reference: data.referencia as string,
      status: data.status as string,
      nfseNumber: data.numero_nfse as string | undefined,
      verificationCode: data.codigo_verificacao as string | undefined,
      pdfUrl: data.url_pdf as string | undefined,
      xmlUrl: data.url_xml as string | undefined,
    };
  }

  /**
   * Get NFS-e status by reference
   */
  async getNFSeStatus(reference: string): Promise<GetNFSeStatusResponse> {
    const response = await fetch(`${this.baseUrl}/nfse/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(`Failed to get NFS-e status: ${error.message || response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      reference: data.referencia as string,
      status: data.status as string,
      nfseNumber: data.numero_nfse as string | undefined,
      verificationCode: data.codigo_verificacao as string | undefined,
      pdfUrl: data.url_pdf as string | undefined,
      xmlUrl: data.url_xml as string | undefined,
      authorizedAt: data.data_autorizacao ? new Date(data.data_autorizacao as string) : undefined,
      cancelledAt: data.data_cancelamento ? new Date(data.data_cancelamento as string) : undefined,
      errorMessage: data.mensagem_erro as string | undefined,
    };
  }

  /**
   * Cancel an NFS-e
   */
  async cancelNFSe(reference: string, request: CancelNFSeRequest): Promise<CancelNFSeResponse> {
    const response = await fetch(`${this.baseUrl}/nfse/${reference}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        codigo_cancelamento: request.codigoCancelamento,
        motivo: request.motivo,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(`Failed to cancel NFS-e: ${error.message || response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      reference: data.referencia as string,
      status: data.status as string,
      cancelledAt: new Date(data.data_cancelamento as string),
    };
  }
}

// Re-export types for convenience
export type {
  CancelNFSeRequest,
  CancelNFSeResponse,
  CreateNFSeRequest,
  CreateNFSeResponse,
  FiscalNacionalConfig,
  GetNFSeStatusResponse,
} from "../shared/entities/fiscal";
