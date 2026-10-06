/**
 * installmentService
 * -----------------------------------------------------------------------------
 * Shared maths for layaway plans and savings schemes. Pure functions, no DB.
 */

'use strict';

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function round3(n) {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
}

const FREQUENCY_DAYS = { weekly: 7, biweekly: 14, monthly: 30 };

/**
 * Layaway schedule.
 * @returns {{balance:number, installmentAmount:number, dueDate:string|null, schedule:Array}}
 */
function buildLayawaySchedule({ totalAmount, downPayment = 0, installmentCount = 1, frequency = 'monthly', startDate }) {
  const total = Number(totalAmount);
  if (Number.isNaN(total) || total < 0) throw new Error('installment: totalAmount invalid');
  const down = Number(downPayment) || 0;
  if (down > total) throw new Error('installment: downPayment exceeds total');

  const count = Math.max(parseInt(installmentCount, 10) || 1, 1);
  const balance = round2(total - down);
  const per = round2(balance / count);

  const step = FREQUENCY_DAYS[frequency] || 30;
  const start = startDate ? new Date(startDate) : new Date();

  const schedule = [];
  let allocated = 0;
  for (let i = 1; i <= count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + step * i);
    // Last instalment absorbs any rounding remainder.
    const amount = i === count ? round2(balance - allocated) : per;
    allocated = round2(allocated + amount);
    schedule.push({ installmentNo: i, dueDate: d.toISOString().slice(0, 10), amount });
  }

  return {
    balance,
    installmentAmount: per,
    dueDate: schedule.length ? schedule[schedule.length - 1].dueDate : null,
    schedule,
  };
}

/** Remaining balance and completion state for a layaway. */
function layawayStatus({ totalAmount, paidAmount }) {
  const total = Number(totalAmount) || 0;
  const paid = Number(paidAmount) || 0;
  const balance = round2(Math.max(total - paid, 0));
  return { balance, isComplete: paid >= total && total > 0, paidPct: total > 0 ? Math.min(round2((paid / total) * 100), 100) : 0 };
}

/**
 * Savings scheme accrual for one instalment.
 * amount-based -> just the money; weight-based -> grams at that month's rate.
 */
function accrueSchemeInstallment({ amount, accrualType = 'amount', metalRate }) {
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt <= 0) throw new Error('installment: amount must be > 0');
  if (accrualType === 'weight') {
    const rate = Number(metalRate);
    if (Number.isNaN(rate) || rate <= 0) throw new Error('installment: metalRate required for weight-based scheme');
    return { amount: round2(amt), weightCredited: round3(amt / rate) };
  }
  return { amount: round2(amt), weightCredited: null };
}

/**
 * Maturity value including the scheme bonus.
 * extra_installment -> add `bonus_value` instalments worth of the average payment
 * percentage        -> add bonus_value % of total paid
 */
function schemeMaturityValue({ totalPaid, paidInstallments, bonusType = 'none', bonusValue = 0 }) {
  const paid = Number(totalPaid) || 0;
  const n = Number(paidInstallments) || 0;
  const v = Number(bonusValue) || 0;
  let bonus = 0;
  if (bonusType === 'percentage') bonus = paid * (v / 100);
  else if (bonusType === 'extra_installment' && n > 0) bonus = (paid / n) * v;
  return { totalPaid: round2(paid), bonus: round2(bonus), redeemableValue: round2(paid + bonus) };
}

module.exports = {
  FREQUENCY_DAYS,
  buildLayawaySchedule,
  layawayStatus,
  accrueSchemeInstallment,
  schemeMaturityValue,
  round2,
  round3,
};
