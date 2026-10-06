const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('legacy backend network print route', function () {
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'printRoutes.js'), 'utf8');

  it('converts HTML to ESC/POS before opening the printer connection', function () {
    const conversion = source.indexOf('await convertHtmlToEscpos');
    const printing = source.indexOf('await printToNetworkPrinter');
    assert.ok(conversion >= 0);
    assert.ok(printing > conversion);
  });
});
