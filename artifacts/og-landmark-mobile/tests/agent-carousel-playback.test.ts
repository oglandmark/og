import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_CARD_SCROLL_STEP,
  AGENT_MARQUEE_SPEED_PX_PER_SECOND,
  getAgentMarqueeDurationMs,
} from '../lib/agentCarouselPlayback';

test('Agent marquee moves at a steady, measured speed', () => {
  assert.equal(AGENT_CARD_SCROLL_STEP, 264);
  assert.equal(AGENT_MARQUEE_SPEED_PX_PER_SECOND, 28);
  assert.equal(getAgentMarqueeDurationMs(2), 18_857);
  assert.equal(getAgentMarqueeDurationMs(1), 0);
  assert.equal(getAgentMarqueeDurationMs(0), 0);
});
