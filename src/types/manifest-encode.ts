/**
 * Manifest-driven ContentBlock encoding (PT-079 / ALT-DOC-001).
 *
 * 按 ProviderContract `content_block_mapping` 将统一 ContentBlock 编码为厂商 wire JSON。
 */

import {
  anthropicMessagesContract,
  contractForApiStyle,
  geminiGenerateContract,
} from '../protocol/v2/contracts.js';
import {
  defaultMime,
  rejectsRefBeforeEncode,
  type DocumentBlockMapping,
  type ProviderContract,
} from '../protocol/v2/provider-contract.js';

export type EncodeBlock = Record<string, unknown>;
export type EncodedWire = Record<string, unknown>;

function documentMapping(contract: ProviderContract): DocumentBlockMapping {
  const mapping = contract.request_mapping.content_block_mapping;
  if (!mapping?.document) {
    throw new Error(
      `ProviderContract ${contract.provider_id} missing content_block_mapping.document`,
    );
  }
  return mapping.document;
}

/** Encode blocks using the embedded Anthropic Messages ProviderContract. */
export function encodeBlocksAnthropic(
  contract: ProviderContract,
  blocks: EncodeBlock[],
): EncodedWire[] {
  if (contract.api_style !== 'anthropic_messages') {
    throw new Error(`expected anthropic_messages contract, got ${contract.api_style}`);
  }
  const docMapping = documentMapping(contract);
  return blocks.map((block) => encodeAnthropicBlock(block, docMapping));
}

/** Encode blocks using the embedded Gemini generateContent ProviderContract. */
export function encodeBlocksGemini(
  contract: ProviderContract,
  blocks: EncodeBlock[],
): EncodedWire[] {
  if (contract.api_style !== 'gemini_generate') {
    throw new Error(`expected gemini_generate contract, got ${contract.api_style}`);
  }
  const docMapping = documentMapping(contract);
  return blocks.map((block) => encodeGeminiBlock(block, docMapping));
}

/** Convenience: load embedded Anthropic contract and encode. */
export function encodeBlocksForAnthropicContract(blocks: EncodeBlock[]): EncodedWire[] {
  return encodeBlocksAnthropic(anthropicMessagesContract(), blocks);
}

/** Convenience: load embedded Gemini contract and encode. */
export function encodeBlocksForGeminiContract(blocks: EncodeBlock[]): EncodedWire[] {
  return encodeBlocksGemini(geminiGenerateContract(), blocks);
}

/** Encode blocks for a driver API style via embedded contract. */
export function encodeBlocksForApiStyle(apiStyle: string, blocks: EncodeBlock[]): EncodedWire[] {
  const contract = contractForApiStyle(apiStyle);
  if (apiStyle === 'anthropic_messages') {
    return encodeBlocksAnthropic(contract, blocks);
  }
  if (apiStyle === 'gemini_generate') {
    return encodeBlocksGemini(contract, blocks);
  }
  throw new Error(`unsupported api_style: ${apiStyle}`);
}

function encodeAnthropicBlock(block: EncodeBlock, docMapping: DocumentBlockMapping): EncodedWire {
  const blockType = String(block.block_type ?? 'text');
  if (blockType === 'text') {
    return { type: 'text', text: String(block.text ?? '') };
  }
  if (blockType !== 'document') {
    throw new Error(`unsupported block_type: ${blockType}`);
  }
  return encodeAnthropicDocument(block, docMapping);
}

function encodeAnthropicDocument(
  block: EncodeBlock,
  mapping: DocumentBlockMapping,
): EncodedWire {
  if (mapping.format !== 'anthropic_document') {
    throw new Error(`unsupported document format for Anthropic: ${mapping.format}`);
  }
  const sourceType = String(block.source_type ?? 'base64');
  if (sourceType === 'ref' && rejectsRefBeforeEncode(mapping)) {
    throw new Error(
      'document ref must be resolved to base64 or url before sending to Anthropic',
    );
  }
  if (sourceType !== 'base64') {
    throw new Error(`unsupported document source_type: ${sourceType}`);
  }
  const typeField = mapping.type_field ?? 'document';
  return {
    type: typeField,
    source: {
      type: 'base64',
      media_type: String(block.mime_type ?? defaultMime(mapping)),
      data: String(block.data ?? ''),
    },
  };
}

function encodeGeminiBlock(block: EncodeBlock, docMapping: DocumentBlockMapping): EncodedWire {
  const blockType = String(block.block_type ?? 'text');
  if (blockType === 'text') {
    return { text: String(block.text ?? '') };
  }
  if (blockType !== 'document') {
    throw new Error(`unsupported block_type: ${blockType}`);
  }
  return encodeGeminiDocument(block, docMapping);
}

function encodeGeminiDocument(block: EncodeBlock, mapping: DocumentBlockMapping): EncodedWire {
  if (mapping.format !== 'gemini_inline_data') {
    throw new Error(`unsupported document format for Gemini: ${mapping.format}`);
  }
  const sourceType = String(block.source_type ?? 'base64');
  if (sourceType === 'ref' && rejectsRefBeforeEncode(mapping)) {
    throw new Error('Gemini document blocks require base64 inline data; resolve ref before send');
  }
  if (sourceType !== 'base64') {
    throw new Error(`unsupported document source_type: ${sourceType}`);
  }
  return {
    inlineData: {
      mimeType: String(block.mime_type ?? defaultMime(mapping)),
      data: String(block.data ?? ''),
    },
  };
}
