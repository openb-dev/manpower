import test from "node:test";
import assert from "node:assert/strict";

function round2(value) {
  return Math.round((Number(value) || 0) * 100 + Number.EPSILON) / 100;
}
function roundRupee(value) {
  return Math.round(Number(value) || 0);
}

function buildSalaryLine(input) {
  const workingDays = Number(input.workingDays) || 0;
  const dailyWage = Number(input.dailyWage) || 0;
  const grossBasic = roundRupee(workingDays * dailyWage);
  const epfEmployee = roundRupee(grossBasic * 0.12);
  const esicEmployee = roundRupee(grossBasic * 0.0075);
  const professionalTax = roundRupee(input.professionalTax ?? 0);
  const netAmount = roundRupee(grossBasic - epfEmployee - esicEmployee - professionalTax);
  const epfEmployer = round2(grossBasic * 0.13);
  const esiEmployer = round2(grossBasic * 0.0325);
  return { grossBasic, epfEmployee, esicEmployee, professionalTax, netAmount, epfEmployer, esiEmployer };
}

test("salary line matches client sample for 26 days @ 1024", () => {
  const line = buildSalaryLine({ workingDays: 26, dailyWage: 1024, professionalTax: 150 });
  assert.equal(line.grossBasic, 26624);
  assert.equal(line.epfEmployee, 3195);
  assert.equal(line.esicEmployee, 200);
  assert.equal(line.netAmount, 23079);
  assert.equal(line.epfEmployer, 3461.12);
  assert.ok(Math.abs(line.esiEmployer - 866) < 1.5);
});
