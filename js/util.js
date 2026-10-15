/* util.js — funções auxiliares sem dependência de estado */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const PALETTE = ["#D62728", "#1F77B4", "#2CA02C", "#FF7F0E", "#9467BD", "#8C564B", "#E377C2", "#17BECF", "#BCBD22", "#7F7F7F"];
const ptbr = s => String(s).replace(".", ",");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function fmt(v){
  if (!isFinite(v)) return "—";
  const a = Math.abs(v);
  const s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : a >= 0.01 ? v.toFixed(3) : v.toExponential(1);
  return ptbr(s);
}
function fmtAxis(v){
  if (v >= 1000) return ptbr(+(v / 1000).toPrecision(3)) + "k";
  return ptbr(+v.toPrecision(3));
}
function logspace(a, b, n){
  const la = Math.log10(a), lb = Math.log10(b), r = [];
  for (let i = 0; i < n; i++) r.push(Math.pow(10, la + (lb - la) * i / (n - 1)));
  return r;
}
