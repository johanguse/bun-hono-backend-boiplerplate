# External API Integration Guide

This document describes how to integrate your SaaS application with the Fiscal Nacional External API to automatically generate NFS-e (Nota Fiscal de Serviço Eletrônica) for your customers.

## Overview

The External API allows your application to generate Brazilian electronic service invoices (NFS-e) programmatically using a simple REST API with API Key authentication. No user session or OAuth flow required.

**Base URL:**
- Production: `https://api.fiscalnacional.com.br`
- Staging: `https://api-staging.fiscalnacional.com.br`
- Local Development: `http://localhost:8000`

## When NOT to Generate NFS-e

> ⚠️ **Important:** Do NOT call this API in these cases:

| Scenario | Reason |
|----------|--------|
| **Trial period** | No payment received - no taxable event |
| **Amount = R$ 0,00** | Zero amount due to 100% discount coupon |
| **Free plans** | No payment received |
| **Failed/pending payments** | Transaction not completed |

NFS-e is only required when there is an actual **paid transaction** with amount > 0.

---

## Authentication

All requests must include an API Key in the `X-API-Key` header:

```
X-API-Key: your_project_api_key_here
```

You can obtain your API Key from the dashboard by:
1. Go to **Projects**
2. Select your project
3. Copy the **API Key** from project settings

### Project Configuration

Each project can be configured with specific service codes for NFS-e generation:

| Setting | Description | Default |
|---------|-------------|---------|
| **Service Code** | Item Lista Serviço (e.g., 1.03, 1.04, 1.05) | 1.03 (SaaS) |
| **NBS Code** | Código NBS for exports (e.g., 115062100) | 115062100 |
| **ISS Rate** | Tax rate for domestic transactions | 2% |

**Service Code Options:**

| Code | Description | NBS Code | Use Case |
|------|-------------|----------|----------|
| **1.03** | SaaS/Hospedagem | 115062100 | Subscription SaaS products |
| **1.04** | Desenvolvimento | 115022000 | Custom software development |
| **1.05** | Licenciamento | 111032200 | Software licensing |

Configure these in the dashboard under **Projects > Edit > Service Code**.

> **Important:** The project's configured `service_code` and `nbs_code` are automatically used when generating NFS-e via the API. No need to pass these values in the request.

⚠️ **Keep your API Key secret!** Do not expose it in client-side code.

---

## Endpoints

### 1. Create NFS-e

Generate a new NFS-e for a customer.

**Endpoint:** `POST /api/v1/external/nfse`

