// System agent uses static avatar
export const SYSTEM_TUNA_ID = "00000000-0000-0000-0000-000000000001";
export const SYSTEM_TUNA_AVATAR = "/images/system-tuna-avatar.png";

/**
 * Get avatar URL for an agent
 * Priority: agent.avatar_url > first launched token image > fallback null (use initial)
 */
export function getAgentAvatarUrl(
  agentId: string,
  agentAvatarUrl?: string | null,
  tokenImageUrl?: string | null
): string | null {
  // SystemTUNA always uses the static avatar
  if (agentId === SYSTEM_TUNA_ID) {
    return SYSTEM_TUNA_AVATAR;
  }
  // Use agent's own avatar if set
  if (agentAvatarUrl) {
    return agentAvatarUrl;
  }
  // Fall back to token image
  if (tokenImageUrl) {
    return tokenImageUrl;
  }
  return null;
}
