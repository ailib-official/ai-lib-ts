/**
 * Protocol V2 module
 */

export type {
  ManifestV2,
  ApiStyle,
  AuthConfigV2,
  EndpointV2,
  ModelDef,
  StreamingV2,
  McpConfig,
  ComputerUseConfig,
  MultimodalConfig,
} from './types.js';

export {
  parseManifestV2,
  loadManifestV2FromUrl,
  loadManifestV2FromPath,
} from './loader.js';

export {
  anthropicMessagesContract,
  geminiGenerateContract,
  contractForApiStyle,
} from './contracts.js';

export {
  parseProviderContract,
  defaultMime,
  rejectsRefBeforeEncode,
} from './provider-contract.js';
export type {
  ProviderContract,
  RequestMappingContract,
  ContentBlockMapping,
  DocumentBlockMapping,
} from './provider-contract.js';
