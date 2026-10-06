const { expect } = require('chai');

// Loading the router pulls in multer/storage services — they are import-safe
// (no DB work at require time), so we can inspect the exported maps directly.
const router = require('../routes/attachments.routes');

describe('attachments routes — permission mapping', () => {
  it('requires read and write permissions for every entity type', () => {
    for (const entity of router.ALLOWED_ENTITIES) {
      const spec = router.ENTITY_PERMS[entity];
      expect(spec, `entity "${entity}" must have a permission spec`).to.exist;
      expect(spec.read, `${entity}.read`).to.be.a('string').and.match(/^[a-z]+\.[a-z_]+$/);
      expect(spec.write, `${entity}.write`).to.be.a('string').and.match(/^[a-z]+\.[a-z_]+$/);
    }
  });

  it('gates store logo uploads behind stores.edit', () => {
    expect(router.ENTITY_PERMS.store.write).to.equal('stores.edit');
  });
});
