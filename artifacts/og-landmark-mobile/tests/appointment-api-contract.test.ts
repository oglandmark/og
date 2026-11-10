import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { toApiAppointmentTime } from '../lib/appointmentTime';

const propertyScreen = readFileSync(new URL('../app/property/[id].tsx', import.meta.url), 'utf8');
const apiClient = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8');

test('visit picker labels convert to Laravel 24-hour time values', () => {
  assert.equal(toApiAppointmentTime('9:00 AM'), '09:00');
  assert.equal(toApiAppointmentTime('12:00 PM'), '12:00');
  assert.equal(toApiAppointmentTime('2:00 PM'), '14:00');
  assert.equal(toApiAppointmentTime('12:00 AM'), '00:00');
  assert.throws(() => toApiAppointmentTime('13:00 PM'), /valid appointment time/i);
});

test('standalone and combined booking flows use the API time format', () => {
  assert.equal(
    (propertyScreen.match(/time:\s*toApiAppointmentTime\(selectedTime\)/g) || []).length,
    2,
  );
});

test('API requests ask for JSON and report HTML responses clearly', () => {
  assert.match(apiClient, /Accept:\s*'application\/json'/);
  assert.match(apiClient, /server returned a page instead of API data/i);
  assert.match(apiClient, /res\.status === 204/);
});
