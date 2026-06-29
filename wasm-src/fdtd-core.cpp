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
static constexpr i32 FEATURE_TFSF = 1 << 4;

static constexpr i32 STEP_KERR = 1 << 0;
static constexpr i32 STEP_SATURABLE_GAIN = 1 << 1;
static constexpr i32 STEP_TENSOR_GYRO = 1 << 2;
static constexpr i32 TFSF_STRIDE = 16;
static constexpr float PI_F = 3.14159265358979323846f;
static constexpr float TWO_PI_F = 6.28318530717958647692f;
static constexpr float FOUR_LN2_F = 2.77258872223978123767f;

extern "C" __attribute__((import_module("env"), import_name("fdtd_sinf"))) float fdtd_sinf(float value);
extern "C" __attribute__((import_module("env"), import_name("fdtd_expf"))) float fdtd_expf(float value);

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

static inline i32 cell_id(i32 x, i32 y, i32 nx) {
  return x + y * nx;
}

static inline float safe_material_denominator(float value) {
  if (absf(value) >= 1.0e-6f) return value;
  return value < 0.0f ? -1.0e-6f : 1.0e-6f;
}

static inline float conductivity_damp(float sigma, float materialValue, float courant) {
  if (sigma <= 0.0f) return 0.0f;
  const float denominator = maxf(1.0e-6f, absf(materialValue));
  return minf(1.0e6f, (sigma * courant) / (2.0f * denominator));
}

