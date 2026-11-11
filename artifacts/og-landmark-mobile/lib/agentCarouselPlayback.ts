export const AGENT_CAROUSEL_INTERVAL_MS = 5600;
export const AGENT_CARD_SCROLL_STEP = 264;

export function getNextAgentCardIndex(currentIndex: number, agentCount: number): number {
  if (agentCount <= 1) return 0;
  const safeIndex = Math.max(0, Math.min(agentCount - 1, Math.floor(currentIndex)));
  return (safeIndex + 1) % agentCount;
}
