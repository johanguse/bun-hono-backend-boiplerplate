import { z } from "zod";

/**
 * Fiscal Nacional API Entity
 * Schema and types for NFS-e (Nota Fiscal de Serviço Eletrônica) integration
 */

// ============================================================================
// Schemas (Runtime Validation)
// ============================================================================

/**
 * Fiscal Nacional configuration schema
 */
export const FiscalNacionalConfigSchema = z.object({
  cnpj: z.string(),
  inscricaoMunicipal: z.string(),
  codigoMunicipio: z.string(),
  itemListaServico: z.string(), // e.g., "01.02" for software services
  codigoTributacaoMunicipio: z.string(),
  codigoCnae: z.string(),
  aliquotaIss: z.number(), // ISS tax rate (e.g., 2.5 for 2.5%)
});

/**
 * NFS-e tomador (customer) address schema
 */
export const NFSeTomadorEnderecoSchema = z.object({
  logradouro: z.string(),
  numero: z.string(),
  complemento: z.string().optional(),
  bairro: z.string(),
  codigoMunicipio: z.string(), // IBGE code
  uf: z.string(),
  cep: z.string(),
});

/**
 * NFS-e tomador (customer) schema
 */
export const NFSeTomadorSchema = z.object({
  cpfCnpj: z.string().optional(),
  nomeRazaoSocial: z.string(),
  email: z.string(),
  endereco: NFSeTomadorEnderecoSchema.optional(),
  pais: z.string().optional(),
  nif: z.string().optional(),
  enderecoExterior: z.string().optional(),
});

/**
 * NFS-e service schema
 */
export const NFSeServicoSchema = z.object({
  valorServicos: z.number(), // In BRL
  itemListaServico: z.string(),
  codigoTributacaoMunicipio: z.string(),
  discriminacao: z.string(),
  codigoCnae: z.string(),
});

/**
 * NFS-e taxes schema
 */
export const NFSeImpostosSchema = z.object({
  issRetido: z.boolean(),
  valorIss: z.number().optional(),
  aliquotaIss: z.number().optional(),
  valorPis: z.number().optional(),
  valorCofins: z.number().optional(),
  valorCsrf: z.number().optional(),
  valorInss: z.number().optional(),
  valorIr: z.number().optional(),
});

/**
 * Create NFS-e request schema
 */
export const CreateNFSeRequestSchema = z.object({
  tomador: NFSeTomadorSchema,
  servico: NFSeServicoSchema,
  impostos: NFSeImpostosSchema.optional(),
  observacoes: z.string().optional(),
  referenciaExterna: z.string(), // Your internal reference
});

/**
 * Create NFS-e response schema
 */
export const CreateNFSeResponseSchema = z.object({
  reference: z.string(),
  status: z.string(),
  nfseNumber: z.string().optional(),
  verificationCode: z.string().optional(),
  pdfUrl: z.string().optional(),
  xmlUrl: z.string().optional(),
});

/**
 * Get NFS-e status response schema
 */
export const GetNFSeStatusResponseSchema = z.object({
  reference: z.string(),
  status: z.string(),
  nfseNumber: z.string().optional(),
  verificationCode: z.string().optional(),
  pdfUrl: z.string().optional(),
  xmlUrl: z.string().optional(),
  authorizedAt: z.coerce.date().optional(),
  cancelledAt: z.coerce.date().optional(),
  errorMessage: z.string().optional(),
});

/**
 * Cancel NFS-e request schema
 */
export const CancelNFSeRequestSchema = z.object({
  codigoCancelamento: z.string(),
  motivo: z.string(),
});

/**
 * Cancel NFS-e response schema
 */
export const CancelNFSeResponseSchema = z.object({
  reference: z.string(),
  status: z.string(),
  cancelledAt: z.coerce.date(),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type FiscalNacionalConfig = z.infer<typeof FiscalNacionalConfigSchema>;
export type NFSeTomadorEndereco = z.infer<typeof NFSeTomadorEnderecoSchema>;
export type NFSeTomador = z.infer<typeof NFSeTomadorSchema>;
export type NFSeServico = z.infer<typeof NFSeServicoSchema>;
export type NFSeImpostos = z.infer<typeof NFSeImpostosSchema>;
export type CreateNFSeRequest = z.infer<typeof CreateNFSeRequestSchema>;
export type CreateNFSeResponse = z.infer<typeof CreateNFSeResponseSchema>;
export type GetNFSeStatusResponse = z.infer<typeof GetNFSeStatusResponseSchema>;
export type CancelNFSeRequest = z.infer<typeof CancelNFSeRequestSchema>;
export type CancelNFSeResponse = z.infer<typeof CancelNFSeResponseSchema>;