**Headers:**
| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `X-API-Key` | string | Yes | Your project API key |
| `Content-Type` | string | Yes | Must be `application/json` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customer_name` | string | **Yes** | Customer's full name or company name (max 255 chars) |
| `customer_email` | string | No | Customer's email for notification |
| `customer_country` | string | No | Country code: `BR` for Brazil, or ISO 2-letter code for other countries. Default: `EXTERIOR` |
| `customer_document` | string | Conditional | CPF (11 digits) or CNPJ (14 digits) **for Brazilian customers only** |
| `customer_nif` | string | No | Foreign Tax ID (NIF) **for international customers** (max 50 chars) |
| `nif_exemption_code` | integer | No | NIF exemption code: `0`=NIF provided, `1`=not required, `2`=not provided |
| `currency_code` | string | No | BACEN currency code for foreign currency (e.g., `220`=USD, `978`=EUR). Default: `220` for exports |
| `foreign_currency_amount` | number | No | Invoice value in foreign currency (for exports) |
| `customer_address` | string | No* | Street address |
| `customer_number` | string | No* | Address number |
| `customer_complement` | string | No | Address complement (apt, suite, etc.) |
| `customer_neighborhood` | string | No* | Neighborhood/District |
| `customer_postal_code` | string | No* | Postal/ZIP code (up to 20 chars for international) |
| `customer_state` | string | No* | State code (e.g., `SC`, `SP`, `RJ`) or international region |
| `customer_city_name` | string | No* | City name |
| `customer_city_code` | integer | Conditional | IBGE city code (required for Brazilian customers) |
| `customer_inscricao_municipal` | string | No | Customer's municipal registration (if applicable) |
| `service_description` | string | **Yes** | Detailed description of services provided |
| `amount` | number | **Yes** | Invoice amount in BRL (greater than 0) |
| `external_reference` | string | No | Your system's reference ID (invoice ID, subscription ID, etc.) |

> *These address fields are required for Brazilian customers to ensure proper NFS-e generation.
> 
> **International Customers:** For export/international NFS-e, provide `customer_nif` (foreign tax ID) and optionally `currency_code` + `foreign_currency_amount` for proper foreign trade information.

**Response (201 Created):**

```json
{
  "id": "uuid-of-nfse-record",
  "reference": "EXT-20260103120000-A1B2C3D4",
  "status": "processing",
  "nfse_number": null,
  "value_brl": 1500.00,
  "iss_rate": 0.02,
  "iss_value": 30.00,
  "customer_name": "Cliente Exemplo",
  "created_at": "2026-01-03T12:00:00Z",
  "pdf_url": null,
  "error_message": null
}
```

---

### 2. Check NFS-e Status

Check the processing status of a previously created NFS-e.

**Endpoint:** `GET /api/v1/external/nfse/{reference}`

**Headers:**
| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `X-API-Key` | string | Yes | Your project API key |

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `reference` | string | The NFS-e reference returned when creating |

**Response (200 OK):**

```json
{
  "id": "uuid-of-nfse-record",
  "reference": "EXT-20260103120000-A1B2C3D4",
  "status": "authorized",
  "nfse_number": "202600001",
  "pdf_url": "https://storage.example.com/nfse/xxx.pdf",
  "xml_url": "https://storage.example.com/nfse/xxx.xml",
  "error_message": null,
  "issued_at": "2026-01-03T12:05:00Z"
}
```

---

### 3. Cancel NFS-e

Cancel an authorized NFS-e.

**Endpoint:** `POST /api/v1/external/nfse/{reference}/cancel`

**Headers:**
| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `X-API-Key` | string | Yes | Your project API key |
| `Content-Type` | string | Yes | Must be `application/json` |

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `reference` | string | The NFS-e reference returned when creating |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | **Yes** | Cancellation reason (10-500 characters) |

**Response (200 OK):**

```json
{
  "id": "uuid-of-nfse-record",
  "reference": "EXT-20260103120000-A1B2C3D4",
  "status": "cancelled",
  "cancelled_at": "2026-01-03T14:30:00Z",
  "message": "NFS-e cancelled successfully"
}
```

**Error Responses:**

| Status | Reason |
|--------|--------|
| 400 | NFS-e is not in `authorized` status |
| 400 | NFS-e has no number assigned yet |
| 400 | Cancellation reason too short (min 10 chars) |
| 404 | NFS-e not found |

> **Note:** Only NFS-e with status `authorized` can be cancelled. The cancellation is processed with the municipality and cannot be undone.

---

### 4. List NFS-e Records

List all NFS-e records for your project.

**Endpoint:** `GET /api/v1/external/nfse`

**Headers:**
| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `X-API-Key` | string | Yes | Your project API key |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Maximum number of records to return (max 100) |
| `status_filter` | string | - | Filter by status: `pending`, `processing`, `authorized`, `cancelled`, `error` |

**Response (200 OK):**

```json
[
  {
    "id": "uuid-1",
    "reference": "EXT-20260103120000-A1B2C3D4",
    "status": "authorized",
    "nfse_number": "202600001",
    "pdf_url": "https://...",
    "xml_url": "https://...",
    "error_message": null,
    "issued_at": "2026-01-03T12:05:00Z"
  },
  {
    "id": "uuid-2",
    "reference": "EXT-20260103130000-E5F6G7H8",
    "status": "processing",
    "nfse_number": null,
    "pdf_url": null,
    "xml_url": null,
    "error_message": null,
    "issued_at": null
  }
]
```

---

## NFS-e Status Values

| Status | Description |
|--------|-------------|
| `pending` | NFS-e created, waiting to be processed |
| `processing` | NFS-e is being processed by the municipality |
| `authorized` | NFS-e successfully authorized and issued |
| `cancelled` | NFS-e was cancelled |
| `error` | Processing failed - check `error_message` for details |


---

## Currency Conversion & Compliance

Our integration implements a robust currency conversion and compliance strategy to ensure accurate tax reporting (NFS-e) for both domestic and international customers.

### 1. Stripe Balance Transaction (Primary Source)
The system attempts to retrieve the **exact exchange rate** and **gross BRL amount** directly from Stripe's internal `balance_transaction` record.
- **Why?** This reflects the actual BRL amount that hit the bank account, ensuring 100% financial accuracy.
- **Metadata**: The exchange rate used by Stripe is extracted and logged.

### 2. Official PTAX Fallback (Secondary Source)
If Stripe data is unavailable (e.g., pending balance, specific account setups), the system automatically fetches the **official PTAX exchange rate** from the **Banco Central do Brasil** API.
- **Why?** This is the legal fallback requirement for tax purposes when the exact transaction rate is not available.

### 3. Audit Trail in Description
To ensure transparency for accounting and tax audits, the currency conversion details are explicitly appended to the NFS-e service description.

**Example Format:**
> "Service Description... - Valor original: $15.00 USD - Taxa de Conversão Stripe: R$ 5.3642 - Taxas operacionais: R$ 5.21"

### 4. Resilient Logic Hierarchy
The system uses a multi-layered safety mechanism to guarantee NFS-e generation:
1.  **Stripe Balance**: Exact transaction value + Fee breakdown (Best).
2.  **PTAX API**: Official daily rate (Compliant Fallback).
3.  **Conservative Fallback**: Hardcoded rate (Safety Net for API failures).

### 5. Brazilian Customers Compliance
For customers in Brazil (`customer_country = 'BR'`), the system ensures full tax compliance by:
- **CPF/CNPJ**: Validating and passing the correct tax ID (`customer_document`).
- **Dynamic IBGE Lookup**: Instead of hardcoded lists, the system dynamically queries the Fiscal Nacional API to find the exact **IBGE City Code** for any city/state combination in Brazil.

### 6. Privacy & Notifications (Admin Override)
To maintain control over customer communication, the system **does not** send automated emails from the NFS-e provider to the final customer.
- **Implementation**: The `customer_email` field sent to the API is overridden with your `NFSE_ADMIN_EMAIL` (env var).
- **Result**: You receive the official legal document, allowing you to forward it with your own branding or keep it for internal compliance.

---

## Code Examples

### Python

```python
import requests

