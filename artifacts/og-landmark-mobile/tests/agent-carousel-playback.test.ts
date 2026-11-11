import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_CAROUSEL_INTERVAL_MS,
  AGENT_CARD_SCROLL_STEP,
  getNextAgentCardIndex,
} from '../lib/agentCarouselPlayback';

test('Agent carousel advances one card at a time and wraps to the first', () => {
  assert.equal(getNextAgentCardIndex(0, 3), 1);
  assert.equal(getNextAgentCardIndex(1, 3), 2);
  assert.equal(getNextAgentCardIndex(2, 3), 0);
});

test('Agent carousel does not advance when there is one or no card', () => {
  assert.equal(getNextAgentCardIndex(0, 1), 0);
  assert.equal(getNextAgentCardIndex(0, 0), 0);
});

test('Agent carousel uses a modest interval and the card layout step', () => {
  assert.equal(AGENT_CAROUSEL_INTERVAL_MS, 5600);
  assert.equal(AGENT_CARD_SCROLL_STEP, 264);
});
