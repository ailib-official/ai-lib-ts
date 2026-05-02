import type { AuthConfig, ProtocolManifest } from '../protocol/manifest.js';

export type CredentialSourceKind =
  | 'explicit'
  | 'manifest_env'
  | 'conventional_env'
  | 'keyring'
  | 'none';

export interface ResolvedCredential {
  value?: string;
  sourceKind: CredentialSourceKind;
  sourceName?: string;
  requiredEnvVars: string[];
  conventionalEnvVars: string[];
}

export interface AuthMetadata {
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  sourceKind: CredentialSourceKind;
  sourceName?: string;
}

export const REDACTED = '<redacted>';

export function providerId(manifest: ProtocolManifest): string {
  return manifest.id;
}

export function primaryAuth(manifest: ProtocolManifest): AuthConfig | undefined {
  const endpointAuth = manifest.endpoint?.auth;
  return endpointAuth ?? manifest.auth;
}

export function shadowedAuth(manifest: ProtocolManifest): AuthConfig | undefined {
  const endpointAuth = manifest.endpoint?.auth;
  const topLevelAuth = manifest.auth;
  if (!endpointAuth || !topLevelAuth) return undefined;
  if (authSignature(endpointAuth) === authSignature(topLevelAuth)) return undefined;
  return topLevelAuth;
}

export function requiredEnvVars(manifest: ProtocolManifest): string[] {
  const auth = primaryAuth(manifest);
  const out = [auth?.token_env, auth?.key_env, auth?.env_var].filter(
    (v): v is string => Boolean(v)
  );
  return [...new Set(out)];
}

export function conventionalEnvVars(manifest: ProtocolManifest): string[] {
  return [`${providerId(manifest).toUpperCase().replace(/-/g, '_')}_API_KEY`];
}

export function resolveCredential(
  manifest: ProtocolManifest,
  explicitCredential?: string,
  env: Record<string, string | undefined> = process.env
): ResolvedCredential {
  const required = requiredEnvVars(manifest);
  const conventional = conventionalEnvVars(manifest);

  if (explicitCredential) {
    return {
      value: explicitCredential,
      sourceKind: 'explicit',
      sourceName: 'explicit',
      requiredEnvVars: required,
      conventionalEnvVars: conventional,
    };
  }

  for (const name of required) {
    const value = env[name];
    if (value) {
      return {
        value,
        sourceKind: 'manifest_env',
        sourceName: name,
        requiredEnvVars: required,
        conventionalEnvVars: conventional,
      };
    }
  }

  for (const name of conventional) {
    const value = env[name];
    if (value) {
      return {
        value,
        sourceKind: 'conventional_env',
        sourceName: name,
        requiredEnvVars: required,
        conventionalEnvVars: conventional,
      };
    }
  }

  return {
    sourceKind: 'none',
    requiredEnvVars: required,
    conventionalEnvVars: conventional,
  };
}

export function buildAuthMetadata(
  manifest: ProtocolManifest,
  credential: ResolvedCredential,
  options: { redacted?: boolean } = {}
): AuthMetadata {
  const headers: Record<string, string> = {};
  const queryParams: Record<string, string> = {};
  const auth = primaryAuth(manifest);
  if (!auth || !credential.value) {
    return { headers, queryParams, sourceKind: credential.sourceKind, sourceName: credential.sourceName };
  }

  const value = options.redacted ? REDACTED : credential.value;
  switch (auth.type) {
    case 'query_param': {
      queryParams[auth.param_name ?? 'api_key'] = value;
      break;
    }
    case 'api_key':
    case 'custom_header':
    case 'header': {
      headers[auth.header ?? auth.header_name ?? 'x-api-key'] = value;
      break;
    }
    case 'bearer':
    default: {
      const prefix = auth.prefix ?? 'Bearer ';
      headers[auth.header ?? auth.header_name ?? 'Authorization'] = `${prefix}${value}`;
      break;
    }
  }

  return { headers, queryParams, sourceKind: credential.sourceKind, sourceName: credential.sourceName };
}

export function diagnosticText(manifest: ProtocolManifest, credential: ResolvedCredential): string {
  const parts = [
    `Credential missing for provider ${providerId(manifest)}`,
    credential.requiredEnvVars.length > 0
      ? `required env: ${credential.requiredEnvVars.join(', ')}`
      : undefined,
    credential.conventionalEnvVars.length > 0
      ? `conventional fallback: ${credential.conventionalEnvVars.join(', ')}`
      : undefined,
  ].filter(Boolean);
  return parts.join('; ');
}

function authSignature(auth: AuthConfig): string {
  return JSON.stringify({
    type: auth.type ?? '',
    header: auth.header ?? auth.header_name ?? '',
    tokenEnv: auth.token_env ?? '',
    keyEnv: auth.key_env ?? auth.env_var ?? '',
    paramName: auth.param_name ?? '',
    prefix: auth.prefix ?? '',
  });
}
