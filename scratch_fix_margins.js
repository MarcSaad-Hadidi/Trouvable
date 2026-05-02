const fs = require('fs');
const files = [
  'features/public/seo-growth/pages/shared-primitives.jsx',
  'features/public/offers/components/MandateSection.jsx',
  'features/public/methodology/MethodologyPage.jsx',
  'features/public/case-studies/CaseStudiesPage.jsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  content = content.replace(/margin:\s*["']-[0-9]+px["']/g, 'amount: 0.2');
  if (original !== content) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
}
