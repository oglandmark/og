import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUBLIC_CONTACT_PHONE,
  PUBLIC_CONTACT_PHONE_E164,
  PUBLIC_CONTACT_WHATSAPP,
  publicWhatsAppUrl,
} from '../lib/publicContact';

test('public contact actions share the OG Landmark number', () => {
  assert.equal(PUBLIC_CONTACT_PHONE, '03011484303');
  assert.equal(PUBLIC_CONTACT_PHONE_E164, '+923011484303');
  assert.equal(PUBLIC_CONTACT_WHATSAPP, '923011484303');
});

test('WhatsApp messages use the public number and are URL encoded', () => {
  assert.equal(
    publicWhatsAppUrl('I am interested in a house & land'),
    'https://wa.me/923011484303?text=I%20am%20interested%20in%20a%20house%20%26%20land',
  );
  assert.equal(publicWhatsAppUrl(), 'https://wa.me/923011484303');
});
