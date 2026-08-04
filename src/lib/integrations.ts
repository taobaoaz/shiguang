export const SHIGUANG_INTEGRATIONS = {
  ai: {
    id: 'ai-connection',
    label: 'AI 接入',
    backendCapability: 'work-state-ai-provider',
    configurationOwner: 'nodegateway',
    credentialOwner: 'nodegateway',
    directConnectionAllowed: false,
    lifecycleState: 'pending',
  },
  cos: {
    id: 'cos-connection',
    label: 'COS 接入',
    backendCapability: 'shiguang-workspace-sync',
    configurationOwner: 'nodegateway',
    credentialOwner: 'nodegateway',
    directConnectionAllowed: false,
    lifecycleState: 'active',
  },
} as const;
