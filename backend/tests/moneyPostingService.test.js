/* eslint-disable */
const { expect } = require('chai');
const svc = require('../services/moneyPostingService');

describe('moneyPostingService — validateLines', () => {
  const twoLeg = [
    { accountCode: 'CASH', debit: 100 },
    { accountCode: 'SALES', credit: 100 },
  ];

  it('accepts a balanced two-line entry', () => {
    const r = svc.validateLines(twoLeg);
    expect(r.totalDebit).to.equal(100);
    expect(r.totalCredit).to.equal(100);
  });

  it('accepts multi-line entries with mixed account refs', () => {
    const r = svc.validateLines([
      { accountCode: 'CASH', debit: 60 },
      { accountId: 'uuid-x', debit: 40 },
      { accountCode: 'SALES', credit: 90 },
      { accountCode: 'TAXPAY', credit: 10 },
    ]);
    expect(r.totalDebit).to.equal(100);
  });

  it('rejects unbalanced entries', () => {
    expect(() => svc.validateLines([
      { accountCode: 'CASH', debit: 100 },
      { accountCode: 'SALES', credit: 99 },
    ])).to.throw(/not balanced/);
  });

  it('rejects fewer than two lines', () => {
    expect(() => svc.validateLines([{ accountCode: 'CASH', debit: 5 }])).to.throw(/at least 2 lines/);
    expect(() => svc.validateLines([])).to.throw(/at least 2 lines/);
    expect(() => svc.validateLines(null)).to.throw(/at least 2 lines/);
  });

  it('rejects lines with both debit and credit set', () => {
    expect(() => svc.validateLines([
      { accountCode: 'CASH', debit: 50, credit: 50 },
      { accountCode: 'SALES', credit: 50 },
    ])).to.throw(/exactly one/);
  });

  it('rejects lines with neither side set', () => {
    expect(() => svc.validateLines([
      { accountCode: 'CASH' },
      { accountCode: 'SALES', credit: 5 },
    ])).to.throw(/exactly one/);
  });

  it('rejects negative amounts', () => {
    expect(() => svc.validateLines([
      { accountCode: 'CASH', debit: -50 },
      { accountCode: 'SALES', credit: 50 },
    ])).to.throw(/negative/);
  });

  it('rejects lines without an account reference', () => {
    expect(() => svc.validateLines([
      { debit: 50 },
      { accountCode: 'SALES', credit: 50 },
    ])).to.throw(/accountId or accountCode/);
  });

  it('balances on cent-rounded legs — equal to the cent passes, a cent off fails', () => {
    // float noise on equal values (0.1+0.2 style) still balances
    expect(() => svc.validateLines([
      { accountCode: 'CASH', debit: 0.1 + 0.2 },
      { accountCode: 'SALES', credit: 0.3 },
    ])).to.not.throw();
    // a genuine cent difference is rejected
    expect(() => svc.validateLines([
      { accountCode: 'CASH', debit: 33.34 },
      { accountCode: 'SALES', credit: 33.33 },
    ])).to.throw(/not balanced/);
    // sub-cent input rounds to its stored value before judging balance
    svc.validateLines([
      { accountCode: 'CASH', debit: 33.335 },
      { accountCode: 'SALES', credit: 33.335 },
    ]);
  });
});

describe('moneyPostingService — buildReversalLines', () => {
  it('swaps debit and credit legs and preserves party refs', () => {
    const lines = [
      { account_id: 'a1', debit: 100, credit: 0, memo: 'cash in', customer_id: 'c1', supplier_id: null },
      { account_id: 'a2', debit: 0, credit: 100, memo: 'sale', customer_id: null, supplier_id: 's1' },
    ];
    const rev = svc.buildReversalLines(lines);
    expect(rev).to.have.length(2);
    expect(rev[0]).to.deep.include({ accountId: 'a1', debit: 0, credit: 100, customerId: 'c1' });
    expect(rev[1]).to.deep.include({ accountId: 'a2', debit: 100, credit: 0, supplierId: 's1' });
    // reversal of a balanced entry is itself balanced
    expect(() => svc.validateLines(rev)).to.not.throw();
  });
});

describe('moneyPostingService — constants stay in sync with the migration seed', () => {
  it('every mapping target is a seeded account code', () => {
    const codes = new Set(svc.DEFAULT_ACCOUNTS.map((a) => a[0]));
    for (const [, code] of svc.DEFAULT_MAPPINGS) {
      expect(codes.has(code), `mapping -> ${code}`).to.equal(true);
    }
  });

  it('account codes are unique and non-empty', () => {
    const codes = svc.DEFAULT_ACCOUNTS.map((a) => a[0]);
    expect(new Set(codes).size).to.equal(codes.length);
    for (const c of codes) expect(c).to.match(/^[A-Z0-9][A-Z0-9_-]*$/);
  });
});
