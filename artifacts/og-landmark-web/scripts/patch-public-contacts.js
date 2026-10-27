const PUBLIC_CONTACT_REPLACEMENTS = [
  ['0304 2569000', '03272569000'],
  ['03042569000', '03272569000'],
  ['923042569000', '923272569000'],
  ['+92 300 1234567', '+923272569000'],
  ['923001234567', '923272569000'],
];

function patchPublicContacts(bundle) {
  return PUBLIC_CONTACT_REPLACEMENTS.reduce(
    (patched, [oldValue, newValue]) => patched.replaceAll(oldValue, newValue),
    bundle,
  );
}

module.exports = patchPublicContacts;
