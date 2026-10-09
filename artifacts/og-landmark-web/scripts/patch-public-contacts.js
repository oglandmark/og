const PUBLIC_CONTACT_REPLACEMENTS = [
  ['0304 2569000', '03011484303'],
  ['03042569000', '03011484303'],
  ['923042569000', '923011484303'],
  ['+92 300 1234567', '+923011484303'],
  ['923001234567', '923011484303'],
];

function patchPublicContacts(bundle) {
  return PUBLIC_CONTACT_REPLACEMENTS.reduce(
    (patched, [oldValue, newValue]) => patched.replaceAll(oldValue, newValue),
    bundle,
  );
}

module.exports = patchPublicContacts;