API_KEY = "your_project_api_key_here"
BASE_URL = "https://api.fiscalnacional.com.br"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Create NFS-e for Brazilian customer
def create_nfse_brazil(customer_data, service_description, amount):
    payload = {
        "customer_name": customer_data["name"],
        "customer_email": customer_data["email"],
        "customer_country": "BR",
        "customer_document": customer_data["cpf_cnpj"],  # CPF or CNPJ
        "customer_address": customer_data["address"],
        "customer_number": customer_data["number"],
        "customer_neighborhood": customer_data["neighborhood"],
        "customer_postal_code": customer_data["postal_code"],
        "customer_state": customer_data["state"],
        "customer_city_name": customer_data["city"],
        "customer_city_code": customer_data["city_code"],  # IBGE code
        "service_description": service_description,
        "amount": amount,
        "external_reference": f"INV-{customer_data['invoice_id']}"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/v1/external/nfse",
        json=payload,
        headers=headers
    )
    return response.json()

# Create NFS-e for international customer (export)
def create_nfse_international(customer_data, service_description, amount_brl, amount_foreign=None):
    payload = {
        "customer_name": customer_data["name"],
        "customer_email": customer_data["email"],
        "customer_country": customer_data["country"],  # e.g., "US", "DE", "GB"
        "customer_nif": customer_data.get("tax_id"),  # Foreign Tax ID (NIF)
        "customer_address": customer_data.get("address"),
        "customer_number": customer_data.get("number"),
        "customer_city_name": customer_data["city"],
        "customer_state": customer_data["state"],
        "customer_postal_code": customer_data.get("postal_code"),
        "service_description": service_description,
        "amount": amount_brl,
        # Foreign currency fields (optional but recommended for exports)
        "currency_code": customer_data.get("currency_code", "220"),  # 220=USD (BACEN)
        "foreign_currency_amount": amount_foreign,
        "external_reference": f"SUB-{customer_data['subscription_id']}"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/v1/external/nfse",
        json=payload,
        headers=headers
    )
    return response.json()

