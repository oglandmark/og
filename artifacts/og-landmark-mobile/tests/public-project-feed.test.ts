import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePublicProjects } from '../lib/projectFeed';

test('public project feed includes Admin preview projects without replacing unrelated live projects', () => {
  const projects = mergePublicProjects(
    [{ id: 'live-1', name: 'Live project' }, { id: 'same-id', name: 'Old live copy' }],
    [{ id: 'preview-1', name: 'Admin preview project' }, { id: 'same-id', name: 'Admin edit' }],
  );

  assert.deepEqual(projects, [
    { id: 'live-1', name: 'Live project' },
    { id: 'same-id', name: 'Admin edit' },
    { id: 'preview-1', name: 'Admin preview project' },
  ]);
});
