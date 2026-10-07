'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const OWNERSHIP_FIELDS = [
  'userId', 'ownerId', 'createdBy', 'createdByUserId', 'creatorId', 'authorId',
  'buyerId', 'reporterId', 'submittedBy', 'requesterId', 'memberUserId',
];
const REFERENCE_FIELDS = [
  ...OWNERSHIP_FIELDS,
  'sellerId', 'agentId', 'developerId', 'authUserId', 'accountId',
  'recipientUserId', 'forUserId', 'assignedAgentId', 'assignedToUserId',
  'targetUserId', 'subjectUserId', 'reportedUserId', 'contactUserId',
  'linkedUserId', 'actorId', 'senderId', 'senderUserId',
];
const PARTICIPANT_FIELDS = new Set(['participantids', 'participants', 'userids']);
const USER_MAPS = ['savedProperties', 'notificationPreferences', 'userPreferences'];
const DEVELOPER_OWNED_COLLECTIONS = new Set([
  'developerProjects', 'inventoryBlocks', 'inventoryUnits', 'paymentPlans',
  'developerDocuments', 'developerTeam',
]);
const DEVELOPER_CHILD_COLLECTIONS = new Set([
  'inventoryBlocks', 'inventoryUnits', 'paymentPlans', 'developerDocuments',
  'developerTeam', 'developerLeads', 'developerSiteVisits',
]);
const DEVELOPER_OWNER_FIELDS = [...OWNERSHIP_FIELDS, 'developerId', 'sellerId'];
const PROPERTY_OWNER_FIELDS = ['userId', 'ownerId', 'createdBy', 'createdByUserId', 'sellerId', 'developerId'];
const PROPERTY_AGENT_FIELDS = ['agentId', 'assignedAgentId', 'listingAgentId', 'contactAgentId'];
const PROPERTY_AGENT_DETAILS = [
  'agentName', 'agentEmail', 'agentPhone', 'agentPhoto', 'agentImage',
  'agentProfilePhoto', 'agentCoverPhoto', 'assignedAgentName',
  'assignedAgentEmail', 'assignedAgentPhone', 'contactAgentName',
  'contactAgentEmail', 'contactAgentPhone',
];
const RECIPIENT_COLLECTIONS = new Set(['notifications', 'pushDevices']);
const MESSAGE_COLLECTIONS = new Set(['messages', 'chatMessages', 'conversationMessages']);

function normalizedKey(key) {
  return String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function sameId(value, targetId) {
  return value !== null && value !== undefined && String(value) === targetId;
}

function hasMatchingField(record, fields, targetId) {
  return !!record && typeof record === 'object' && !Array.isArray(record)
    && fields.some(field => sameId(record[field], targetId));
}

function participantId(participant) {
  if (participant && typeof participant === 'object') {
    return participant.id ?? participant.userId ?? participant.accountId ?? null;
  }
  return participant;
}

function listContainsId(value, targetId) {
  return Array.isArray(value) && value.some(item => sameId(participantId(item), targetId));
}

function collectIdentity(user) {
  const exact = new Set();
  const text = [];
  if (user && typeof user === 'object') {
    for (const value of [
      user.name, user.displayName, user.username, user.email, user.phone,
      user.mobile, user.profilePhoto, user.coverPhoto, user.photo,
    ]) {
      if (typeof value === 'string' && value.trim()) exact.add(value.trim().toLowerCase());
    }
    for (const value of [user.email, user.phone, user.mobile]) {
      if (typeof value === 'string' && value.trim()) text.push(value.trim());
    }
  }
  return { exact, text };
}

function isPersonalField(key) {
  const normalized = normalizedKey(key);
  return /name|email|phone|mobile|username|photo|image|avatar|pushtoken/.test(normalized);
}

function isPersonalValue(key, value, identity) {
  return isPersonalField(key)
    && typeof value === 'string'
    && identity.exact.has(value.trim().toLowerCase());
}

function redactKnownText(value, identity) {
  let output = value;
  for (const sensitive of identity.text) {
    if (sensitive.includes('@')) {
      output = output.replaceAll(new RegExp(escapeRegExp(sensitive), 'gi'), '[deleted]');
      continue;
    }
    const digits = sensitive.replace(/\D/g, '');
    if (digits.length >= 7) {
      output = output.replace(new RegExp(`(?<!\\d)${escapeRegExp(digits)}(?!\\d)`, 'g'), '[deleted]');
      output = output.replace(new RegExp(`(?<!\\d)${escapeRegExp(sensitive)}(?!\\d)`, 'g'), '[deleted]');
    }
  }
  return output;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scrubReferences(value, targetId, identity, parentKey = '') {
  if (Array.isArray(value)) {
    const key = normalizedKey(parentKey);
    let items = value;
    if (PARTICIPANT_FIELDS.has(key)) {
      items = items.filter(item => !sameId(participantId(item), targetId));
    } else if (key === 'participantnames') {
      items = items.filter(item => !isPersonalValue('name', item, identity));
    } else if (key === 'messages') {
      items = items.filter(item => !hasMatchingField(
        item,
        ['senderId', 'senderUserId', 'authorId', 'userId'],
        targetId,
      ));
    }
    return items.map(item => scrubReferences(item, targetId, identity, parentKey));
  }

  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      const normalized = normalizedKey(key);
      if (REFERENCE_FIELDS.some(field => normalizedKey(field) === normalized) && sameId(child, targetId)) {
        continue;
      }
      if (isPersonalValue(key, child, identity)) continue;
      result[key] = scrubReferences(child, targetId, identity, key);
    }
    return result;
  }

  return typeof value === 'string' ? redactKnownText(value, identity) : value;
}

