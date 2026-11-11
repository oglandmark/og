export const AGENT_CARD_SCROLL_STEP = 264;
export const AGENT_MARQUEE_SPEED_PX_PER_SECOND = 28;

export function getAgentMarqueeDurationMs(agentCount: number): number {
  if (agentCount <= 1) return 0;
  const cycleWidth = agentCount * AGENT_CARD_SCROLL_STEP;
  return Math.round((cycleWidth / AGENT_MARQUEE_SPEED_PX_PER_SECOND) * 1000);
}
