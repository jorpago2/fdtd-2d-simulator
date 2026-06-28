// Minimal C++ source for the browser WASM FDTD kernel.
//
// The exported signatures intentionally match fdtd-core.wat and
// src/wasm-backend.js: array arguments are byte offsets into the imported
// WebAssembly linear memory owned by JavaScript.

using i32 = int;
using u32 = unsigned int;
using u8 = unsigned char;

static constexpr i32 FEATURE_CONDUCTIVITY = 1 << 0;
static constexpr i32 FEATURE_KERR = 1 << 1;
static constexpr i32 FEATURE_SATURABLE_GAIN = 1 << 2;
static constexpr i32 FEATURE_TENSOR_GYRO = 1 << 3;

static constexpr i32 STEP_KERR = 1 << 0;
static constexpr i32 STEP_SATURABLE_GAIN = 1 << 1;
static constexpr i32 STEP_TENSOR_GYRO = 1 << 2;

static inline float* f32(u32 offset) {
  return reinterpret_cast<float*>(offset);
}

static inline u8* u8_array(u32 offset) {
  return reinterpret_cast<u8*>(offset);
}

static inline float absf(float value) {
  return value < 0.0f ? -value : value;
}

static inline float minf(float a, float b) {
  return a < b ? a : b;
}

static inline float maxf(float a, float b) {
  return a > b ? a : b;
}

static inline float clampf(float value, float low, float high) {
  return minf(maxf(value, low), high);
}

static inline float conductivity_damp(float sigma, float materialValue, float courant) {
  if (sigma <= 0.0f) return 0.0f;
  const float denominator = maxf(1.0e-6f, absf(materialValue));
  return minf(1.0e6f, (sigma * courant) / (2.0f * denominator));
}

extern "C" __attribute__((export_name("kernel_features"))) i32 kernel_features() {
  return FEATURE_CONDUCTIVITY | FEATURE_KERR | FEATURE_SATURABLE_GAIN | FEATURE_TENSOR_GYRO;
}

static inline float electric_loss_decay(float loss, float intensity, i32 runtimeFlags, float gainSaturation) {
  float value = loss;
  if ((runtimeFlags & STEP_SATURABLE_GAIN) && value < 0.0f) {
    const float saturation = maxf(0.05f, gainSaturation);
    value = value / (1.0f + minf(intensity, 1.0e12f) / saturation);
  }
  value = maxf(-0.95f, value);
  return 1.0f / (1.0f + value);
}

static inline void apply_kerr_response(
  i32 nx,
  i32 ny,
  i32 hzMode,
  float kerrChi3,
  float kerrSaturation,
  float* ez,
  float* hx,
  float* hy,
  float* eps,
  float* epsY,
  u8* material,
  u8* nonlinearMaterial,
  float* modulationBaseEps,
  float* modulationBaseEpsY
) {
  if (kerrChi3 == 0.0f) return;
  const i32 n = nx * ny;
  const float saturation = maxf(0.05f, kerrSaturation);
  for (i32 i = 0; i < n; i += 1) {
    if (!nonlinearMaterial[i] || material[i] == 2) continue;
    const float rawIntensity = hzMode ? hx[i] * hx[i] + hy[i] * hy[i] : ez[i] * ez[i];
    const float limitedIntensity = minf(rawIntensity, 1.0e6f);
    const float saturatedIntensity = limitedIntensity / (1.0f + limitedIntensity / saturation);
    const float deltaEps = kerrChi3 * saturatedIntensity;
    eps[i] = clampf(modulationBaseEps[i] + deltaEps, -30.0f, 30.0f);
    epsY[i] = clampf(modulationBaseEpsY[i] + deltaEps, -30.0f, 30.0f);
  }
}

static inline void zero_tm_cell(float* ez, float* ezx, float* ezy, i32 i) {
  ez[i] = 0.0f;
  ezx[i] = 0.0f;
  ezy[i] = 0.0f;
}

static inline void zero_te_cell(float* hz, float* hzx, float* hzy, float* ex, float* ey, i32 i) {
  hz[i] = 0.0f;
  hzx[i] = 0.0f;
  hzy[i] = 0.0f;
  ex[i] = 0.0f;
  ey[i] = 0.0f;
}