function isOwnedRecord(record, targetId, extraFields = []) {
  return hasMatchingField(record, [...OWNERSHIP_FIELDS, ...extraFields], targetId);
}

function isLinkedConversation(conversation, targetId) {
  if (hasMatchingField(conversation, REFERENCE_FIELDS, targetId)) return true;
  for (const field of PARTICIPANT_FIELDS) {
    if (listContainsId(conversation?.[field], targetId)) return true;
  }
  return Array.isArray(conversation?.messages) && conversation.messages.some(message =>
    hasMatchingField(message, ['senderId', 'senderUserId', 'authorId', 'userId'], targetId));
}

function cleanConversation(conversation, targetId, identity) {
  const result = { ...conversation };
  const primaryParticipants = result.participantIds ?? result.participants ?? result.userIds;
  const originalParticipants = Array.isArray(primaryParticipants) ? primaryParticipants : [];
  const keptIndexes = originalParticipants
    .map((participant, index) => ({ participant, index }))
    .filter(({ participant }) => !sameId(participantId(participant), targetId));

  for (const field of PARTICIPANT_FIELDS) {
    if (Array.isArray(result[field])) {
      result[field] = result[field].filter(item => !sameId(participantId(item), targetId));
    }
  }

  if (Array.isArray(result.participantNames)) {
    if (result.participantNames.length === originalParticipants.length && originalParticipants.length > 0) {
      result.participantNames = keptIndexes.map(({ index }) => result.participantNames[index]);
    } else {
      result.participantNames = result.participantNames
        .filter(name => !isPersonalValue('name', name, identity));
    }
  }

  if (Array.isArray(result.messages)) {
    result.messages = result.messages
      .filter(message => !hasMatchingField(
        message,
        ['senderId', 'senderUserId', 'authorId', 'userId'],
        targetId,
      ))
      .map(message => scrubReferences(message, targetId, identity));
  }

  const cleaned = scrubReferences(result, targetId, identity);
  const remainingParticipants = new Set();
  for (const field of PARTICIPANT_FIELDS) {
    for (const participant of Array.isArray(cleaned[field]) ? cleaned[field] : []) {
      const id = participantId(participant);
      if (id !== null && id !== undefined && String(id) !== '') remainingParticipants.add(String(id));
    }
  }
  for (const message of Array.isArray(cleaned.messages) ? cleaned.messages : []) {
    const sender = message.senderId ?? message.senderUserId ?? message.authorId;
    if (sender !== null && sender !== undefined) remainingParticipants.add(String(sender));
  }

  if (remainingParticipants.size < 2 || !Array.isArray(cleaned.messages) || cleaned.messages.length === 0) {
    return null;
  }
  const lastMessage = cleaned.messages[cleaned.messages.length - 1];
  cleaned.lastMessage = lastMessage.text ?? lastMessage.message ?? '';
  cleaned.lastMessageAt = lastMessage.createdAt ?? lastMessage.timestamp ?? null;
  return cleaned;
}

function cleanProperties(properties, targetId, identity, deletedProjectIds) {
  if (!Array.isArray(properties)) return [];
  return properties.flatMap(property => {
    if (!property || typeof property !== 'object' || Array.isArray(property)) return [property];
    if (isOwnedRecord(property, targetId, PROPERTY_OWNER_FIELDS)) return [];
    if (deletedProjectIds.has(String(property.projectId ?? ''))) return [];

    const assignedToDeletedAgent = PROPERTY_AGENT_FIELDS.some(field => sameId(property[field], targetId));
    const hasOtherOwner = PROPERTY_OWNER_FIELDS.some(field =>
      property[field] !== null
      && property[field] !== undefined
      && !sameId(property[field], targetId));
    if (assignedToDeletedAgent && !hasOtherOwner) return [];

    const cleaned = scrubReferences(property, targetId, identity);
    if (assignedToDeletedAgent) {
      for (const field of PROPERTY_AGENT_DETAILS) delete cleaned[field];
    }
    return [cleaned];
  });
}