extern "C" __attribute__((export_name("kernel_features"))) i32 kernel_features() {
  return FEATURE_CONDUCTIVITY | FEATURE_KERR | FEATURE_SATURABLE_GAIN | FEATURE_TENSOR_GYRO | FEATURE_TFSF;
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

static inline float physical_intensity(float rawIntensity, float fieldScale) {
  const float scale = fieldScale == 0.0f ? 1.0f : fieldScale;
  return minf(rawIntensity * scale * scale, 1.0e12f);
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
  float* modulationBaseEpsY,
  float fieldScale
) {
  if (kerrChi3 == 0.0f) return;
  const i32 n = nx * ny;
  const float saturation = maxf(0.05f, kerrSaturation);
  for (i32 i = 0; i < n; i += 1) {
    if (!nonlinearMaterial[i] || material[i] == 2) continue;
    const float rawIntensity = hzMode ? hx[i] * hx[i] + hy[i] * hy[i] : ez[i] * ez[i];
    const float limitedIntensity = minf(physical_intensity(rawIntensity, fieldScale), 1.0e6f);
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

static inline float source_sample_at_time(i32 type, float frequency, float amplitude, float t) {
  if (type == 1) {
    const float center = 48.0f;
    const float width = 14.0f;
    const float dt = t - center;
    return amplitude * fdtd_expf(-(dt * dt) / (2.0f * width * width));
  }
  if (type == 2) {
    const float center = 48.0f;
    const float a = PI_F * frequency * (t - center);
    const float a2 = a * a;
    return amplitude * (1.0f - 2.0f * a2) * fdtd_expf(-a2);
  }
  return amplitude * fdtd_sinf(TWO_PI_F * frequency * t);
}

static inline float tfsf_incident_envelope(const float* p, float x, float y) {
  const i32 profile = static_cast<i32>(p[1]);
  if (profile != 1) return 1.0f;
  const float fwhm = maxf(1.0e-6f, p[15]);
  const float sx = p[2];
  const float sy = p[3];
  const float cosTheta = p[4];
  const float sinTheta = p[5];
  const float transverse = -(x - sx) * sinTheta + (y - sy) * cosTheta;
  const float normalized = transverse / fwhm;
  return fdtd_expf(-FOUR_LN2_F * normalized * normalized);
}

static inline float tfsf_incident_scalar(const float* p, float x, float y, float t, float fieldScale) {
  if (fieldScale == 0.0f) return 0.0f;
  const i32 type = static_cast<i32>(p[0]);
  const float sx = p[2];
  const float sy = p[3];
  const float cosTheta = p[4];
  const float sinTheta = p[5];
  const float kCells = p[6];
  const float frequency = p[12];
  const float amplitude = p[13];
  const float phaseRad = p[14];
  const float phase = -kCells * ((x - sx) * cosTheta + (y - sy) * sinTheta);
  const float phaseTimeOffset = frequency > 0.0f ? (phase + phaseRad) / (TWO_PI_F * frequency) : 0.0f;
  const float value = source_sample_at_time(type, frequency, amplitude, t + phaseTimeOffset) * tfsf_incident_envelope(p, x, y);
  return value / fieldScale;
}

static inline float magnetic_update_coeff_x(i32 i, i32 x, float s, float* mu, float* muLoss, float* hCbX) {
  return hCbX[x] * (s / safe_material_denominator(mu[i])) / (1.0f + muLoss[i]);
}

static inline float magnetic_update_coeff_y(i32 i, i32 y, float s, float* muY, float* muLossY, float* hCbY) {
  return hCbY[y] * (s / safe_material_denominator(muY[i])) / (1.0f + muLossY[i]);
}

static inline float electric_update_coeff_x(
  i32 i,
  i32 x,
  float s,
  float intensity,
  i32 runtimeFlags,
  float gainSaturation,
  float* eps,
  float* loss,
  float* conductivity,
  float* eCbX
) {
  const float epsValue = safe_material_denominator(eps[i]);
  const float sigmaDamp = conductivity_damp(conductivity[i], epsValue, s);
  const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
  return sigmaCb * eCbX[x] * (s / epsValue) * electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
}

static inline float electric_update_coeff_y(
  i32 i,
  i32 y,
  float s,
  float intensity,
  i32 runtimeFlags,
  float gainSaturation,
  float* epsY,
  float* lossY,
  float* conductivityY,
  float* eCbY
) {
  const float epsValue = safe_material_denominator(epsY[i]);
  const float sigmaDamp = conductivity_damp(conductivityY[i], epsValue, s);
  const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
  return sigmaCb * eCbY[y] * (s / epsValue) * electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
}

static inline float transverse_electric_update_coeff_x(
  i32 i,
  i32 y,
  float s,
  float intensity,
  i32 runtimeFlags,
  float gainSaturation,
  float* eps,
  float* loss,
  float* conductivity,
  float* eCbY
) {
  const float epsValue = safe_material_denominator(eps[i]);
  const float sigmaDamp = conductivity_damp(conductivity[i], epsValue, s);
  const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
  return sigmaCb * eCbY[y] * (s / epsValue) * electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
}

static inline float transverse_electric_update_coeff_y(
  i32 i,
  i32 x,
  float s,
  float intensity,
  i32 runtimeFlags,
  float gainSaturation,
  float* epsY,
  float* lossY,
  float* conductivityY,
  float* eCbX
) {
  const float epsValue = safe_material_denominator(epsY[i]);
  const float sigmaDamp = conductivity_damp(conductivityY[i], epsValue, s);
  const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
  return sigmaCb * eCbX[x] * (s / epsValue) * electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
}

static inline void apply_tfsf_tm_magnetic(
  i32 nx,
  i32 ny,
  float s,
  float time,
  float fieldScale,
  float* tfsfSources,
  i32 tfsfSourceCount,
  float* hx,
  float* hy,
  float* mu,
  float* muLoss,
  float* muY,
  float* muLossY,
  u8* material,
  float* hCbX,
  float* hCbY
) {
  for (i32 n = 0; n < tfsfSourceCount; n += 1) {
    const float* p = tfsfSources + n * TFSF_STRIDE;
    const i32 x0 = static_cast<i32>(p[8]);
    const i32 x1 = static_cast<i32>(p[9]);
    const i32 y0 = static_cast<i32>(p[10]);
    const i32 y1 = static_cast<i32>(p[11]);
    if (x0 < 1 || x1 >= nx - 1 || y0 < 1 || y1 >= ny - 1 || x1 <= x0 || y1 <= y0) continue;
    for (i32 y = y0; y <= y1; y += 1) {
      const i32 leftIdx = cell_id(x0 - 1, y, nx);
      if (material[leftIdx] != 2) {
        const float eLeft = tfsf_incident_scalar(p, static_cast<float>(x0), static_cast<float>(y), time, fieldScale);
        hy[leftIdx] -= magnetic_update_coeff_x(leftIdx, x0 - 1, s, muY, muLossY, hCbX) * eLeft;
      }
      const i32 rightIdx = cell_id(x1, y, nx);
      if (material[rightIdx] != 2) {
        const float eRight = tfsf_incident_scalar(p, static_cast<float>(x1), static_cast<float>(y), time, fieldScale);
        hy[rightIdx] += magnetic_update_coeff_x(rightIdx, x1, s, muY, muLossY, hCbX) * eRight;
      }
    }
    for (i32 x = x0; x <= x1; x += 1) {
      const i32 topIdx = cell_id(x, y0 - 1, nx);
      if (material[topIdx] != 2) {
        const float eTop = tfsf_incident_scalar(p, static_cast<float>(x), static_cast<float>(y0), time, fieldScale);
        hx[topIdx] += magnetic_update_coeff_y(topIdx, y0 - 1, s, mu, muLoss, hCbY) * eTop;
      }
      const i32 bottomIdx = cell_id(x, y1, nx);
      if (material[bottomIdx] != 2) {
        const float eBottom = tfsf_incident_scalar(p, static_cast<float>(x), static_cast<float>(y1), time, fieldScale);
        hx[bottomIdx] -= magnetic_update_coeff_y(bottomIdx, y1, s, mu, muLoss, hCbY) * eBottom;
      }
    }
  }
}

static inline void apply_tfsf_tm_electric(
  i32 nx,
  i32 ny,
  float s,
  float time,
  float fieldScale,
  float* tfsfSources,
  i32 tfsfSourceCount,
  float* ez,
  float* ezx,
  float* ezy,
  float* eps,
  float* loss,
  float* epsY,
  float* lossY,
  float* conductivity,
  float* conductivityY,
  u8* material,
  float* eCbX,
  float* eCbY,
  i32 runtimeFlags,
  float gainSaturation
) {
  const float t = time + 0.5f;
  for (i32 n = 0; n < tfsfSourceCount; n += 1) {
    const float* p = tfsfSources + n * TFSF_STRIDE;
    const i32 x0 = static_cast<i32>(p[8]);
    const i32 x1 = static_cast<i32>(p[9]);
    const i32 y0 = static_cast<i32>(p[10]);
    const i32 y1 = static_cast<i32>(p[11]);
    if (x0 < 1 || x1 >= nx - 1 || y0 < 1 || y1 >= ny - 1 || x1 <= x0 || y1 <= y0) continue;
    const float cosTheta = p[4];
    const float sinTheta = p[5];
    const float invZ = 1.0f / maxf(1.0e-9f, p[7]);
    for (i32 y = y0; y <= y1; y += 1) {
      const i32 leftIdx = cell_id(x0, y, nx);
      if (material[leftIdx] != 2) {
        const float scalar = tfsf_incident_scalar(p, static_cast<float>(x0) - 0.5f, static_cast<float>(y), t, fieldScale);
        const float hLeft = -cosTheta * scalar * invZ;
        const float intensity = physical_intensity(ez[leftIdx] * ez[leftIdx], fieldScale);
        ezx[leftIdx] -= electric_update_coeff_x(leftIdx, x0, s, intensity, runtimeFlags, gainSaturation, eps, loss, conductivity, eCbX) * hLeft;
        ez[leftIdx] = ezx[leftIdx] + ezy[leftIdx];
      }
      const i32 rightIdx = cell_id(x1, y, nx);
      if (material[rightIdx] != 2) {
        const float scalar = tfsf_incident_scalar(p, static_cast<float>(x1) + 0.5f, static_cast<float>(y), t, fieldScale);
        const float hRight = -cosTheta * scalar * invZ;
        const float intensity = physical_intensity(ez[rightIdx] * ez[rightIdx], fieldScale);
        ezx[rightIdx] += electric_update_coeff_x(rightIdx, x1, s, intensity, runtimeFlags, gainSaturation, eps, loss, conductivity, eCbX) * hRight;
        ez[rightIdx] = ezx[rightIdx] + ezy[rightIdx];
      }
    }
    for (i32 x = x0; x <= x1; x += 1) {
      const i32 topIdx = cell_id(x, y0, nx);
      if (material[topIdx] != 2) {
        const float scalar = tfsf_incident_scalar(p, static_cast<float>(x), static_cast<float>(y0) - 0.5f, t, fieldScale);
        const float hTop = sinTheta * scalar * invZ;
        const float intensity = physical_intensity(ez[topIdx] * ez[topIdx], fieldScale);
        ezy[topIdx] += electric_update_coeff_y(topIdx, y0, s, intensity, runtimeFlags, gainSaturation, epsY, lossY, conductivityY, eCbY) * hTop;
        ez[topIdx] = ezx[topIdx] + ezy[topIdx];
      }
      const i32 bottomIdx = cell_id(x, y1, nx);
      if (material[bottomIdx] != 2) {
        const float scalar = tfsf_incident_scalar(p, static_cast<float>(x), static_cast<float>(y1) + 0.5f, t, fieldScale);
        const float hBottom = sinTheta * scalar * invZ;
        const float intensity = physical_intensity(ez[bottomIdx] * ez[bottomIdx], fieldScale);
        ezy[bottomIdx] -= electric_update_coeff_y(bottomIdx, y1, s, intensity, runtimeFlags, gainSaturation, epsY, lossY, conductivityY, eCbY) * hBottom;
        ez[bottomIdx] = ezx[bottomIdx] + ezy[bottomIdx];
      }
    }
  }
}

static inline void apply_tfsf_te_electric(
  i32 nx,
  i32 ny,
  float s,
  float time,
  float fieldScale,
  float* tfsfSources,
  i32 tfsfSourceCount,
  float* ex,
  float* ey,
  float* eps,
  float* loss,
  float* epsY,
  float* lossY,
  float* conductivity,
  float* conductivityY,
  u8* material,
  float* eCbX,
  float* eCbY,
  i32 runtimeFlags,
  float gainSaturation
) {
  for (i32 n = 0; n < tfsfSourceCount; n += 1) {
    const float* p = tfsfSources + n * TFSF_STRIDE;
    const i32 x0 = static_cast<i32>(p[8]);
    const i32 x1 = static_cast<i32>(p[9]);
    const i32 y0 = static_cast<i32>(p[10]);
    const i32 y1 = static_cast<i32>(p[11]);
    if (x0 < 1 || x1 >= nx - 1 || y0 < 1 || y1 >= ny - 1 || x1 <= x0 || y1 <= y0) continue;
    for (i32 y = y0; y <= y1; y += 1) {
      const i32 leftIdx = cell_id(x0 - 1, y, nx);
      if (material[leftIdx] != 2) {
        const float hLeft = tfsf_incident_scalar(p, static_cast<float>(x0), static_cast<float>(y), time, fieldScale);
        const float intensity = physical_intensity(ex[leftIdx] * ex[leftIdx] + ey[leftIdx] * ey[leftIdx], fieldScale);
        ey[leftIdx] += transverse_electric_update_coeff_y(leftIdx, x0 - 1, s, intensity, runtimeFlags, gainSaturation, epsY, lossY, conductivityY, eCbX) * hLeft;
      }
      const i32 rightIdx = cell_id(x1, y, nx);
      if (material[rightIdx] != 2) {
        const float hRight = tfsf_incident_scalar(p, static_cast<float>(x1), static_cast<float>(y), time, fieldScale);
        const float intensity = physical_intensity(ex[rightIdx] * ex[rightIdx] + ey[rightIdx] * ey[rightIdx], fieldScale);
        ey[rightIdx] -= transverse_electric_update_coeff_y(rightIdx, x1, s, intensity, runtimeFlags, gainSaturation, epsY, lossY, conductivityY, eCbX) * hRight;
      }
    }
    for (i32 x = x0; x <= x1; x += 1) {
      const i32 topIdx = cell_id(x, y0 - 1, nx);
      if (material[topIdx] != 2) {
        const float hTop = tfsf_incident_scalar(p, static_cast<float>(x), static_cast<float>(y0), time, fieldScale);
        const float intensity = physical_intensity(ex[topIdx] * ex[topIdx] + ey[topIdx] * ey[topIdx], fieldScale);
        ex[topIdx] -= transverse_electric_update_coeff_x(topIdx, y0 - 1, s, intensity, runtimeFlags, gainSaturation, eps, loss, conductivity, eCbY) * hTop;
      }
      const i32 bottomIdx = cell_id(x, y1, nx);
      if (material[bottomIdx] != 2) {
        const float hBottom = tfsf_incident_scalar(p, static_cast<float>(x), static_cast<float>(y1), time, fieldScale);
        const float intensity = physical_intensity(ex[bottomIdx] * ex[bottomIdx] + ey[bottomIdx] * ey[bottomIdx], fieldScale);
        ex[bottomIdx] += transverse_electric_update_coeff_x(bottomIdx, y1, s, intensity, runtimeFlags, gainSaturation, eps, loss, conductivity, eCbY) * hBottom;
      }
    }
  }
}

static inline void apply_tfsf_te_magnetic(
  i32 nx,
  i32 ny,
  float s,
  float time,
  float fieldScale,
  float* tfsfSources,
  i32 tfsfSourceCount,
  float* hz,
  float* hzx,
  float* hzy,
  float* mu,
  float* muLoss,
  float* muY,
  float* muLossY,
  u8* material,
  float* hCbX,
  float* hCbY
) {
  const float t = time + 0.5f;
  for (i32 n = 0; n < tfsfSourceCount; n += 1) {
    const float* p = tfsfSources + n * TFSF_STRIDE;
    const i32 x0 = static_cast<i32>(p[8]);
    const i32 x1 = static_cast<i32>(p[9]);
    const i32 y0 = static_cast<i32>(p[10]);
    const i32 y1 = static_cast<i32>(p[11]);
    if (x0 < 1 || x1 >= nx - 1 || y0 < 1 || y1 >= ny - 1 || x1 <= x0 || y1 <= y0) continue;
    const float cosTheta = p[4];
    const float sinTheta = p[5];
    const float z = p[7];
    for (i32 y = y0; y <= y1; y += 1) {
      const i32 leftIdx = cell_id(x0, y, nx);
      if (material[leftIdx] != 2) {
        const float scalar = tfsf_incident_scalar(p, static_cast<float>(x0) - 0.5f, static_cast<float>(y), t, fieldScale);
        const float eLeft = cosTheta * z * scalar;
        hzx[leftIdx] += magnetic_update_coeff_x(leftIdx, x0, s, mu, muLoss, hCbX) * eLeft;
        hz[leftIdx] = hzx[leftIdx] + hzy[leftIdx];
      }
      const i32 rightIdx = cell_id(x1, y, nx);
      if (material[rightIdx] != 2) {
        const float scalar = tfsf_incident_scalar(p, static_cast<float>(x1) + 0.5f, static_cast<float>(y), t, fieldScale);
        const float eRight = cosTheta * z * scalar;
        hzx[rightIdx] -= magnetic_update_coeff_x(rightIdx, x1, s, mu, muLoss, hCbX) * eRight;
        hz[rightIdx] = hzx[rightIdx] + hzy[rightIdx];
      }
    }
    for (i32 x = x0; x <= x1; x += 1) {
      const i32 topIdx = cell_id(x, y0, nx);
      if (material[topIdx] != 2) {
        const float scalar = tfsf_incident_scalar(p, static_cast<float>(x), static_cast<float>(y0) - 0.5f, t, fieldScale);
        const float eTop = -sinTheta * z * scalar;
        hzy[topIdx] -= magnetic_update_coeff_y(topIdx, y0, s, muY, muLossY, hCbY) * eTop;
        hz[topIdx] = hzx[topIdx] + hzy[topIdx];
      }
      const i32 bottomIdx = cell_id(x, y1, nx);
      if (material[bottomIdx] != 2) {
        const float scalar = tfsf_incident_scalar(p, static_cast<float>(x), static_cast<float>(y1) + 0.5f, t, fieldScale);
        const float eBottom = -sinTheta * z * scalar;
        hzy[bottomIdx] += magnetic_update_coeff_y(bottomIdx, y1, s, muY, muLossY, hCbY) * eBottom;
        hz[bottomIdx] = hzx[bottomIdx] + hzy[bottomIdx];
      }
    }
  }
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
  float gainSaturation,
  float time,
  float fieldScale,
  u32 tfsfSourcesOffset,
  i32 tfsfSourceCount
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
  float* tfsfSources = f32(tfsfSourcesOffset);

  if (runtimeFlags & STEP_KERR) {
    apply_kerr_response(nx, ny, 0, kerrChi3, kerrSaturation, ez, hx, hy, eps, epsY, material, nonlinearMaterial, modulationBaseEps, modulationBaseEpsY, fieldScale);
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

  if (tfsfSourceCount > 0) {
    apply_tfsf_tm_magnetic(nx, ny, s, time, fieldScale, tfsfSources, tfsfSourceCount, hx, hy, mu, muLoss, muY, muLossY, material, hCbX, hCbY);
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
      const float intensity = physical_intensity(ez[i] * ez[i], fieldScale);
      const float decayX = electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
      const float decayY = electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
      const float ezxNew = (sigmaCaX * eCaX[x] * ezx[i] + sigmaCbX * eCbX[x] * (s / eps[i]) * dHyDx) * decayX;
      const float ezyNew = (sigmaCaY * eCaY[y] * ezy[i] - sigmaCbY * eCbY[y] * (s / epsY[i]) * dHxDy) * decayY;
      ezx[i] = ezxNew;
      ezy[i] = ezyNew;
      ez[i] = ezxNew + ezyNew;
    }
  }

  if (tfsfSourceCount > 0) {
    apply_tfsf_tm_electric(
      nx,
      ny,
      s,
      time,
      fieldScale,
      tfsfSources,
      tfsfSourceCount,
      ez,
      ezx,
      ezy,
      eps,
      loss,
      epsY,
      lossY,
      conductivity,
      conductivityY,
      material,
      eCbX,
      eCbY,
      runtimeFlags,
      gainSaturation
    );
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
  float gainSaturation,
  float time,
  float fieldScale,
  u32 tfsfSourcesOffset,
  i32 tfsfSourceCount
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
  float* tfsfSources = f32(tfsfSourcesOffset);

  if (runtimeFlags & STEP_KERR) {
    apply_kerr_response(nx, ny, 1, kerrChi3, kerrSaturation, hz, ex, ey, eps, epsY, material, nonlinearMaterial, modulationBaseEps, modulationBaseEpsY, fieldScale);
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
      const float intensity = physical_intensity(ex[i] * ex[i] + ey[i] * ey[i], fieldScale);
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
      const float intensity = physical_intensity(ex[i] * ex[i] + ey[i] * ey[i], fieldScale);
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
        const float intensity = physical_intensity(ex[i] * ex[i] + ey[i] * ey[i], fieldScale);
        const float decayX = electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
        const float decayY = electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
        ex[i] = (sigmaCaX * caX * ex[i] + coupledX) * decayX;
        ey[i] = (sigmaCaY * eCaX[x] * ey[i] + coupledY) * decayY;
      }
    }
  }

  if (tfsfSourceCount > 0) {
    apply_tfsf_te_electric(
      nx,
      ny,
      s,
      time,
      fieldScale,
      tfsfSources,
      tfsfSourceCount,
      ex,
      ey,
      eps,
      loss,
      epsY,
      lossY,
      conductivity,
      conductivityY,
      material,
      eCbX,
      eCbY,
      runtimeFlags,
      gainSaturation
    );
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

  if (tfsfSourceCount > 0) {
    apply_tfsf_te_magnetic(nx, ny, s, time, fieldScale, tfsfSources, tfsfSourceCount, hz, hzx, hzy, mu, muLoss, muY, muLossY, material, hCbX, hCbY);
  }
}
