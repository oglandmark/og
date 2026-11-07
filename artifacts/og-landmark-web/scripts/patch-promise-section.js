const fs = require('node:fs');
const path = require('node:path');

const sectionStartMarker = 'i.jsx("section",{className:"py-20 bg-background"';
const sectionHeadingMarker = 'children:"Why Choose OG Landmark"';
const nextSectionMarker = 'i.jsx("section",{className:"py-20 bg-muted"';

function patchPromiseSection(source) {
  const headingIndex = source.indexOf(sectionHeadingMarker);
  const startIndex = source.lastIndexOf(sectionStartMarker, headingIndex);
  const endIndex = source.indexOf(nextSectionMarker, headingIndex);

  if (
    headingIndex < 0
    || startIndex < 0
    || endIndex < 0
    || source.indexOf(sectionHeadingMarker, headingIndex + sectionHeadingMarker.length) >= 0
  ) {
    throw new Error('Could not find the single existing Why Choose section in the website bundle.');
  }

  const markup = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'promise-section.html'),
    'utf8',
  ).trim();
  const replacement = `i.jsx("section",{className:"py-20 bg-background",dangerouslySetInnerHTML:{__html:${JSON.stringify(markup)}}}),`;
  return `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
}

module.exports = patchPromiseSection;
