// Tests: the calculator reproduces DSO 429 HW4 1B / 1C / 1D, and its normal functions match Python's.
// Run: node test.mjs      (loads <script id="core"> from index.html, so the shipped code is tested)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const AB = new Function("module", html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + "; return AB;")({});
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ": " + d : ""}`); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------- HW4 1B: Larkspur booking page, A 1,140/20,000 vs B 1,290/20,000 ----------
const r = AB.results({ xA: 1140, nA: 20000, xB: 1290, nB: 20000, alpha: 0.05, sides: 1, d0: 0.005, table: true });
check("1B pooled rate = 0.06075", near(r.pool, 0.06075, 1e-12));
check("1B pooled SE = 0.002389", near(r.sePool, 0.002389, 5e-7), r.sePool.toFixed(7));
check("1B(i) z = 3.14, one-sided p = 0.00085, reject", near(r.z0, 3.1398, 5e-4) && near(r.pval, 0.00085, 1e-5) && r.reject0, `z ${r.z0.toFixed(4)}, p ${r.pval.toFixed(5)}`);
check("1B(ii) vs 0.5 pts: z = 1.05, p = 0.148, fail to reject", near(r.z1, 1.0466, 5e-4) && near(r.p1, 0.148, 5e-4) && !r.reject1, `z ${r.z1.toFixed(4)}, p ${r.p1.toFixed(4)}`);
check("1B(iii) one-sided 95% margin = ±0.39 pts", near(1.645 * r.sePool, 0.0039, 5e-5), (100 * 1.645 * r.sePool).toFixed(3) + " pts");

// ---------- HW4 1C: price the lift ----------
check("1C absolute lift 0.75 pts, relative 13.2%", near(r.lift, 0.0075, 1e-12) && near(r.rel, 0.1316, 5e-4), (100 * r.rel).toFixed(2) + "%");
check("1C unpooled SE = 0.002388", near(r.seUn, 0.002388, 5e-7), r.seUn.toFixed(7));
check("1C 95% CI on lift = [0.00282, 0.01218]", near(r.ci[0], 0.00282, 5e-6) && near(r.ci[1], 0.01218, 5e-6), `[${r.ci[0].toFixed(5)}, ${r.ci[1].toFixed(5)}]`);
const m = AB.money({ lift: r.lift, lo: r.ci[0], hi: r.ci[1], visits: 90000, margin: 35, build: 18000, days: 30, p1: r.pA });
check("1C extra bookings 675/month, $23,625/month", near(m.extra, 675, 1e-9) && near(m.dollars, 23625, 1e-6));
check("1C payback 22.9 days", near(m.payback, 22.857, 1e-3), m.payback.toFixed(3));
check("1C dollar CI = [$8,879, $38,371]", Math.round(m.ci[0]) === 8879 && Math.round(m.ci[1]) === 38371, `[${m.ci[0].toFixed(1)}, ${m.ci[1].toFixed(1)}]`);

// ---------- HW4 1D: seat-map test sizes (class z-values 1.645 + 0.842) ----------
const s1 = AB.sampleSize({ p1: 0.057, lift: 0.005, alpha: 0.05, power: 0.8, sides: 1, traffic: 3000, table: true });
const s2 = AB.sampleSize({ p1: 0.057, lift: 0.010, alpha: 0.05, power: 0.8, sides: 1, traffic: 3000, table: true });
check("1D(i) 5.7% -> 6.2%: 27,687 per arm, 18.5 -> 19 days", s1.n === 27687 && near(s1.raw, 27686.5, 0.05) && s1.daysUp === 19 && near(s1.days, 18.458, 1e-3), `n ${s1.n} (raw ${s1.raw.toFixed(2)}), ${s1.days.toFixed(2)} days`);
check("1D(ii) 5.7% -> 6.7%: 7,192 per arm, 4.8 -> 5 days", s2.n === 7192 && near(s2.raw, 7191.0, 0.05) && s2.daysUp === 5, `n ${s2.n} (raw ${s2.raw.toFixed(2)}), ${s2.days.toFixed(2)} days`);
const sp1 = AB.sampleSize({ p1: 0.057, lift: 0.005, sides: 1, traffic: 3000, table: true, variance: "pooled" });
const sp2 = AB.sampleSize({ p1: 0.057, lift: 0.010, sides: 1, traffic: 3000, table: true, variance: "pooled" });
check("1D note: pooled variance gives 27,690 and 7,195", sp1.n === 27690 && sp2.n === 7195, `${sp1.n}, ${sp2.n}`);
check("1D: relative lift input gives the same n", AB.sampleSize({ p1: 0.057, lift: 0.005 / 0.057, liftType: "rel", table: true }).n === 27687);
const ex = AB.sampleSize({ p1: 0.057, lift: 0.005, sides: 1, traffic: 3000 });
check("exact z-values give a slightly smaller n than the rounded table values", ex.n < s1.n && ex.n > 27600, `${ex.n} with z = ${ex.za.toFixed(4)} + ${ex.zb.toFixed(4)}`);

// ---------- input validation ----------
const throws = f => { try { f(); return false; } catch (e) { return true; } };
check("rejects impossible inputs", throws(() => AB.sampleSize({ p1: 0.057, lift: -0.01 })) && throws(() => AB.results({ xA: 30, nA: 20, xB: 1, nB: 20 })) && throws(() => AB.sampleSize({ p1: 1.2, lift: 0.01 })));

// ---------- normal functions vs Python (statistics.NormalDist, math.erfc) ----------
const ps = [1e-6, 0.001, 0.0123, 0.025, 0.05, 0.2, 0.5, 0.8, 0.9, 0.95, 0.975, 0.99, 0.999999];
const zs = [-5, -3.2, -1.96, -1, -0.3, 0, 0.5, 1.0466, 1.645, 2, 3.1398, 4.5];
try {
  const py = JSON.parse(execFileSync("python3", ["-I", "-c",
    `import json,math; from statistics import NormalDist as N; print(json.dumps({"q":[N().inv_cdf(p) for p in ${JSON.stringify(ps)}],"c":[N().cdf(z) for z in ${JSON.stringify(zs)}]}))`], { encoding: "utf8" }));
  const eq = Math.max(...ps.map((p, i) => Math.abs(AB.invPhi(p) - py.q[i]) / Math.max(1, Math.abs(py.q[i]))));
  const ec = Math.max(...zs.map((z, i) => Math.abs(AB.Phi(z) - py.c[i])));
  check("inverse normal CDF matches Python to 1e-8", eq < 1e-8, `max rel error ${eq.toExponential(1)}`);
  check("normal CDF matches Python to 1e-7", ec < 1e-7, `max abs error ${ec.toExponential(1)}`);
} catch (e) { console.log("SKIP  Python cross-check: " + e.message.split("\n")[0]); }

console.log(`\n${pass}/${pass + fail} PASS`); process.exit(fail ? 1 : 0);
