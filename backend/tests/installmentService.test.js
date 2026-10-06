/* eslint-disable */
const { expect } = require('chai');
const inst = require('../services/installmentService');

describe('installmentService — layaway', () => {
  it('splits the balance across instalments', () => {
    const r = inst.buildLayawaySchedule({ totalAmount: 1000, downPayment: 200, installmentCount: 4, startDate: '2026-01-01' });
    expect(r.balance).to.equal(800);
    expect(r.installmentAmount).to.equal(200);
    expect(r.schedule).to.have.length(4);
    const sum = r.schedule.reduce((a, s) => a + s.amount, 0);
    expect(Math.round(sum * 100) / 100).to.equal(800);
  });

  it('last instalment absorbs rounding remainder', () => {
    const r = inst.buildLayawaySchedule({ totalAmount: 100, downPayment: 0, installmentCount: 3 });
    const sum = r.schedule.reduce((a, s) => a + s.amount, 0);
    expect(Math.round(sum * 100) / 100).to.equal(100);
  });

  it('rejects a down payment larger than the total', () => {
    expect(() => inst.buildLayawaySchedule({ totalAmount: 100, downPayment: 500 })).to.throw(/downPayment/);
  });

  it('computes remaining balance and completion', () => {
    expect(inst.layawayStatus({ totalAmount: 500, paidAmount: 200 })).to.deep.include({ balance: 300, isComplete: false });
    expect(inst.layawayStatus({ totalAmount: 500, paidAmount: 500 }).isComplete).to.equal(true);
  });

  it('respects weekly frequency spacing', () => {
    const r = inst.buildLayawaySchedule({ totalAmount: 100, installmentCount: 2, frequency: 'weekly', startDate: '2026-01-01' });
    expect(r.schedule[0].dueDate).to.equal('2026-01-08');
    expect(r.schedule[1].dueDate).to.equal('2026-01-15');
  });
});

describe('installmentService — savings schemes', () => {
  it('accrues amount-based instalments', () => {
    const r = inst.accrueSchemeInstallment({ amount: 100, accrualType: 'amount' });
    expect(r.amount).to.equal(100);
    expect(r.weightCredited).to.equal(null);
  });

  it('accrues weight-based instalments at the given rate', () => {
    const r = inst.accrueSchemeInstallment({ amount: 100, accrualType: 'weight', metalRate: 50 });
    expect(r.weightCredited).to.equal(2);
  });

  it('requires a rate for weight-based accrual', () => {
    expect(() => inst.accrueSchemeInstallment({ amount: 100, accrualType: 'weight' })).to.throw(/metalRate/);
  });

  it('adds an extra-instalment bonus at maturity', () => {
    // 11 payments of 100 = 1100, bonus = 1 extra instalment (avg 100)
    const r = inst.schemeMaturityValue({ totalPaid: 1100, paidInstallments: 11, bonusType: 'extra_installment', bonusValue: 1 });
    expect(r.bonus).to.equal(100);
    expect(r.redeemableValue).to.equal(1200);
  });

  it('adds a percentage bonus at maturity', () => {
    const r = inst.schemeMaturityValue({ totalPaid: 1000, paidInstallments: 10, bonusType: 'percentage', bonusValue: 5 });
    expect(r.redeemableValue).to.equal(1050);
  });
});
