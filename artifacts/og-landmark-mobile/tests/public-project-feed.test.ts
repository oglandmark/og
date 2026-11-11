import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mergePublicProjects } from '../lib/projectFeed';

const developerStore = readFileSync(new URL('../lib/developerStore.ts', import.meta.url), 'utf8');

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

test('Mobile public projects merge local Admin records with the live API feed', () => {
  assert.ok(developerStore.includes("apiRequest<DeveloperProject[]>('/api/projects'"));
  assert.ok(developerStore.includes("getLocalPreviewWebApiData<DeveloperProject[]>('/projects'"));
  assert.match(developerStore, /mergePublicProjects\(/);
});
