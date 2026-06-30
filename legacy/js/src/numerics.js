"use strict";

function complexPhasorRatio(numerator, denominator) {
  const den2 = denominator.re * denominator.re + denominator.im * denominator.im;
  if (!Number.isFinite(den2) || den2 <= 1e-24) {
    return { re: 0, im: 0, amplitude: 0, phaseRad: 0 };
  }
  const re = (numerator.re * denominator.re + numerator.im * denominator.im) / den2;
  const im = (numerator.im * denominator.re - numerator.re * denominator.im) / den2;
  return {
    re,
    im,
    amplitude: Math.hypot(re, im),
    phaseRad: Math.atan2(im, re),
  };
}

function symmetricJacobiEigenvalues(matrix, maxSweeps = 64) {
  const n = matrix.length;
  const a = matrix.map((row) => row.slice());
  if (n === 0) return [];

  for (let sweep = 0; sweep < maxSweeps; sweep += 1) {
    let p = 0;
    let q = 1;
    let maxOffDiagonal = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const value = Math.abs(a[i][j]);
        if (value > maxOffDiagonal) {
          maxOffDiagonal = value;
          p = i;
          q = j;
        }
      }
    }
    if (maxOffDiagonal < 1e-12) break;

    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];
    const tau = (aqq - app) / (2 * apq);
    const sign = tau >= 0 ? 1 : -1;
    const t = sign / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    for (let k = 0; k < n; k += 1) {
      if (k === p || k === q) continue;
      const aik = a[k][p];
      const akq = a[k][q];
      a[k][p] = c * aik - s * akq;
      a[p][k] = a[k][p];
      a[k][q] = s * aik + c * akq;
      a[q][k] = a[k][q];
    }
    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = 0;
    a[q][p] = 0;
  }

  return a
    .map((row, index) => row[index])
    .sort((left, right) => left - right);
}

function planeWaveBasis(shells = 1) {
  const radius = clampInt(shells, 1, 2);
  const basis = [];
  for (let gy = -radius; gy <= radius; gy += 1) {
    for (let gx = -radius; gx <= radius; gx += 1) {
      basis.push({ gx, gy });
    }
  }
  return basis.sort((left, right) => {
    const leftNorm = left.gx * left.gx + left.gy * left.gy;
    const rightNorm = right.gx * right.gx + right.gy * right.gy;
    if (leftNorm !== rightNorm) return leftNorm - rightNorm;
    if (left.gy !== right.gy) return left.gy - right.gy;
    return left.gx - right.gx;
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clampInt(value, min, max) {
  return Math.round(clamp(Number(value) || 0, min, max));
}