# Check NFS-e status
def check_nfse_status(reference):
    response = requests.get(
        f"{BASE_URL}/api/v1/external/nfse/{reference}",
        headers=headers
    )
    return response.json()

# Cancel NFS-e
def cancel_nfse(reference, reason):
    response = requests.post(
        f"{BASE_URL}/api/v1/external/nfse/{reference}/cancel",
        json={"reason": reason},
        headers=headers
    )
    return response.json()

# Poll until authorized or error
def wait_for_nfse(reference, max_attempts=30, interval=10):
    import time
    
    for _ in range(max_attempts):
        status = check_nfse_status(reference)
        
        if status["status"] == "authorized":
            return status
        elif status["status"] == "error":
            raise Exception(f"NFS-e failed: {status['error_message']}")
        
        time.sleep(interval)
    
    raise Exception("Timeout waiting for NFS-e")
```

### Node.js / TypeScript

```typescript
const API_KEY = "your_project_api_key_here";
const BASE_URL = "https://api.fiscalnacional.com.br";

interface NFSeRequest {
  customer_name: string;
  customer_email?: string;
  customer_country?: string;
  customer_document?: string;  // CPF/CNPJ for Brazilian customers
  // International customer fields
  customer_nif?: string;       // Foreign Tax ID (NIF)
  nif_exemption_code?: 0 | 1 | 2;  // 0=provided, 1=not required, 2=not provided
  currency_code?: string;      // BACEN code: "220"=USD, "978"=EUR
  foreign_currency_amount?: number;  // Value in foreign currency
  // Address fields
  customer_address?: string;
  customer_number?: string;
  customer_complement?: string;
  customer_neighborhood?: string;
  customer_postal_code?: string;
  customer_state?: string;
  customer_city_name?: string;
  customer_city_code?: number;
  customer_inscricao_municipal?: string;
  service_description: string;
  amount: number;
  external_reference?: string;
}

interface NFSeResponse {
  id: string;
  reference: string;
  status: "pending" | "processing" | "authorized" | "cancelled" | "error";
  nfse_number: string | null;
  value_brl: number;
  iss_rate: number;
  iss_value: number;
  customer_name: string;
  created_at: string;
  pdf_url: string | null;
  error_message: string | null;
}

interface NFSeStatusResponse {
  id: string;
  reference: string;
  status: string;
  nfse_number: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  error_message: string | null;
  issued_at: string | null;
}

// Create NFS-e
async function createNFSe(data: NFSeRequest): Promise<NFSeResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/external/nfse`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create NFS-e");
  }

  return response.json();
}

// Check status
async function checkNFSeStatus(reference: string): Promise<NFSeStatusResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/external/nfse/${reference}`, {
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error("NFS-e not found");
  }

  return response.json();
}

// Example: Create NFS-e for Brazilian customer
async function createBrazilianNFSe() {
  const nfse = await createNFSe({
    customer_name: "João da Silva",
    customer_email: "joao@example.com",
    customer_country: "BR",
    customer_document: "12345678901", // CPF
    customer_address: "Rua das Flores",
    customer_number: "123",
    customer_neighborhood: "Centro",
    customer_postal_code: "89201-000",
    customer_state: "SC",
    customer_city_name: "Joinville",
    customer_city_code: 4209102, // IBGE code for Joinville
    service_description: "Desenvolvimento de software - Plano Mensal",
    amount: 1500.0,
    external_reference: "SUB-2026-001",
  });

  console.log("NFS-e created:", nfse.reference);
  return nfse;
}