extern "C" __attribute__((export_name("step"))) void step(
  i32 nx,
  i32 ny,
  float s,
  u32 ezOffset,
  u32 ezxOffset,
  u32 ezyOffset,
  u32 hxOffset,
  u32 hyOffset,
  u32 epsOffset,
  u32 lossOffset,
  u32 epsYOffset,
  u32 lossYOffset,
  u32 conductivityOffset,
  u32 conductivityYOffset,
  u32 muOffset,
  u32 muLossOffset,
  u32 muYOffset,
  u32 muLossYOffset,
  u32 materialOffset,
  u32 nonlinearMaterialOffset,
  u32 electricTensorMaterialOffset,
  u32 gyrotropicMaterialOffset,
  u32 modulationBaseEpsOffset,
  u32 modulationBaseEpsYOffset,
  u32 epsilonXYOffset,
  u32 gyrotropyGOffset,
  u32 eCaXOffset,
  u32 eCbXOffset,
  u32 eCaYOffset,
  u32 eCbYOffset,
  u32 hCaXOffset,
  u32 hCbXOffset,
  u32 hCaYOffset,
  u32 hCbYOffset,
  i32 runtimeFlags,
  float kerrChi3,
  float kerrSaturation,
  float gainSaturation
) {
  float* ez = f32(ezOffset);
  float* ezx = f32(ezxOffset);
  float* ezy = f32(ezyOffset);
  float* hx = f32(hxOffset);
  float* hy = f32(hyOffset);
  float* eps = f32(epsOffset);
  float* loss = f32(lossOffset);
  float* epsY = f32(epsYOffset);
  float* lossY = f32(lossYOffset);
  float* conductivity = f32(conductivityOffset);
  float* conductivityY = f32(conductivityYOffset);
  float* mu = f32(muOffset);
  float* muLoss = f32(muLossOffset);
  float* muY = f32(muYOffset);
  float* muLossY = f32(muLossYOffset);
  u8* material = u8_array(materialOffset);
  u8* nonlinearMaterial = u8_array(nonlinearMaterialOffset);
  float* modulationBaseEps = f32(modulationBaseEpsOffset);
  float* modulationBaseEpsY = f32(modulationBaseEpsYOffset);
  float* eCaX = f32(eCaXOffset);
  float* eCbX = f32(eCbXOffset);
  float* eCaY = f32(eCaYOffset);
  float* eCbY = f32(eCbYOffset);
  float* hCaX = f32(hCaXOffset);
  float* hCbX = f32(hCbXOffset);
  float* hCaY = f32(hCaYOffset);
  float* hCbY = f32(hCbYOffset);

  if (runtimeFlags & STEP_KERR) {
    apply_kerr_response(nx, ny, 0, kerrChi3, kerrSaturation, ez, hx, hy, eps, epsY, material, nonlinearMaterial, modulationBaseEps, modulationBaseEpsY);
  }

  for (i32 y = 0; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    const float ca = hCaY[y];
    const float cb = hCbY[y];
    for (i32 x = 0; x < nx; x += 1) {
      const i32 i = row + x;
      const float decay = 1.0f / (1.0f + muLoss[i]);
      const float materialScale = s / mu[i];
      hx[i] = (ca * hx[i] - cb * materialScale * (ez[i + nx] - ez[i])) * decay;
    }
  }

  for (i32 y = 0; y < ny; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 0; x < nx - 1; x += 1) {
      const i32 i = row + x;
      const float decay = 1.0f / (1.0f + muLossY[i]);
      const float materialScale = s / muY[i];
      hy[i] = (hCaX[x] * hy[i] + hCbX[x] * materialScale * (ez[i + 1] - ez[i])) * decay;
    }
  }

  for (i32 y = 1; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 1; x < nx - 1; x += 1) {
      const i32 i = row + x;
      if (material[i] == 2) {
        zero_tm_cell(ez, ezx, ezy, i);
        continue;
      }
      const float dHyDx = hy[i] - hy[i - 1];
      const float dHxDy = hx[i] - hx[i - nx];
      const float sigmaDampX = conductivity_damp(conductivity[i], eps[i], s);
      const float sigmaDampY = conductivity_damp(conductivityY[i], epsY[i], s);
      const float sigmaCaX = (1.0f - sigmaDampX) / (1.0f + sigmaDampX);
      const float sigmaCaY = (1.0f - sigmaDampY) / (1.0f + sigmaDampY);
      const float sigmaCbX = 1.0f / (1.0f + sigmaDampX);
      const float sigmaCbY = 1.0f / (1.0f + sigmaDampY);
      const float intensity = ez[i] * ez[i];
      const float decayX = electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
      const float decayY = electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
      const float ezxNew = (sigmaCaX * eCaX[x] * ezx[i] + sigmaCbX * eCbX[x] * (s / eps[i]) * dHyDx) * decayX;
      const float ezyNew = (sigmaCaY * eCaY[y] * ezy[i] - sigmaCbY * eCbY[y] * (s / epsY[i]) * dHxDy) * decayY;
      ezx[i] = ezxNew;
      ezy[i] = ezyNew;
      ez[i] = ezxNew + ezyNew;
    }
  }
}