function cleanConversations(conversations, targetId, identity) {
  if (!Array.isArray(conversations)) return [];
  return conversations.flatMap(conversation => {
    if (!conversation || typeof conversation !== 'object' || Array.isArray(conversation)) {
      return [conversation];
    }
    if (!isLinkedConversation(conversation, targetId)) return [conversation];
    const cleaned = cleanConversation(conversation, targetId, identity);
    return cleaned ? [cleaned] : [];
  });
}

function collectUploadPaths(value, paths = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectUploadPaths(item, paths);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectUploadPaths(item, paths);
  } else if (typeof value === 'string') {
    const uploadPath = safeUploadPath(value);
    if (uploadPath) paths.add(uploadPath);
  }
  return paths;
}

function safeUploadPath(value) {
  try {
    const parsed = new URL(String(value), 'https://oglandmark.invalid');
    const pathname = decodeURIComponent(parsed.pathname);
    const prefix = '/images/uploads/';
    if (!pathname.startsWith(prefix)) return null;
    const filename = pathname.slice(prefix.length);
    if (!filename || filename.includes('/') || filename === '.' || filename === '..') return null;
    return prefix + filename;
  } catch {
    return null;
  }
}

function deleteAccountData(document, userId) {
  const targetId = String(userId);
  const data = JSON.parse(JSON.stringify(document || {}));
  const previousUploads = collectUploadPaths(data);
  const user = Array.isArray(data.users)
    ? data.users.find(item => sameId(item?.id, targetId))
    : null;
  const identity = collectIdentity(user);

  const ownedProjects = Array.isArray(data.developerProjects)
    ? data.developerProjects.filter(project => isOwnedRecord(project, targetId, ['developerId', 'sellerId']))
    : [];
  const deletedProjectIds = new Set(ownedProjects
    .map(project => project?.id)
    .filter(id => id !== null && id !== undefined)
    .map(String));

  data.users = Array.isArray(data.users)
    ? data.users.filter(item => !sameId(item?.id, targetId))
    : [];
  data.properties = cleanProperties(data.properties, targetId, identity, deletedProjectIds);
  data.conversations = cleanConversations(data.conversations, targetId, identity);

  for (const key of ['mobileAgents', 'cityAgents', 'agents', 'hiddenReactAgents']) {
    if (Array.isArray(data[key])) {
      data[key] = data[key].filter(item =>
        !hasMatchingField(item, ['authUserId', 'userId', 'accountId'], targetId)
        && !['email', 'phone', 'mobile'].some(field =>
          isPersonalValue(field, item?.[field], identity)));
      data[key] = data[key].map(item => scrubReferences(item, targetId, identity));
    }
  }

  for (const key of USER_MAPS) {
    if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
      delete data[key][targetId];
    } else if (Array.isArray(data[key])) {
      data[key] = data[key]
        .filter(item => !isOwnedRecord(item, targetId))
        .map(item => scrubReferences(item, targetId, identity));
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value) || [
      'users', 'properties', 'conversations', 'mobileAgents', 'cityAgents',
      'agents', 'hiddenReactAgents', ...USER_MAPS,
    ].includes(key)) {
      continue;
    }

    if (key === 'notificationEvents') {
      data[key] = value.filter(event =>
        typeof event !== 'string' || !event.startsWith(`${targetId}:`));
      continue;
    }

    data[key] = value.flatMap(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [item];
      const extraOwnerFields = DEVELOPER_OWNED_COLLECTIONS.has(key)
        ? ['developerId', 'sellerId']
        : [];
      if (isOwnedRecord(item, targetId, extraOwnerFields)) return [];
      if (MESSAGE_COLLECTIONS.has(key)
        && hasMatchingField(item, ['senderId', 'senderUserId', 'authorId'], targetId)) return [];
      if (RECIPIENT_COLLECTIONS.has(key)
        && hasMatchingField(item, ['recipientUserId', 'forUserId'], targetId)) return [];
      if (DEVELOPER_CHILD_COLLECTIONS.has(key)
        && deletedProjectIds.has(String(item.projectId ?? ''))) return [];
      return [scrubReferences(item, targetId, identity)];
    });
  }

  const remainingUploads = collectUploadPaths(data);
  const removedUploadPaths = [...previousUploads].filter(uploadPath => !remainingUploads.has(uploadPath));
  return { data, removedUploadPaths };
}

async function removeUnreferencedAccountMedia(data, candidatePaths, storageDirectory) {
  const stillReferenced = collectUploadPaths(data);
  const root = path.resolve(storageDirectory);
  const failedPaths = [];

  for (const uploadPath of new Set(candidatePaths || [])) {
    if (stillReferenced.has(uploadPath)) continue;
    const filename = safeUploadPath(uploadPath)?.slice('/images/uploads/'.length);
    if (!filename) continue;
    const filePath = path.resolve(root, filename);
    const relative = path.relative(root, filePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue;
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') failedPaths.push(uploadPath);
    }
  }

  return failedPaths;
}

module.exports = {
  deleteAccountData,
  removeUnreferencedAccountMedia,
};
