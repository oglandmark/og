'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  deleteAccountData,
  removeUnreferencedAccountMedia,
} = require('../account-data-deletion');

test('removes the account private data and unlinks shared records without keeping its identifiers', () => {
  const source = {
    users: [
      { id: 41, name: 'Ayesha Malik', email: 'ayesha@example.com', phone: '+92 300 1112233', profilePhoto: '/images/uploads/profile.jpg' },
      { id: 99, name: 'Other User', email: 'other@example.com' },
    ],
    properties: [
      { id: 1, sellerId: 41, title: 'Ayesha listing', images: ['/images/uploads/owned.jpg'] },
      { id: 2, sellerId: 99, agentId: 41, agentName: 'Ayesha Malik', agentPhone: '+92 300 1112233', images: ['/images/uploads/shared.jpg'] },
      { id: 3, sellerId: 99, agentId: 99, images: ['/images/uploads/shared.jpg'] },
    ],
    mobileAgents: [
      { id: 'agent-41', authUserId: 41, displayName: 'Ayesha Malik', profilePhoto: '/images/uploads/agent.jpg' },
      { id: 'agent-99', authUserId: 99, displayName: 'Other User' },
    ],
    savedProperties: { 41: [1], 99: [3] },
    savedSearches: [{ id: 'saved-41', userId: 41 }, { id: 'saved-99', userId: 99 }],
    notificationPreferences: { 41: { email: true }, 99: { email: false } },
    notifications: [
      { id: 'notice-41', recipientUserId: 41 },
      { id: 'notice-99', recipientUserId: 99 },
    ],
    notificationEvents: ['41:property:1', '99:property:3'],
    pushDevices: [{ id: 'device-41', userId: 41 }, { id: 'device-99', userId: 99 }],
    inquiries: [
      { id: 'inquiry-41', buyerId: 41, sellerId: 99, email: 'ayesha@example.com', message: 'Please contact me at ayesha@example.com' },
      { id: 'inquiry-99', buyerId: 99, sellerId: 41, sellerName: 'Ayesha Malik', sellerPhone: '+92 300 1112233', message: 'Please contact the seller' },
    ],
    conversations: [
      {
        id: 'one-to-one',
        participantIds: [41, 99],
        participantNames: ['Ayesha Malik', 'Other User'],
        messages: [
          { senderId: 41, senderName: 'Ayesha Malik', text: 'My email is ayesha@example.com' },
          { senderId: 99, senderName: 'Other User', text: 'Understood' },
        ],
      },
      {
        id: 'group',
        participantIds: [41, 99, 100],
        participantNames: ['Ayesha Malik', 'Other User', 'Third User'],
        messages: [
          { senderId: 41, text: 'I will leave this group' },
          { senderId: 99, text: 'Still here' },
          { senderId: 100, text: 'Me too' },
        ],
      },
    ],
    developerProjects: [{ id: 'project-41', developerId: 41 }, { id: 'project-99', developerId: 99 }],
    inventoryUnits: [{ id: 'unit-41', projectId: 'project-41' }, { id: 'unit-99', projectId: 'project-99' }],
    reports: [{ id: 'report-41', reporterId: 41 }, { id: 'report-99', reporterId: 99 }],
    messages: [
      { id: 'message-41', senderId: 41, text: 'Ayesha message' },
      { id: 'message-99', senderId: 99, text: 'Other message' },
    ],
  };

  const { data, removedUploadPaths } = deleteAccountData(source, '41');

  assert.deepEqual(data.users.map(user => user.id), [99]);
  assert.deepEqual(data.properties.map(property => property.id), [2, 3]);
  assert.equal(data.properties[0].agentId, undefined);
  assert.equal(data.properties[0].agentName, undefined);
  assert.equal(data.properties[0].agentPhone, undefined);
  assert.equal(data.savedProperties[41], undefined);
  assert.deepEqual(data.savedSearches.map(item => item.id), ['saved-99']);
  assert.equal(data.notificationPreferences[41], undefined);
  assert.deepEqual(data.notifications.map(item => item.id), ['notice-99']);
  assert.deepEqual(data.notificationEvents, ['99:property:3']);
  assert.deepEqual(data.pushDevices.map(item => item.id), ['device-99']);
  assert.deepEqual(data.inquiries.map(item => item.id), ['inquiry-99']);
  assert.equal(data.inquiries[0].sellerId, undefined);
  assert.equal(data.inquiries[0].sellerName, undefined);
  assert.equal(data.inquiries[0].sellerPhone, undefined);
  assert.deepEqual(data.conversations.map(item => item.id), ['group']);
  assert.deepEqual(data.conversations[0].participantIds, [99, 100]);
  assert.deepEqual(data.conversations[0].messages.map(message => message.senderId), [99, 100]);
  assert.deepEqual(data.developerProjects.map(project => project.id), ['project-99']);
  assert.deepEqual(data.inventoryUnits.map(unit => unit.id), ['unit-99']);
  assert.deepEqual(data.reports.map(report => report.id), ['report-99']);
  assert.deepEqual(data.messages.map(message => message.id), ['message-99']);
  assert.equal(JSON.stringify(data).includes('ayesha@example.com'), false);
  assert.equal(JSON.stringify(data).includes('Ayesha Malik'), false);
  assert.deepEqual(new Set(removedUploadPaths), new Set([
    '/images/uploads/profile.jpg',
    '/images/uploads/owned.jpg',
    '/images/uploads/agent.jpg',
  ]));
  assert.equal(source.users.length, 2, 'the input document is not mutated');
});

test('deletes only account uploads that are no longer referenced', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'og-account-delete-'));
  const orphanPath = path.join(directory, 'orphan.jpg');
  const sharedPath = path.join(directory, 'shared.jpg');
  await fs.writeFile(orphanPath, 'orphan');
  await fs.writeFile(sharedPath, 'shared');

  try {
    const failures = await removeUnreferencedAccountMedia(
      { properties: [{ images: ['/images/uploads/shared.jpg'] }] },
      ['/images/uploads/orphan.jpg', '/images/uploads/shared.jpg'],
      directory,
    );
    assert.deepEqual(failures, []);
    await assert.rejects(fs.access(orphanPath));
    await fs.access(sharedPath);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