// Example: Create NFS-e for international customer (with NIF and foreign currency)
async function createInternationalNFSe() {
  const nfse = await createNFSe({
    customer_name: "Acme Corporation",
    customer_email: "billing@acme.com",
    customer_country: "US",
    customer_nif: "12-3456789",  // US EIN/Tax ID
    customer_address: "123 Silicon Valley Blvd",
    customer_number: "100",
    customer_neighborhood: "Financial District",  // Optional, defaults to "Exterior"
    customer_city_name: "San Francisco",
    customer_state: "CA",
    customer_postal_code: "94105",
    service_description: "SaaS subscription - Professional Plan",
    amount: 299.0,  // Value in BRL
    currency_code: "220",  // USD (BACEN code)
    foreign_currency_amount: 55.0,  // Value in USD
    external_reference: "INV-2026-001",
  });

  console.log("Export NFS-e created:", nfse.reference);
  return nfse;
}
```

### cURL

```bash
# Create NFS-e for Brazilian customer
curl -X POST "https://api.fiscalnacional.com.br/api/v1/external/nfse" \
  -H "X-API-Key: your_project_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "João da Silva",
    "customer_email": "joao@example.com",
    "customer_country": "BR",
    "customer_document": "12345678901",
    "customer_address": "Rua das Flores",
    "customer_number": "123",
    "customer_neighborhood": "Centro",
    "customer_postal_code": "89201-000",
    "customer_state": "SC",
    "customer_city_name": "Joinville",
    "customer_city_code": 4209102,
    "service_description": "Desenvolvimento de software - Plano Mensal",
    "amount": 1500.00,
    "external_reference": "SUB-2026-001"
  }'

# Create NFS-e for international customer (export with NIF and foreign currency)
curl -X POST "https://api.fiscalnacional.com.br/api/v1/external/nfse" \
  -H "X-API-Key: your_project_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Acme Corporation",
    "customer_email": "billing@acme.com",
    "customer_country": "US",
    "customer_nif": "12-3456789",
    "customer_address": "123 Silicon Valley Blvd",
    "customer_number": "100",
    "customer_neighborhood": "Financial District",
    "customer_city_name": "San Francisco",
    "customer_state": "CA",
    "customer_postal_code": "94105",
    "service_description": "SaaS subscription - Professional Plan",
    "amount": 299.00,
    "currency_code": "220",
    "foreign_currency_amount": 55.00,
    "external_reference": "INV-2026-001"
  }'

# Check NFS-e status
curl -X GET "https://api.fiscalnacional.com.br/api/v1/external/nfse/EXT-20260103120000-A1B2C3D4" \
  -H "X-API-Key: your_project_api_key_here"

# List all NFS-e
curl -X GET "https://api.fiscalnacional.com.br/api/v1/external/nfse?limit=50" \
  -H "X-API-Key: your_project_api_key_here"

# Cancel NFS-e
curl -X POST "https://api.fiscalnacional.com.br/api/v1/external/nfse/EXT-20260103120000-A1B2C3D4/cancel" \
  -H "X-API-Key: your_project_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Service was cancelled by customer request"
  }'
