'use strict';
// Salary engine, ported from the revenue-management reference project.
const PER_YEAR = {hourly: 40 * 52, weekly: 52, biweekly: 26, monthly: 12, yearly: 1};
const toAnnual = (amt, freq) => (Number(amt) || 0) * (PER_YEAR[freq] ?? 12);
const r2 = n => Math.round(n * 100) / 100;

function calculate(p) {
  const freq = p.pay_frequency || 'monthly';
  const hrs = Number(p.standard_hours_per_week) || 40, mult = Number(p.overtime_rate_multiplier) || 1.5;
  const base = toAnnual(p.base_salary, freq), allow = toAnnual(p.allowances, freq), bonus = toAnnual(p.bonus_expected, freq);
  const hourly = base / (hrs * 52), otRate = hourly * mult;
  const overtime = toAnnual(p.overtime_hours, freq) * otRate;
  const gross = base + allow + bonus + overtime;
  const pension = base * (Number(p.pension_rate) || 0) / 100;
  const tax = Math.max(0, gross - pension) * (Number(p.tax_rate) || 0) / 100;
  const insurance = toAnnual(p.insurance_deduction, freq), other = toAnnual(p.other_deductions, freq);
  const ded = tax + pension + insurance + other, net = Math.max(0, gross - ded);
  const period = d => ({
    gross: r2(gross / d), base: r2(base / d), allowances: r2(allow / d), bonus: r2(bonus / d), overtime: r2(overtime / d),
    tax: r2(tax / d), pension: r2(pension / d), insurance: r2(insurance / d), other: r2(other / d),
    total_deductions: r2(ded / d), net: r2(net / d)
  });
  return {
    yearly: period(1), monthly: period(12), biweekly: period(26), weekly: period(52), daily: period(260),
    hourly: {rate: r2(hourly), overtime_rate: r2(otRate), gross: r2(gross / (hrs * 52)), net: r2(net / (hrs * 52))},
    rates: {retention: gross ? r2(net / gross * 100) : 0, effective_tax: gross ? r2(tax / gross * 100) : 0}
  };
}
module.exports = {calculate, PER_YEAR};