extern "C" __attribute__((export_name("step_hz"))) void step_hz(
  i32 nx,
  i32 ny,
  float s,
  u32 hzOffset,
  u32 hzxOffset,
  u32 hzyOffset,
  u32 exOffset,
  u32 eyOffset,
  u32 epsOffset,
  u32 lossOffset,
  u32 epsYOffset,
  u32 lossYOffset,
  u32 conductivityOffset,
  u32 conductivityYOffset,
  u32 muOffset,
  u32 muLossOffset,
  u32 muYOffset,
  u32 muLossYOffset,
  u32 materialOffset,
  u32 nonlinearMaterialOffset,
  u32 electricTensorMaterialOffset,
  u32 gyrotropicMaterialOffset,
  u32 modulationBaseEpsOffset,
  u32 modulationBaseEpsYOffset,
  u32 epsilonXYOffset,
  u32 gyrotropyGOffset,
  u32 eCaXOffset,
  u32 eCbXOffset,
  u32 eCaYOffset,
  u32 eCbYOffset,
  u32 hCaXOffset,
  u32 hCbXOffset,
  u32 hCaYOffset,
  u32 hCbYOffset,
  i32 runtimeFlags,
  float kerrChi3,
  float kerrSaturation,
  float gainSaturation
) {
  float* hz = f32(hzOffset);
  float* hzx = f32(hzxOffset);
  float* hzy = f32(hzyOffset);
  float* ex = f32(exOffset);
  float* ey = f32(eyOffset);
  float* eps = f32(epsOffset);
  float* loss = f32(lossOffset);
  float* epsY = f32(epsYOffset);
  float* lossY = f32(lossYOffset);
  float* conductivity = f32(conductivityOffset);
  float* conductivityY = f32(conductivityYOffset);
  float* mu = f32(muOffset);
  float* muLoss = f32(muLossOffset);
  float* muY = f32(muYOffset);
  float* muLossY = f32(muLossYOffset);
  u8* material = u8_array(materialOffset);
  u8* nonlinearMaterial = u8_array(nonlinearMaterialOffset);
  u8* electricTensorMaterial = u8_array(electricTensorMaterialOffset);
  u8* gyrotropicMaterial = u8_array(gyrotropicMaterialOffset);
  float* modulationBaseEps = f32(modulationBaseEpsOffset);
  float* modulationBaseEpsY = f32(modulationBaseEpsYOffset);
  float* epsilonXY = f32(epsilonXYOffset);
  float* gyrotropyG = f32(gyrotropyGOffset);
  float* eCaX = f32(eCaXOffset);
  float* eCbX = f32(eCbXOffset);
  float* eCaY = f32(eCaYOffset);
  float* eCbY = f32(eCbYOffset);
  float* hCaX = f32(hCaXOffset);
  float* hCbX = f32(hCbXOffset);
  float* hCaY = f32(hCaYOffset);
  float* hCbY = f32(hCbYOffset);

  if (runtimeFlags & STEP_KERR) {
    apply_kerr_response(nx, ny, 1, kerrChi3, kerrSaturation, hz, ex, ey, eps, epsY, material, nonlinearMaterial, modulationBaseEps, modulationBaseEpsY);
  }

  for (i32 y = 0; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    const float ca = eCaY[y];
    const float cb = eCbY[y];
    for (i32 x = 0; x < nx; x += 1) {
      const i32 i = row + x;
      if (material[i] == 2) {
        ex[i] = 0.0f;
        continue;
      }
      if ((runtimeFlags & STEP_TENSOR_GYRO) && (gyrotropicMaterial[i] || electricTensorMaterial[i])) continue;
      const float sigmaDamp = conductivity_damp(conductivity[i], eps[i], s);
      const float sigmaCa = (1.0f - sigmaDamp) / (1.0f + sigmaDamp);
      const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
      const float intensity = ex[i] * ex[i] + ey[i] * ey[i];
      const float decay = electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
      ex[i] = (sigmaCa * ca * ex[i] + sigmaCb * cb * (s / eps[i]) * (hz[i + nx] - hz[i])) * decay;
    }
  }

  for (i32 y = 0; y < ny; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 0; x < nx - 1; x += 1) {
      const i32 i = row + x;
      if (material[i] == 2) {
        ey[i] = 0.0f;
        continue;
      }
      if ((runtimeFlags & STEP_TENSOR_GYRO) && (gyrotropicMaterial[i] || electricTensorMaterial[i])) continue;
      const float sigmaDamp = conductivity_damp(conductivityY[i], epsY[i], s);
      const float sigmaCa = (1.0f - sigmaDamp) / (1.0f + sigmaDamp);
      const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
      const float intensity = ex[i] * ex[i] + ey[i] * ey[i];
      const float decay = electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
      ey[i] = (sigmaCa * eCaX[x] * ey[i] - sigmaCb * eCbX[x] * (s / epsY[i]) * (hz[i + 1] - hz[i])) * decay;
    }
  }

  if (runtimeFlags & STEP_TENSOR_GYRO) {
    for (i32 y = 0; y < ny - 1; y += 1) {
      const i32 row = y * nx;
      const float caX = eCaY[y];
      const float cbX = eCbY[y];
      for (i32 x = 0; x < nx - 1; x += 1) {
        const i32 i = row + x;
        if (!gyrotropicMaterial[i] && !electricTensorMaterial[i]) continue;
        if (material[i] == 2) {
          ex[i] = 0.0f;
          ey[i] = 0.0f;
          continue;
        }
        const float epsX = eps[i];
        const float epsYi = epsY[i];
        const float g = gyrotropyG[i];
        const float k = epsilonXY[i];
        const float upperOffDiagonal = k + g;
        const float lowerOffDiagonal = k - g;
        const float det = epsX * epsYi - upperOffDiagonal * lowerOffDiagonal;
        const float safeDet = absf(det) < 1.0e-6f ? (det < 0.0f ? -1.0e-6f : 1.0e-6f) : det;
        const float sigmaDampX = conductivity_damp(conductivity[i], epsX, s);
        const float sigmaDampY = conductivity_damp(conductivityY[i], epsYi, s);
        const float sigmaCaX = (1.0f - sigmaDampX) / (1.0f + sigmaDampX);
        const float sigmaCaY = (1.0f - sigmaDampY) / (1.0f + sigmaDampY);
        const float sigmaCbX = 1.0f / (1.0f + sigmaDampX);
        const float sigmaCbY = 1.0f / (1.0f + sigmaDampY);
        const float sourceX = sigmaCbX * cbX * s * (hz[i + nx] - hz[i]);
        const float sourceY = -sigmaCbY * eCbX[x] * s * (hz[i + 1] - hz[i]);
        const float coupledX = (epsYi * sourceX - upperOffDiagonal * sourceY) / safeDet;
        const float coupledY = (-lowerOffDiagonal * sourceX + epsX * sourceY) / safeDet;
        const float intensity = ex[i] * ex[i] + ey[i] * ey[i];
        const float decayX = electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
        const float decayY = electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
        ex[i] = (sigmaCaX * caX * ex[i] + coupledX) * decayX;
        ey[i] = (sigmaCaY * eCaX[x] * ey[i] + coupledY) * decayY;
      }
    }
  }

  for (i32 y = 1; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 1; x < nx - 1; x += 1) {
      const i32 i = row + x;
      if (material[i] == 2) {
        zero_te_cell(hz, hzx, hzy, ex, ey, i);
        continue;
      }
      const float dEyDx = ey[i] - ey[i - 1];
      const float dExDy = ex[i] - ex[i - nx];
      const float hzxNew = (hCaX[x] * hzx[i] - hCbX[x] * (s / mu[i]) * dEyDx) / (1.0f + muLoss[i]);
      const float hzyNew = (hCaY[y] * hzy[i] + hCbY[y] * (s / muY[i]) * dExDy) / (1.0f + muLossY[i]);
      hzx[i] = hzxNew;
      hzy[i] = hzyNew;
      hz[i] = hzxNew + hzyNew;
    }
  }
}
