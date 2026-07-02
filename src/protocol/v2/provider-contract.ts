/**
 * ProviderContract types — content_block_mapping for manifest-driven encoding.
 *
 * 与 ai-protocol `schemas/v2/provider-contract.json` 对齐的子集。
 * PT-079 / ALT-DOC-001
 */

/** Document block mapping per PT-079-R1 schema. */
export interface DocumentBlockMapping {
  format: string;
  type_field?: string;
  default_mime_type?: string;
  ref_resolution?: string;
}

export interface ContentBlockMapping {
  text?: Record<string, string>;
  image?: Record<string, string>;
  document?: DocumentBlockMapping;
}

export interface RequestMappingContract {
  message_format: string;
  role_mapping?: Record<string, string>;
  content_block_mapping?: ContentBlockMapping;
}

/** Parsed ProviderContract (encoding-relevant fields). */
export interface ProviderContract {
  contract_version: string;
  provider_id: string;
  api_style: string;
  request_mapping: RequestMappingContract;
}

export function defaultMime(mapping: DocumentBlockMapping): string {
  return mapping.default_mime_type ?? 'application/pdf';
}

export function rejectsRefBeforeEncode(mapping: DocumentBlockMapping): boolean {
  return (mapping.ref_resolution ?? 'error_before_encode') === 'error_before_encode';
}

function parseDocumentMapping(raw: unknown): DocumentBlockMapping | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.format !== 'string') return undefined;
  return {
    format: obj.format,
    type_field: typeof obj.type_field === 'string' ? obj.type_field : undefined,
    default_mime_type:
      typeof obj.default_mime_type === 'string' ? obj.default_mime_type : undefined,
    ref_resolution: typeof obj.ref_resolution === 'string' ? obj.ref_resolution : undefined,
  };
}

function parseContentBlockMapping(raw: unknown): ContentBlockMapping | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    text: obj.text as Record<string, string> | undefined,
    image: obj.image as Record<string, string> | undefined,
    document: parseDocumentMapping(obj.document),
  };
}

/** Parse ProviderContract from decoded YAML/JSON object. */
export function parseProviderContract(data: unknown): ProviderContract {
  if (!data || typeof data !== 'object') {
    throw new Error('ProviderContract must be an object');
  }
  const obj = data as Record<string, unknown>;
  const requestMapping = obj.request_mapping;
  if (!requestMapping || typeof requestMapping !== 'object') {
    throw new Error('ProviderContract missing request_mapping');
  }
  const rm = requestMapping as Record<string, unknown>;
  if (typeof rm.message_format !== 'string') {
    throw new Error('ProviderContract request_mapping.message_format must be a string');
  }
  if (typeof obj.contract_version !== 'string' || typeof obj.provider_id !== 'string') {
    throw new Error('ProviderContract missing contract_version or provider_id');
  }
  if (typeof obj.api_style !== 'string') {
    throw new Error('ProviderContract missing api_style');
  }
  return {
    contract_version: obj.contract_version,
    provider_id: obj.provider_id,
    api_style: obj.api_style,
    request_mapping: {
      message_format: rm.message_format,
      role_mapping: rm.role_mapping as Record<string, string> | undefined,
      content_block_mapping: parseContentBlockMapping(rm.content_block_mapping),
    },
  };
}
