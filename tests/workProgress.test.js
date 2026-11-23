import assert from "node:assert/strict";
import test from "node:test";

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(n) * 100 + Number.EPSILON)) / 100;
}

function roundRupee(value) {
  return Math.round(value);
}

function adjustRowLabel(kind, pct) {
  return kind === "ADD" ? `Add (+${pct}%)=` : `Less (-${pct}%)=`;
}

test("Sub-Total rounds to whole rupees like the client sheet", () => {
  assert.equal(roundRupee(2862981.36 - 27484.62), 2835497);
  assert.equal(roundRupee(382959.73 - 3676.41), 379283);
  assert.equal(roundRupee(252877.83 - 2427.63), 250450);
  assert.equal(roundRupee(715543 - 6869.21), 708674);
  assert.equal(roundRupee(1009852.34 - 9694.58), 1000158);
  assert.equal(roundRupee(1217291.46 - 11686), 1205605);
});

test("recoveries and net follow rounded Sub-Total / Grand Total", () => {
  const grand = 2835497;
  const sd = round2(-(grand * 2.5) / 100);
  const it = round2(-(grand * 2) / 100);
  const gst = round2(-(grand * 2) / 100);
  const labour = round2(-(grand * 1) / 100);
  const recoveries = round2(sd + it + gst + labour);
  const net = round2(grand + recoveries);
  assert.equal(sd, -70887.43);
  assert.equal(it, -56709.94);
  assert.equal(gst, -56709.94);
  assert.equal(labour, -28354.97);
  assert.equal(recoveries, -212662.28);
  assert.equal(net, 2622834.72);
});

test("4th R.A. grand total with extras matches client sheet", () => {
  const subA = 1000158;
  const extra = 171145.32;
  const grand = round2(subA + extra);
  assert.equal(grand, 1171303.32);
  const sd = round2(-(grand * 2.5) / 100);
  const it = round2(-(grand * 2) / 100);
  const gst = round2(-(grand * 2) / 100);
  const labour = round2(-(grand * 1) / 100);
  const recoveries = round2(sd + it + gst + labour);
  const net = round2(grand + recoveries);
  assert.equal(sd, -29282.58);
  assert.equal(recoveries, -87847.75);
  assert.equal(net, 1083455.57);
});

test("Less / Add labels match client wording", () => {
  assert.equal(adjustRowLabel("LESS", 0.96), "Less (-0.96%)=");
  assert.equal(adjustRowLabel("ADD", 0.96), "Add (+0.96%)=");
});