```

---

## Common IBGE City Codes

Here are some common IBGE codes for major Brazilian cities:

| City | State | IBGE Code |
|------|-------|-----------|
| São Paulo | SP | 3550308 |
| Rio de Janeiro | RJ | 3304557 |
| Belo Horizonte | MG | 3106200 |
| Curitiba | PR | 4106902 |
| Porto Alegre | RS | 4314902 |
| Florianópolis | SC | 4205407 |
| Joinville | SC | 4209102 |
| Blumenau | SC | 4202404 |
| Brasília | DF | 5300108 |
| Salvador | BA | 2927408 |
| Fortaleza | CE | 2304400 |
| Recife | PE | 2611606 |

You can query the full list via our IBGE API:
```
GET /api/v1/ibge/cities?state=SC
```

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Invalid or missing API key |
| 403 | Forbidden - Company is inactive |
| 404 | Not Found - NFS-e not found |
| 422 | Validation Error - Check error details |
| 500 | Server Error - Contact support |

### Error Response Format

```json
{
  "detail": "Error message description"
}
```

Or for validation errors:

```json
{
  "detail": [
    {
      "loc": ["body", "customer_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## Webhooks (Coming Soon)

Webhook notifications for NFS-e status changes will be available in a future release. Configure your webhook URL in project settings to receive real-time notifications when:

- NFS-e is authorized
- NFS-e processing fails
- NFS-e is cancelled

---

## Best Practices

1. **Store the reference**: Always store the `reference` returned when creating an NFS-e. This is your primary identifier for status checks.

2. **Use external_reference**: Pass your internal invoice/subscription ID in the `external_reference` field for easy cross-referencing.

3. **Handle async processing**: NFS-e generation is asynchronous. After creation, poll the status endpoint or (when available) listen for webhooks.

4. **Brazilian customers require address**: For Brazilian customers, provide complete address information including the IBGE city code.

5. **International = Export**: Any `customer_country` that is not `BR`, `BRAZIL`, or `BRASIL` is treated as an export service. ISS rate is automatically set to 0%.

6. **Retry on errors**: If you receive a 5xx error, implement exponential backoff retry logic.

---

## Rate Limits

| Plan | Requests/minute | NFS-e/month |
|------|-----------------|-------------|
| Free | 10 | 50 |
| Starter | 60 | 500 |
| Professional | 120 | 2,000 |
| Enterprise | Unlimited | Unlimited |

---

## Support

- Documentation: https://docs.fiscalnacional.com.br
- API Status: https://status.fiscalnacional.com.br
- Email: suporte@fiscalnacional.com.br

---

## Testing the API

### Quick Test Script

We provide a test script to validate your integration:

```bash
# From the backend directory
cd backend

# Run the test script with your API key
python scripts/test_external_api.py YOUR_PROJECT_API_KEY

# Or set as environment variable
export NFE_TEST_API_KEY=nfe_xxx
python scripts/test_external_api.py
```

The script will:
1. Test authentication (invalid/missing API key)
2. Test request validation
3. Create a test NFS-e for Brazilian customer
4. Create a test NFS-e for international customer (export)
5. Check status of created NFS-e
6. List all NFS-e records

### Running Backend Tests

```bash
cd backend

# Install test dependencies
uv pip install pytest pytest-asyncio httpx

# Run all tests
uv run pytest tests/ -v

# Run only external API tests
uv run pytest tests/integration/test_external_api.py -v
```

---

## BACEN Currency Codes

For international NFS-e, use BACEN codes (not ISO 4217):

| Currency | BACEN Code | ISO Code |
|----------|------------|----------|
| US Dollar (USD) | 220 | 840 |
| Euro (EUR) | 978 | 978 |
| British Pound (GBP) | 540 | 826 |
| Canadian Dollar (CAD) | 165 | 124 |
| Australian Dollar (AUD) | 150 | 036 |
| Japanese Yen (JPY) | 470 | 392 |
| Swiss Franc (CHF) | 510 | 756 |

> Full list: https://www.bcb.gov.br/estabilidadefinanceira/cotacoestodas

---

## Changelog

### v1.1.0 (2026-01-05)
- Added international customer fields: `customer_nif`, `nif_exemption_code`
- Added foreign currency fields: `currency_code`, `foreign_currency_amount`
- Increased `customer_postal_code` max length to 20 chars for international codes
- Improved export NFS-e support with proper `comExt` (foreign trade) information

### v1.0.0 (2026-01-03)
- Initial release
- Create NFS-e endpoint
- Check status endpoint
- List NFS-e endpoint
- Support for Brazilian and international customers
