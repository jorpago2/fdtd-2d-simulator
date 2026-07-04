// Minimal C++ source for the browser WASM FDTD kernel.
//
// The exported signatures intentionally match src/runtime/simulation/wasm-backend.js:
// array arguments are byte offsets into the imported
// WebAssembly linear memory owned by JavaScript.

using i32 = int;
using u32 = unsigned int;
using u8 = unsigned char;

static constexpr i32 FEATURE_CONDUCTIVITY = 1 << 0;
static constexpr i32 FEATURE_KERR = 1 << 1;
static constexpr i32 FEATURE_SATURABLE_GAIN = 1 << 2;
static constexpr i32 FEATURE_TENSOR_GYRO = 1 << 3;
static constexpr i32 FEATURE_TFSF = 1 << 4;
static constexpr i32 FEATURE_CPML = 1 << 5;
static constexpr i32 FEATURE_MODE_SOURCE = 1 << 6;
static constexpr i32 FEATURE_ELECTRIC_ADE = 1 << 7;
static constexpr i32 FEATURE_MAGNETIC_ADE = 1 << 8;
static constexpr i32 FEATURE_MODULATION = 1 << 9;
static constexpr i32 FEATURE_HARMONIC = 1 << 10;
static constexpr i32 FEATURE_PHASE_CHANGE = 1 << 11;
static constexpr i32 FEATURE_BIANISOTROPY = 1 << 12;

static constexpr i32 STEP_KERR = 1 << 0;
static constexpr i32 STEP_SATURABLE_GAIN = 1 << 1;
static constexpr i32 STEP_TENSOR_GYRO = 1 << 2;
static constexpr i32 STEP_ELECTRIC_ADE = 1 << 3;
static constexpr i32 STEP_MAGNETIC_ADE = 1 << 4;
static constexpr i32 STEP_MODULATION = 1 << 5;
static constexpr i32 TFSF_STRIDE = 16;
static constexpr i32 MODE_SOURCE_STRIDE = 16;
static constexpr float PI_F = 3.14159265358979323846f;
static constexpr float TWO_PI_F = 6.28318530717958647692f;
static constexpr float FOUR_LN2_F = 2.77258872223978123767f;

extern "C" __attribute__((import_module("env"), import_name("fdtd_sinf"))) float fdtd_sinf(float value);
extern "C" __attribute__((import_module("env"), import_name("fdtd_cosf"))) float fdtd_cosf(float value);
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

static inline float sqrtf_local(float value) {
  return value <= 0.0f ? 0.0f : __builtin_sqrtf(value);
}

static inline float clampf(float value, float low, float high) {
  return minf(maxf(value, low), high);
}

static inline bool nearly_equal(float left, float right) {
  const float scale = maxf(1.0f, maxf(absf(left), absf(right)));
  return absf(left - right) <= 1.0e-6f * scale;
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
  return FEATURE_CONDUCTIVITY | FEATURE_KERR | FEATURE_SATURABLE_GAIN | FEATURE_TENSOR_GYRO | FEATURE_TFSF | FEATURE_CPML | FEATURE_MODE_SOURCE | FEATURE_ELECTRIC_ADE | FEATURE_MAGNETIC_ADE | FEATURE_MODULATION | FEATURE_HARMONIC | FEATURE_PHASE_CHANGE | FEATURE_BIANISOTROPY;
}

static inline double measure_poynting_value(
  i32 mode,
  bool hzMode,
  bool fullVector,
  float ez,
  float hx,
  float hy,
  float dualEz,
  float dualHx,
  float dualHy
) {
  float sx = 0.0f;
  float sy = 0.0f;
  if (hzMode) {
    if (fullVector) {
      sx = hy * ez - dualEz * dualHy;
      sy = dualEz * dualHx - hx * ez;
    } else {
      sx = hy * ez;
      sy = -hx * ez;
    }
  } else {
    sx = -ez * hy;
    sy = ez * hx;
  }
  if (mode == 6) return static_cast<double>(sx);
  if (mode == 7) return static_cast<double>(sy);
  return static_cast<double>(sqrtf_local(sx * sx + sy * sy));
}

static inline double measure_field_value(
  i32 mode,
  bool hzMode,
  bool fullVector,
  float ez,
  float hx,
  float hy,
  float dualEz,
  float dualHx,
  float dualHy
) {
  if (mode >= 5) return measure_poynting_value(mode, hzMode, fullVector, ez, hx, hy, dualEz, dualHx, dualHy);
  if (mode == 1) return static_cast<double>(hx);
  if (mode == 2) return static_cast<double>(hy);
  if (mode == 3) {
    if (hzMode) {
      return fullVector
        ? static_cast<double>(sqrtf_local(hx * hx + hy * hy + dualEz * dualEz))
        : static_cast<double>(sqrtf_local(hx * hx + hy * hy));
    }
    return static_cast<double>(absf(ez));
  }
  if (mode == 4) {
    if (hzMode) {
      return fullVector
        ? static_cast<double>(sqrtf_local(ez * ez + dualHx * dualHx + dualHy * dualHy))
        : static_cast<double>(absf(ez));
    }
    return static_cast<double>(sqrtf_local(hx * hx + hy * hy));
  }
  return static_cast<double>(ez);
}

extern "C" __attribute__((export_name("measure_field"))) void measure_field(
  i32 n,
  i32 mode,
  i32 hzModeValue,
  i32 fullVectorValue,
  u32 ezOffset,
  u32 hxOffset,
  u32 hyOffset,
  u32 dualEzOffset,
  u32 dualHxOffset,
  u32 dualHyOffset,
  u32 outputOffset
) {
  float* ez = f32(ezOffset);
  float* hx = f32(hxOffset);
  float* hy = f32(hyOffset);
  float* dualEz = f32(dualEzOffset);
  float* dualHx = f32(dualHxOffset);
  float* dualHy = f32(dualHyOffset);
  double* output = reinterpret_cast<double*>(outputOffset);
  const bool hzMode = hzModeValue != 0;
  const bool fullVector = fullVectorValue != 0;
  double maxAbs = 0.0;
  double energy = 0.0;

  for (i32 i = 0; i < n; i += 1) {
    const double value = measure_field_value(mode, hzMode, fullVector, ez[i], hx[i], hy[i], dualEz[i], dualHx[i], dualHy[i]);
    const double absValue = value < 0.0 ? -value : value;
    if (absValue > maxAbs) maxAbs = absValue;
    energy += value * value;
  }

  output[0] = maxAbs;
  output[1] = energy;
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

static inline float magnetic_loss_decay(float loss) {
  const float value = maxf(-0.95f, loss);
  return 1.0f / (1.0f + value);
}

static inline float physical_intensity(float rawIntensity, float fieldScale) {
  const float scale = fieldScale == 0.0f ? 1.0f : fieldScale;
  return minf(rawIntensity * scale * scale, 1.0e12f);
}

static inline void apply_dynamic_permittivity_response(
  i32 nx,
  i32 ny,
  i32 hzMode,
  i32 runtimeFlags,
  float kerrChi3,
  float kerrSaturation,
  float modulationDepth,
  float modulationPeriodCells,
  float modulationCosTheta,
  float modulationSinTheta,
  float modulationOmegaCycles,
  float modulationPhase,
  float time,
  float* ez,
  float* hx,
  float* hy,
  float* eps,
  float* epsY,
  u8* material,
  u8* modulatedMaterial,
  float* modulationPhaseOffset,
  u8* nonlinearMaterial,
  float* modulationBaseEps,
  float* modulationBaseEpsY,
  float fieldScale
) {
  const bool kerrActive = (runtimeFlags & STEP_KERR) && kerrChi3 != 0.0f;
  const bool modulationActive = (runtimeFlags & STEP_MODULATION) && modulationDepth > 0.0f;
  if (!kerrActive && !modulationActive) return;
  const float saturation = maxf(0.05f, kerrSaturation);
  const float periodCells = maxf(1.0f, modulationPeriodCells);
  const float depth = clampf(modulationDepth, 0.0f, 0.95f);
  for (i32 y = 0; y < ny; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 0; x < nx; x += 1) {
      const i32 i = row + x;
      if (material[i] == 2) continue;
      if ((!modulationActive || !modulatedMaterial[i]) && (!kerrActive || !nonlinearMaterial[i])) continue;
      float factor = 1.0f;
      if (modulationActive && modulatedMaterial[i]) {
        const float spatialCycles = (static_cast<float>(x) * modulationCosTheta + static_cast<float>(y) * modulationSinTheta) / periodCells;
        const float argument = TWO_PI_F * (spatialCycles - modulationOmegaCycles * time) + modulationPhase + modulationPhaseOffset[i];
        factor += depth * fdtd_cosf(argument);
      }
      float deltaEps = 0.0f;
      if (kerrActive && nonlinearMaterial[i]) {
        const float rawIntensity = hzMode ? hx[i] * hx[i] + hy[i] * hy[i] : ez[i] * ez[i];
        const float limitedIntensity = minf(physical_intensity(rawIntensity, fieldScale), 1.0e6f);
        const float saturatedIntensity = limitedIntensity / (1.0f + limitedIntensity / saturation);
        deltaEps = kerrChi3 * saturatedIntensity;
      }
      eps[i] = clampf(modulationBaseEps[i] * factor + deltaEps, -30.0f, 30.0f);
      epsY[i] = clampf(modulationBaseEpsY[i] * factor + deltaEps, -30.0f, 30.0f);
    }
  }
}

static inline float lerpf(float left, float right, float weight) {
  return left + (right - left) * weight;
}

extern "C" __attribute__((export_name("apply_phase_change_response"))) void apply_phase_change_response(
  i32 nx,
  i32 ny,
  i32 hzMode,
  u32 scalarFieldOffset,
  u32 fieldXOffset,
  u32 fieldYOffset,
  u32 epsOffset,
  u32 lossOffset,
  u32 epsYOffset,
  u32 lossYOffset,
  u32 materialOffset,
  u32 modulatedMaterialOffset,
  u32 nonlinearMaterialOffset,
  u32 modulationBaseEpsOffset,
  u32 modulationBaseEpsYOffset,
  u32 phaseChangeMaterialOffset,
  u32 phaseStateOffset,
  u32 phaseEpsOffOffset,
  u32 phaseLossOffOffset,
  u32 phaseEpsYOffOffset,
  u32 phaseLossYOffOffset,
  u32 phaseEpsOnOffset,
  u32 phaseLossOnOffset,
  u32 phaseEpsYOnOffset,
  u32 phaseLossYOnOffset,
  float thresholdOnValue,
  float thresholdOffValue,
  float tauOnValue,
  float tauOffValue,
  float fieldScale
) {
  const i32 n = nx * ny;
  float* scalarField = f32(scalarFieldOffset);
  float* fieldX = f32(fieldXOffset);
  float* fieldY = f32(fieldYOffset);
  float* eps = f32(epsOffset);
  float* loss = f32(lossOffset);
  float* epsY = f32(epsYOffset);
  float* lossY = f32(lossYOffset);
  u8* material = u8_array(materialOffset);
  u8* modulatedMaterial = u8_array(modulatedMaterialOffset);
  u8* nonlinearMaterial = u8_array(nonlinearMaterialOffset);
  float* modulationBaseEps = f32(modulationBaseEpsOffset);
  float* modulationBaseEpsY = f32(modulationBaseEpsYOffset);
  u8* phaseChangeMaterial = u8_array(phaseChangeMaterialOffset);
  float* phaseState = f32(phaseStateOffset);
  float* phaseEpsOff = f32(phaseEpsOffOffset);
  float* phaseLossOff = f32(phaseLossOffOffset);
  float* phaseEpsYOff = f32(phaseEpsYOffOffset);
  float* phaseLossYOff = f32(phaseLossYOffOffset);
  float* phaseEpsOn = f32(phaseEpsOnOffset);
  float* phaseLossOn = f32(phaseLossOnOffset);
  float* phaseEpsYOn = f32(phaseEpsYOnOffset);
  float* phaseLossYOn = f32(phaseLossYOnOffset);

  const float thresholdOn = maxf(0.0f, thresholdOnValue);
  const float thresholdOff = minf(thresholdOn, maxf(0.0f, thresholdOffValue));
  const float tauOn = maxf(1.0f, tauOnValue);
  const float tauOff = maxf(1.0f, tauOffValue);
  const float alphaOn = 1.0f - fdtd_expf(-1.0f / tauOn);
  const float alphaOff = 1.0f - fdtd_expf(-1.0f / tauOff);

  for (i32 i = 0; i < n; i += 1) {
    if (!phaseChangeMaterial[i] || material[i] == 2) continue;
    const float rawIntensity = hzMode ? fieldX[i] * fieldX[i] + fieldY[i] * fieldY[i] : scalarField[i] * scalarField[i];
    const float intensity = physical_intensity(rawIntensity, fieldScale);
    float stateValue = phaseState[i];
    if (intensity >= thresholdOn) {
      stateValue += (1.0f - stateValue) * alphaOn;
    } else if (intensity <= thresholdOff) {
      stateValue -= stateValue * alphaOff;
    }
    stateValue = clampf(stateValue, 0.0f, 1.0f);
    phaseState[i] = stateValue;
    eps[i] = clampf(lerpf(phaseEpsOff[i], phaseEpsOn[i], stateValue), -30.0f, 30.0f);
    loss[i] = clampf(lerpf(phaseLossOff[i], phaseLossOn[i], stateValue), -30.0f, 30.0f);
    epsY[i] = clampf(lerpf(phaseEpsYOff[i], phaseEpsYOn[i], stateValue), -30.0f, 30.0f);
    lossY[i] = clampf(lerpf(phaseLossYOff[i], phaseLossYOn[i], stateValue), -30.0f, 30.0f);
    if (modulatedMaterial[i] || nonlinearMaterial[i]) {
      modulationBaseEps[i] = eps[i];
      modulationBaseEpsY[i] = epsY[i];
    }
  }
}

static inline float harmonic_nonlinear_polarization(
  float fieldValue,
  float chi2Value,
  float chi3Value,
  float saturationValue
) {
  const float chi2 = clampf(chi2Value, -2.0f, 2.0f);
  const float chi3 = clampf(chi3Value, -2.0f, 2.0f);
  if (chi2 == 0.0f && chi3 == 0.0f) return 0.0f;
  const float field = clampf(fieldValue, -1.0e4f, 1.0e4f);
  const float saturation = maxf(0.05f, saturationValue);
  const float field2 = field * field;
  const float limiter = 1.0f / (1.0f + field2 / saturation);
  return limiter * (chi2 * field2 + chi3 * field2 * field);
}

extern "C" __attribute__((export_name("apply_harmonic_nonlinear_response"))) void apply_harmonic_nonlinear_response(
  i32 nx,
  i32 ny,
  i32 hzMode,
  float s,
  u32 scalarFieldOffset,
  u32 splitXOffset,
  u32 splitYOffset,
  u32 fieldXOffset,
  u32 fieldYOffset,
  u32 epsOffset,
  u32 epsYOffset,
  u32 materialOffset,
  u32 nonlinearMaterialOffset,
  u32 harmonicPrevPzOffset,
  u32 harmonicPrevPxOffset,
  u32 harmonicPrevPyOffset,
  float harmonicChi2,
  float harmonicChi3,
  float harmonicSaturation,
  float fieldScale
) {
  const float chi2 = clampf(harmonicChi2, -2.0f, 2.0f);
  const float chi3 = clampf(harmonicChi3, -2.0f, 2.0f);
  if (chi2 == 0.0f && chi3 == 0.0f) return;
  const float scale = fieldScale == 0.0f ? 1.0f : fieldScale;
  const float rawScale = 1.0f / maxf(1.0e-12f, scale);
  float* scalarField = f32(scalarFieldOffset);
  float* splitX = f32(splitXOffset);
  float* splitY = f32(splitYOffset);
  float* fieldX = f32(fieldXOffset);
  float* fieldY = f32(fieldYOffset);
  float* eps = f32(epsOffset);
  float* epsY = f32(epsYOffset);
  u8* material = u8_array(materialOffset);
  u8* nonlinearMaterial = u8_array(nonlinearMaterialOffset);
  float* harmonicPrevPz = f32(harmonicPrevPzOffset);
  float* harmonicPrevPx = f32(harmonicPrevPxOffset);
  float* harmonicPrevPy = f32(harmonicPrevPyOffset);

  if (hzMode) {
    for (i32 y = 1; y < ny - 1; y += 1) {
      const i32 row = y * nx;
      for (i32 x = 1; x < nx - 1; x += 1) {
        const i32 i = row + x;
        if (!nonlinearMaterial[i] || material[i] == 2) continue;
        const float px = harmonic_nonlinear_polarization(fieldX[i] * scale, chi2, chi3, harmonicSaturation);
        const float py = harmonic_nonlinear_polarization(fieldY[i] * scale, chi2, chi3, harmonicSaturation);
        const float jx = clampf((px - harmonicPrevPx[i]) * rawScale, -1.0e4f, 1.0e4f);
        const float jy = clampf((py - harmonicPrevPy[i]) * rawScale, -1.0e4f, 1.0e4f);
        harmonicPrevPx[i] = px;
        harmonicPrevPy[i] = py;
        fieldX[i] -= (s / safe_material_denominator(eps[i])) * jx;
        fieldY[i] -= (s / safe_material_denominator(epsY[i])) * jy;
      }
    }
    return;
  }

  for (i32 y = 1; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 1; x < nx - 1; x += 1) {
      const i32 i = row + x;
      if (!nonlinearMaterial[i] || material[i] == 2) continue;
      const float pz = harmonic_nonlinear_polarization(scalarField[i] * scale, chi2, chi3, harmonicSaturation);
      const float jz = clampf((pz - harmonicPrevPz[i]) * rawScale, -1.0e4f, 1.0e4f);
      harmonicPrevPz[i] = pz;
      splitX[i] -= (s / safe_material_denominator(eps[i])) * jz * 0.5f;
      splitY[i] -= (s / safe_material_denominator(epsY[i])) * jz * 0.5f;
      scalarField[i] = splitX[i] + splitY[i];
    }
  }
}

struct BianisotropicPair {
  float electric;
  float magnetic;
};

static inline float normalize_bianisotropy_kappa(float value, float limit) {
  const float finiteLimit = maxf(0.0f, limit);
  return clampf(value, -finiteLimit, finiteLimit);
}

static inline BianisotropicPair solve_bianisotropic_increment(
  float oldElectric,
  float oldMagnetic,
  float nextElectric,
  float nextMagnetic,
  float epsValue,
  float muValue,
  float kappaNorm
) {
  const float epsEff = safe_material_denominator(epsValue);
  const float muEff = safe_material_denominator(muValue);
  const float kappaScale = sqrtf_local(absf(epsEff * muEff));
  const float kappa = kappaNorm * kappaScale;
  const float det = epsEff * muEff - kappa * kappa;
  if (absf(det) <= 1.0e-9f) {
    return { nextElectric, nextMagnetic };
  }
  const float deltaElectric0 = clampf(nextElectric - oldElectric, -1.0e4f, 1.0e4f);
  const float deltaMagnetic0 = clampf(nextMagnetic - oldMagnetic, -1.0e4f, 1.0e4f);
  if (deltaElectric0 == 0.0f && deltaMagnetic0 == 0.0f) {
    return { oldElectric, oldMagnetic };
  }
  const float dDisplacement = epsEff * deltaElectric0;
  const float dFlux = muEff * deltaMagnetic0;
  const float deltaElectric = (muEff * dDisplacement - kappa * dFlux) / det;
  const float deltaMagnetic = (-kappa * dDisplacement + epsEff * dFlux) / det;
  return {
    oldElectric + clampf(deltaElectric, -1.0e4f, 1.0e4f),
    oldMagnetic + clampf(deltaMagnetic, -1.0e4f, 1.0e4f)
  };
}

static inline void set_split_field_value(
  i32 i,
  float* scalar,
  float* splitX,
  float* splitY,
  float nextValue
) {
  const float value = nextValue;
  const float oldValue = scalar[i];
  if (absf(oldValue) > 1.0e-12f) {
    const float scale = value / oldValue;
    splitX[i] *= scale;
    splitY[i] *= scale;
  } else {
    splitX[i] = value * 0.5f;
    splitY[i] = value * 0.5f;
  }
  scalar[i] = value;
}

extern "C" __attribute__((export_name("apply_bianisotropic_response"))) void apply_bianisotropic_response(
  i32 n,
  i32 hzMode,
  i32 fullVectorMode,
  u32 ezOffset,
  u32 ezxOffset,
  u32 ezyOffset,
  u32 hxOffset,
  u32 hyOffset,
  u32 dualEzOffset,
  u32 dualEzxOffset,
  u32 dualEzyOffset,
  u32 dualHxOffset,
  u32 dualHyOffset,
  u32 epsOffset,
  u32 epsYOffset,
  u32 muOffset,
  u32 muYOffset,
  u32 materialOffset,
  u32 bianisotropicMaterialOffset,
  u32 bianisotropyKappaOffset,
  u32 bianisotropyPrevScalarOffset,
  u32 bianisotropyPrevSplitXOffset,
  u32 bianisotropyPrevSplitYOffset,
  u32 bianisotropyPrevTxOffset,
  u32 bianisotropyPrevTyOffset,
  u32 bianisotropyPrevDualEzOffset,
  u32 bianisotropyPrevDualEzxOffset,
  u32 bianisotropyPrevDualEzyOffset,
  u32 bianisotropyPrevDualHxOffset,
  u32 bianisotropyPrevDualHyOffset,
  float kappaLimit
) {
  float* ez = f32(ezOffset);
  float* ezx = f32(ezxOffset);
  float* ezy = f32(ezyOffset);
  float* hx = f32(hxOffset);
  float* hy = f32(hyOffset);
  float* dualEz = f32(dualEzOffset);
  float* dualEzx = f32(dualEzxOffset);
  float* dualEzy = f32(dualEzyOffset);
  float* dualHx = f32(dualHxOffset);
  float* dualHy = f32(dualHyOffset);
  float* eps = f32(epsOffset);
  float* epsY = f32(epsYOffset);
  float* mu = f32(muOffset);
  float* muY = f32(muYOffset);
  u8* material = u8_array(materialOffset);
  u8* bianisotropicMaterial = u8_array(bianisotropicMaterialOffset);
  float* bianisotropyKappa = f32(bianisotropyKappaOffset);
  float* bianisotropyPrevScalar = f32(bianisotropyPrevScalarOffset);
  float* bianisotropyPrevSplitX = f32(bianisotropyPrevSplitXOffset);
  float* bianisotropyPrevSplitY = f32(bianisotropyPrevSplitYOffset);
  float* bianisotropyPrevTx = f32(bianisotropyPrevTxOffset);
  float* bianisotropyPrevTy = f32(bianisotropyPrevTyOffset);
  float* bianisotropyPrevDualEz = f32(bianisotropyPrevDualEzOffset);
  float* bianisotropyPrevDualEzx = f32(bianisotropyPrevDualEzxOffset);
  float* bianisotropyPrevDualEzy = f32(bianisotropyPrevDualEzyOffset);
  float* bianisotropyPrevDualHx = f32(bianisotropyPrevDualHxOffset);
  float* bianisotropyPrevDualHy = f32(bianisotropyPrevDualHyOffset);

  for (i32 i = 0; i < n; i += 1) {
    if (!bianisotropicMaterial[i] || material[i] == 2) continue;
    const float kappa = normalize_bianisotropy_kappa(bianisotropyKappa[i], kappaLimit);
    if (kappa == 0.0f) continue;

    if (fullVectorMode) {
      const BianisotropicPair pairX = solve_bianisotropic_increment(
        bianisotropyPrevTx[i],
        bianisotropyPrevDualHx[i],
        hx[i],
        dualHx[i],
        eps[i],
        mu[i],
        kappa
      );
      hx[i] = pairX.electric;
      dualHx[i] = pairX.magnetic;

      const BianisotropicPair pairY = solve_bianisotropic_increment(
        bianisotropyPrevTy[i],
        bianisotropyPrevDualHy[i],
        hy[i],
        dualHy[i],
        epsY[i],
        muY[i],
        kappa
      );
      hy[i] = pairY.electric;
      dualHy[i] = pairY.magnetic;

      const float epsZ = 0.5f * (safe_material_denominator(eps[i]) + safe_material_denominator(epsY[i]));
      const float muZ = 0.5f * (safe_material_denominator(mu[i]) + safe_material_denominator(muY[i]));
      const BianisotropicPair pairZ = solve_bianisotropic_increment(
        bianisotropyPrevDualEz[i],
        bianisotropyPrevScalar[i],
        dualEz[i],
        ez[i],
        epsZ,
        muZ,
        kappa
      );
      set_split_field_value(i, dualEz, dualEzx, dualEzy, pairZ.electric);
      set_split_field_value(i, ez, ezx, ezy, pairZ.magnetic);

      bianisotropyPrevDualEz[i] = dualEz[i];
      bianisotropyPrevDualEzx[i] = dualEzx[i];
      bianisotropyPrevDualEzy[i] = dualEzy[i];
      bianisotropyPrevDualHx[i] = dualHx[i];
      bianisotropyPrevDualHy[i] = dualHy[i];
    } else if (hzMode) {
      const BianisotropicPair pairX = solve_bianisotropic_increment(
        bianisotropyPrevTy[i],
        bianisotropyPrevSplitX[i],
        hy[i],
        ezx[i],
        epsY[i],
        mu[i],
        kappa
      );
      const BianisotropicPair pairY = solve_bianisotropic_increment(
        bianisotropyPrevTx[i],
        bianisotropyPrevSplitY[i],
        hx[i],
        ezy[i],
        eps[i],
        muY[i],
        -kappa
      );
      hy[i] = pairX.electric;
      ezx[i] = pairX.magnetic;
      hx[i] = pairY.electric;
      ezy[i] = pairY.magnetic;
      ez[i] = ezx[i] + ezy[i];
    } else {
      const BianisotropicPair pairX = solve_bianisotropic_increment(
        bianisotropyPrevSplitX[i],
        bianisotropyPrevTy[i],
        ezx[i],
        hy[i],
        eps[i],
        muY[i],
        kappa
      );
      const BianisotropicPair pairY = solve_bianisotropic_increment(
        bianisotropyPrevSplitY[i],
        bianisotropyPrevTx[i],
        ezy[i],
        hx[i],
        epsY[i],
        mu[i],
        -kappa
      );
      ezx[i] = pairX.electric;
      hy[i] = pairX.magnetic;
      ezy[i] = pairY.electric;
      hx[i] = pairY.magnetic;
      ez[i] = ezx[i] + ezy[i];
    }

    bianisotropyPrevScalar[i] = ez[i];
    bianisotropyPrevSplitX[i] = ezx[i];
    bianisotropyPrevSplitY[i] = ezy[i];
    bianisotropyPrevTx[i] = hx[i];
    bianisotropyPrevTy[i] = hy[i];
  }
}

struct AdeAdvance {
  float polarization;
  float current;
};

static inline AdeAdvance advance_second_order_polarization(
  float fieldValue,
  float polarizationValue,
  float currentValue,
  float resonanceOmega,
  float dampingGamma,
  float driveCoeff
) {
  const float gammaHalf = 0.5f * maxf(0.0f, dampingGamma);
  const float omega = maxf(0.0f, resonanceOmega);
  const float omega2 = omega * omega;
  const float previousPolarization = polarizationValue - currentValue;
  const float denominator = 1.0f + gammaHalf;
  const float nextPolarization =
    ((2.0f - omega2) * polarizationValue - (1.0f - gammaHalf) * previousPolarization + driveCoeff * fieldValue) /
    denominator;
  return { nextPolarization, nextPolarization - polarizationValue };
}

static inline float advance_ade_current(
  i32 i,
  float fieldValue,
  u8* adeMaterial,
  float* adeOmegaP,
  float* adeGamma,
  float* adeOmega0,
  float* adeDelta,
  float* adeTau,
  float* polarization,
  float* current
) {
  const u8 kind = adeMaterial[i];
  if (!kind) return 0.0f;

  const float gamma = maxf(0.0f, adeGamma[i]);
  float p = polarization[i];
  float j = current[i];

  if (kind == 1) {
    const float omegaP = maxf(0.0f, adeOmegaP[i]);
    const AdeAdvance next = advance_second_order_polarization(fieldValue, p, j, 0.0f, gamma, omegaP * omegaP);
    p = next.polarization;
    j = next.current;
  } else if (kind == 2) {
    const float omega0 = maxf(0.0f, adeOmega0[i]);
    const float delta = adeDelta[i];
    const AdeAdvance next =
      advance_second_order_polarization(fieldValue, p, j, omega0, gamma, delta * omega0 * omega0);
    p = next.polarization;
    j = next.current;
  } else if (kind == 3) {
    const float tau = maxf(1.0f, adeTau[i]);
    const float relax = fdtd_expf(-1.0f / tau);
    const float nextP = relax * p + (1.0f - relax) * adeDelta[i] * fieldValue;
    j = nextP - p;
    p = nextP;
  }

  polarization[i] = clampf(p, -1.0e6f, 1.0e6f);
  current[i] = clampf(j, -1.0e6f, 1.0e6f);
  return current[i];
}

static inline void apply_electric_ade_tm(
  i32 nx,
  i32 ny,
  float s,
  float* ez,
  float* ezx,
  float* ezy,
  float* eps,
  float* epsY,
  u8* material,
  u8* dispersiveMaterial,
  u8* dispersionAxes,
  float* dispersionOmegaP,
  float* dispersionGamma,
  float* dispersionOmega0,
  float* dispersionDeltaEps,
  float* dispersionTau,
  float* dispPz,
  float* dispJz
) {
  for (i32 y = 1; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 1; x < nx - 1; x += 1) {
      const i32 i = row + x;
      if (!dispersiveMaterial[i] || material[i] == 2) continue;
      const u8 axes = dispersionAxes[i] ? dispersionAxes[i] : 3;
      if (!(axes & 1)) continue;
      const float jz = advance_ade_current(
        i,
        ez[i],
        dispersiveMaterial,
        dispersionOmegaP,
        dispersionGamma,
        dispersionOmega0,
        dispersionDeltaEps,
        dispersionTau,
        dispPz,
        dispJz
      );
      const float epsX = safe_material_denominator(eps[i]);
      const float epsYi = safe_material_denominator(epsY[i]);
      ezx[i] -= (s / epsX) * jz * 0.5f;
      ezy[i] -= (s / epsYi) * jz * 0.5f;
      ez[i] = ezx[i] + ezy[i];
    }
  }
}

static inline void apply_te_electric_current_vector(
  i32 i,
  float s,
  float jx,
  float jy,
  float* ex,
  float* ey,
  float* eps,
  float* epsY,
  float* epsilonXY,
  float* gyrotropyG
) {
  if (jx == 0.0f && jy == 0.0f) return;
  const float sourceX = -s * jx;
  const float sourceY = -s * jy;
  const float epsX = eps[i];
  const float epsYi = epsY[i];
  const float k = epsilonXY[i];
  const float g = gyrotropyG[i];
  const float upperOffDiagonal = k + g;
  const float lowerOffDiagonal = k - g;
  const float det = epsX * epsYi - upperOffDiagonal * lowerOffDiagonal;
  const float safeDet = absf(det) < 1.0e-6f ? (det < 0.0f ? -1.0e-6f : 1.0e-6f) : det;
  ex[i] += (epsYi * sourceX - upperOffDiagonal * sourceY) / safeDet;
  ey[i] += (-lowerOffDiagonal * sourceX + epsX * sourceY) / safeDet;
}

static inline void apply_electric_ade_te(
  i32 nx,
  i32 ny,
  float s,
  float* ex,
  float* ey,
  float* eps,
  float* epsY,
  float* epsilonXY,
  float* gyrotropyG,
  u8* material,
  u8* dispersiveMaterial,
  u8* dispersionAxes,
  float* dispersionAxisX,
  float* dispersionAxisY,
  float* dispersionOmegaP,
  float* dispersionGamma,
  float* dispersionOmega0,
  float* dispersionDeltaEps,
  float* dispersionTau,
  float* dispPx,
  float* dispJx,
  float* dispPy,
  float* dispJy
) {
  for (i32 y = 1; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 1; x < nx - 1; x += 1) {
      const i32 i = row + x;
      if (!dispersiveMaterial[i] || material[i] == 2) continue;
      const u8 axes = dispersionAxes[i] ? dispersionAxes[i] : 3;
      float jx = 0.0f;
      float jy = 0.0f;
      if (axes == 1) {
        const float axisX = dispersionAxisX[i];
        const float axisY = dispersionAxisY[i];
        const float fieldAlongAxis = axisX * ex[i] + axisY * ey[i];
        const float jAxis = advance_ade_current(
          i,
          fieldAlongAxis,
          dispersiveMaterial,
          dispersionOmegaP,
          dispersionGamma,
          dispersionOmega0,
          dispersionDeltaEps,
          dispersionTau,
          dispPx,
          dispJx
        );
        jx = axisX * jAxis;
        jy = axisY * jAxis;
      } else {
        if (axes & 1) {
          jx = advance_ade_current(
            i,
            ex[i],
            dispersiveMaterial,
            dispersionOmegaP,
            dispersionGamma,
            dispersionOmega0,
            dispersionDeltaEps,
            dispersionTau,
            dispPx,
            dispJx
          );
        }
        if (axes & 2) {
          jy = advance_ade_current(
            i,
            ey[i],
            dispersiveMaterial,
            dispersionOmegaP,
            dispersionGamma,
            dispersionOmega0,
            dispersionDeltaEps,
            dispersionTau,
            dispPy,
            dispJy
          );
        }
      }
      apply_te_electric_current_vector(i, s, jx, jy, ex, ey, eps, epsY, epsilonXY, gyrotropyG);
    }
  }
}

static inline void apply_magnetic_ade_tm(
  i32 nx,
  i32 ny,
  float s,
  float* hx,
  float* hy,
  float* mu,
  float* muLoss,
  float* muY,
  float* muLossY,
  u8* material,
  u8* muDispersiveMaterial,
  u8* muDispersionAxes,
  float* muDispersionOmegaP,
  float* muDispersionGamma,
  float* muDispersionOmega0,
  float* muDispersionDeltaMu,
  float* muDispersionTau,
  float* magDispMx,
  float* magDispJx,
  float* magDispMy,
  float* magDispJy
) {
  for (i32 y = 0; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 0; x < nx; x += 1) {
      const i32 i = row + x;
      if (!muDispersiveMaterial[i] || material[i] == 2) continue;
      const u8 axes = muDispersionAxes[i] ? muDispersionAxes[i] : 3;
      if (!(axes & 1)) continue;
      const float jx = advance_ade_current(
        i,
        hx[i],
        muDispersiveMaterial,
        muDispersionOmegaP,
        muDispersionGamma,
        muDispersionOmega0,
        muDispersionDeltaMu,
        muDispersionTau,
        magDispMx,
        magDispJx
      );
      hx[i] -= (s / safe_material_denominator(mu[i])) * jx * magnetic_loss_decay(muLoss[i]);
    }
  }

  for (i32 y = 0; y < ny; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 0; x < nx - 1; x += 1) {
      const i32 i = row + x;
      if (!muDispersiveMaterial[i] || material[i] == 2) continue;
      const u8 axes = muDispersionAxes[i] ? muDispersionAxes[i] : 3;
      if (!(axes & 2)) continue;
      const float jy = advance_ade_current(
        i,
        hy[i],
        muDispersiveMaterial,
        muDispersionOmegaP,
        muDispersionGamma,
        muDispersionOmega0,
        muDispersionDeltaMu,
        muDispersionTau,
        magDispMy,
        magDispJy
      );
      hy[i] -= (s / safe_material_denominator(muY[i])) * jy * magnetic_loss_decay(muLossY[i]);
    }
  }
}

static inline void apply_magnetic_ade_te(
  i32 nx,
  i32 ny,
  float s,
  float* hz,
  float* hzx,
  float* hzy,
  float* mu,
  float* muLoss,
  float* muY,
  float* muLossY,
  u8* material,
  u8* muDispersiveMaterial,
  u8* muDispersionAxes,
  float* muDispersionOmegaP,
  float* muDispersionGamma,
  float* muDispersionOmega0,
  float* muDispersionDeltaMu,
  float* muDispersionTau,
  float* magDispMz,
  float* magDispJz
) {
  for (i32 y = 1; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 1; x < nx - 1; x += 1) {
      const i32 i = row + x;
      if (!muDispersiveMaterial[i] || material[i] == 2) continue;
      const u8 axes = muDispersionAxes[i] ? muDispersionAxes[i] : 1;
      if (!(axes & 1)) continue;
      const float jz = advance_ade_current(
        i,
        hz[i],
        muDispersiveMaterial,
        muDispersionOmegaP,
        muDispersionGamma,
        muDispersionOmega0,
        muDispersionDeltaMu,
        muDispersionTau,
        magDispMz,
        magDispJz
      );
      hzx[i] -= (s / safe_material_denominator(mu[i])) * jz * 0.5f * magnetic_loss_decay(muLoss[i]);
      hzy[i] -= (s / safe_material_denominator(muY[i])) * jz * 0.5f * magnetic_loss_decay(muLossY[i]);
      hz[i] = hzx[i] + hzy[i];
    }
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

static inline void rebalance_tm_split_storage(
  i32 n,
  float* ez,
  float* ezx,
  float* ezy,
  float* eps,
  float* loss,
  float* epsY,
  float* lossY,
  float* conductivity,
  float* conductivityY,
  u8* material
) {
  for (i32 i = 0; i < n; i += 1) {
    if (material[i] == 2) {
      zero_tm_cell(ez, ezx, ezy, i);
      continue;
    }
    if (
      !nearly_equal(eps[i], epsY[i]) ||
      !nearly_equal(loss[i], lossY[i]) ||
      !nearly_equal(conductivity[i], conductivityY[i])
    ) {
      continue;
    }
    const float value = ez[i];
    const float half = 0.5f * value;
    ezx[i] = half;
    ezy[i] = value - half;
  }
}

static inline void rebalance_te_split_storage(
  i32 n,
  float* hz,
  float* hzx,
  float* hzy,
  float* ex,
  float* ey,
  float* mu,
  float* muLoss,
  float* muY,
  float* muLossY,
  u8* material
) {
  for (i32 i = 0; i < n; i += 1) {
    if (material[i] == 2) {
      zero_te_cell(hz, hzx, hzy, ex, ey, i);
      continue;
    }
    if (!nearly_equal(mu[i], muY[i]) || !nearly_equal(muLoss[i], muLossY[i])) continue;
    const float value = hz[i];
    const float half = 0.5f * value;
    hzx[i] = half;
    hzy[i] = value - half;
  }
}

struct TfsfIncident {
  i32 type;
  i32 profile;
  i32 x0;
  i32 x1;
  i32 y0;
  i32 y1;
  float sx;
  float sy;
  float cosTheta;
  float sinTheta;
  float kCells;
  float z;
  float frequency;
  float amplitude;
  float phaseRad;
  float fwhm;
  float tmHxScale;
  float tmHyScale;
  float teExScale;
  float teEyScale;
};

static inline TfsfIncident make_tfsf_incident(const float* p) {
  TfsfIncident incident = {};
  incident.type = static_cast<i32>(p[0]);
  incident.profile = static_cast<i32>(p[1]);
  incident.sx = p[2];
  incident.sy = p[3];
  incident.cosTheta = p[4];
  incident.sinTheta = p[5];
  incident.kCells = p[6];
  incident.z = p[7];
  incident.x0 = static_cast<i32>(p[8]);
  incident.x1 = static_cast<i32>(p[9]);
  incident.y0 = static_cast<i32>(p[10]);
  incident.y1 = static_cast<i32>(p[11]);
  incident.frequency = p[12];
  incident.amplitude = p[13];
  incident.phaseRad = p[14];
  incident.fwhm = maxf(1.0e-6f, p[15]);

  const float sinKx = fdtd_sinf(0.5f * incident.kCells * incident.cosTheta);
  const float sinKy = fdtd_sinf(0.5f * incident.kCells * incident.sinTheta);
  const float spatialNorm = sqrtf_local(sinKx * sinKx + sinKy * sinKy);
  const float zSafe = maxf(1.0e-9f, incident.z);
  if (spatialNorm <= 1.0e-12f) {
    incident.tmHxScale = incident.sinTheta / zSafe;
    incident.tmHyScale = -incident.cosTheta / zSafe;
    incident.teExScale = -incident.sinTheta * incident.z;
    incident.teEyScale = incident.cosTheta * incident.z;
  } else {
    incident.tmHxScale = sinKy / (zSafe * spatialNorm);
    incident.tmHyScale = -sinKx / (zSafe * spatialNorm);
    incident.teExScale = -incident.z * sinKy / spatialNorm;
    incident.teEyScale = incident.z * sinKx / spatialNorm;
  }
  return incident;
}

static inline float tfsf_source_sample_at_time(const TfsfIncident& incident, float t) {
  if (incident.type == 1) {
    const float center = 48.0f;
    const float width = 14.0f;
    const float dt = t - center;
    return incident.amplitude * fdtd_expf(-(dt * dt) / (2.0f * width * width));
  }
  if (incident.type == 2) {
    const float center = 48.0f;
    const float a = PI_F * incident.frequency * (t - center);
    const float a2 = a * a;
    return incident.amplitude * (1.0f - 2.0f * a2) * fdtd_expf(-a2);
  }
  if (incident.frequency <= 0.0f || t <= 0.0f) return 0.0f;
  const float rampDuration = maxf(24.0f, 1.5f / incident.frequency);
  const float rampAngle = 0.5f * PI_F * minf(t, rampDuration) / rampDuration;
  const float rampSine = fdtd_sinf(rampAngle);
  return incident.amplitude * rampSine * rampSine * fdtd_sinf(TWO_PI_F * incident.frequency * t);
}

static inline float tfsf_incident_envelope(const TfsfIncident& incident, float x, float y) {
  if (incident.profile != 1) return 1.0f;
  const float transverse = -(x - incident.sx) * incident.sinTheta + (y - incident.sy) * incident.cosTheta;
  const float normalized = transverse / incident.fwhm;
  return fdtd_expf(-FOUR_LN2_F * normalized * normalized);
}

static inline float tfsf_incident_scalar(const TfsfIncident& incident, float x, float y, float t, float fieldScale) {
  if (fieldScale == 0.0f) return 0.0f;
  const float phase = -incident.kCells * ((x - incident.sx) * incident.cosTheta + (y - incident.sy) * incident.sinTheta);
  const float phaseTimeOffset = incident.frequency > 0.0f ? (phase + incident.phaseRad) / (TWO_PI_F * incident.frequency) : 0.0f;
  const float value = tfsf_source_sample_at_time(incident, t + phaseTimeOffset) * tfsf_incident_envelope(incident, x, y);
  return value / fieldScale;
}

static inline float cpml_derivative(float rawDerivative, float* memory, i32 i, i32 axis, float* kappa, float* a, float* b) {
  const float kappaValue = absf(kappa[axis]) > 1.0e-12f ? kappa[axis] : 1.0f;
  const float aValue = a[axis];
  if (aValue != 0.0f) {
    memory[i] = b[axis] * memory[i] + aValue * rawDerivative;
    return rawDerivative / kappaValue + memory[i];
  }
  return rawDerivative / kappaValue;
}

static inline float magnetic_update_coeff_x(i32 i, float s, float* mu, float* muLoss) {
  return (s / safe_material_denominator(mu[i])) * magnetic_loss_decay(muLoss[i]);
}

static inline float magnetic_update_coeff_y(i32 i, float s, float* muY, float* muLossY) {
  return (s / safe_material_denominator(muY[i])) * magnetic_loss_decay(muLossY[i]);
}

static inline float electric_update_coeff_x(
  i32 i,
  float s,
  float intensity,
  i32 runtimeFlags,
  float gainSaturation,
  float* eps,
  float* loss,
  float* conductivity
) {
  const float epsValue = safe_material_denominator(eps[i]);
  const float sigmaDamp = conductivity_damp(conductivity[i], epsValue, s);
  const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
  return sigmaCb * (s / epsValue) * electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
}

static inline float electric_update_coeff_y(
  i32 i,
  float s,
  float intensity,
  i32 runtimeFlags,
  float gainSaturation,
  float* epsY,
  float* lossY,
  float* conductivityY
) {
  const float epsValue = safe_material_denominator(epsY[i]);
  const float sigmaDamp = conductivity_damp(conductivityY[i], epsValue, s);
  const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
  return sigmaCb * (s / epsValue) * electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
}

static inline float transverse_electric_update_coeff_x(
  i32 i,
  float s,
  float intensity,
  i32 runtimeFlags,
  float gainSaturation,
  float* eps,
  float* loss,
  float* conductivity
) {
  const float epsValue = safe_material_denominator(eps[i]);
  const float sigmaDamp = conductivity_damp(conductivity[i], epsValue, s);
  const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
  return sigmaCb * (s / epsValue) * electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
}

static inline float transverse_electric_update_coeff_y(
  i32 i,
  float s,
  float intensity,
  i32 runtimeFlags,
  float gainSaturation,
  float* epsY,
  float* lossY,
  float* conductivityY
) {
  const float epsValue = safe_material_denominator(epsY[i]);
  const float sigmaDamp = conductivity_damp(conductivityY[i], epsValue, s);
  const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
  return sigmaCb * (s / epsValue) * electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
}

struct ModeProfileIncident {
  i32 type;
  i32 x0;
  i32 y0;
  i32 length;
  i32 profileOffset;
  float betaCells;
  float neff;
  float confinementIndexMax;
  float frequency;
  float amplitude;
  float phaseRad;
};

static inline ModeProfileIncident make_mode_profile_incident(const float* p) {
  ModeProfileIncident incident = {};
  incident.type = static_cast<i32>(p[0]);
  incident.x0 = static_cast<i32>(p[1]);
  incident.y0 = static_cast<i32>(p[2]);
  incident.length = static_cast<i32>(p[3]);
  incident.betaCells = p[4];
  incident.neff = p[5];
  incident.confinementIndexMax = p[6];
  incident.frequency = p[7];
  incident.amplitude = p[8];
  incident.phaseRad = p[9];
  incident.profileOffset = static_cast<i32>(p[10]);
  return incident;
}

static inline float mode_source_sample_at_time(const ModeProfileIncident& incident, float t) {
  if (incident.type == 1) {
    const float center = 48.0f;
    const float width = 14.0f;
    const float dt = t - center;
    return incident.amplitude * fdtd_expf(-(dt * dt) / (2.0f * width * width));
  }
  if (incident.type == 2) {
    const float center = 48.0f;
    const float a = PI_F * incident.frequency * (t - center);
    const float a2 = a * a;
    return incident.amplitude * (1.0f - 2.0f * a2) * fdtd_expf(-a2);
  }
  return incident.amplitude * fdtd_sinf(TWO_PI_F * incident.frequency * t);
}

static inline float mode_profile_neff(const ModeProfileIncident& incident) {
  const float maxIndex = incident.confinementIndexMax > 1.0e-6f ? incident.confinementIndexMax : 10.0f;
  return maxf(1.0e-6f, minf(maxIndex, incident.neff));
}

static inline float mode_profile_scalar(
  const ModeProfileIncident& incident,
  const float* profile,
  float x,
  i32 offset,
  float t,
  float fieldScale
) {
  if (fieldScale == 0.0f) return 0.0f;
  const float phase = -incident.betaCells * (x - static_cast<float>(incident.x0));
  const float phaseTimeOffset = incident.frequency > 0.0f ? (phase + incident.phaseRad) / (TWO_PI_F * incident.frequency) : 0.0f;
  const float value = mode_source_sample_at_time(incident, t + phaseTimeOffset) * profile[incident.profileOffset + offset];
  return value / fieldScale;
}

static inline float mode_profile_tm_hy(
  const ModeProfileIncident& incident,
  const float* profile,
  const float* muProfile,
  float x,
  i32 offset,
  float t,
  float fieldScale
) {
  const float scalar = mode_profile_scalar(incident, profile, x, offset, t, fieldScale);
  const float muValue = maxf(1.0e-6f, muProfile[incident.profileOffset + offset]);
  return (-mode_profile_neff(incident) / muValue) * scalar;
}

static inline float mode_profile_te_ey(
  const ModeProfileIncident& incident,
  const float* profile,
  const float* epsilonProfile,
  float x,
  i32 offset,
  float t,
  float fieldScale
) {
  const float scalar = mode_profile_scalar(incident, profile, x, offset, t, fieldScale);
  const float epsilonValue = maxf(1.0e-6f, epsilonProfile[incident.profileOffset + offset]);
  return (mode_profile_neff(incident) / epsilonValue) * scalar;
}

static inline void apply_mode_tm_magnetic(
  i32 nx,
  i32 ny,
  float s,
  float time,
  float fieldScale,
  float* modeSources,
  float* modeProfiles,
  i32 modeSourceCount,
  float* hy,
  float* muY,
  float* muLossY,
  u8* material
) {
  for (i32 n = 0; n < modeSourceCount; n += 1) {
    const ModeProfileIncident incident = make_mode_profile_incident(modeSources + n * MODE_SOURCE_STRIDE);
    if (incident.x0 < 1 || incident.x0 >= nx - 1 || incident.y0 < 0 || incident.length <= 0) continue;
    for (i32 offset = 0; offset < incident.length; offset += 1) {
      if (absf(modeProfiles[incident.profileOffset + offset]) < 1.0e-5f) continue;
      const i32 y = incident.y0 + offset;
      if (y < 0 || y >= ny) continue;
      const i32 leftIdx = cell_id(incident.x0 - 1, y, nx);
      if (material[leftIdx] == 2) continue;
      const float ezIncident = mode_profile_scalar(incident, modeProfiles, static_cast<float>(incident.x0), offset, time, fieldScale);
      hy[leftIdx] -= magnetic_update_coeff_x(leftIdx, s, muY, muLossY) * ezIncident;
    }
  }
}

static inline void apply_mode_tm_electric(
  i32 nx,
  i32 ny,
  float s,
  float time,
  float fieldScale,
  float* modeSources,
  float* modeProfiles,
  float* modeMuProfiles,
  i32 modeSourceCount,
  float* ez,
  float* ezx,
  float* ezy,
  float* eps,
  float* loss,
  float* conductivity,
  u8* material,
  i32 runtimeFlags,
  float gainSaturation
) {
  const float t = time + 0.5f;
  for (i32 n = 0; n < modeSourceCount; n += 1) {
    const ModeProfileIncident incident = make_mode_profile_incident(modeSources + n * MODE_SOURCE_STRIDE);
    if (incident.x0 < 1 || incident.x0 >= nx - 1 || incident.y0 < 0 || incident.length <= 0) continue;
    for (i32 offset = 0; offset < incident.length; offset += 1) {
      if (absf(modeProfiles[incident.profileOffset + offset]) < 1.0e-5f) continue;
      const i32 y = incident.y0 + offset;
      if (y < 0 || y >= ny) continue;
      const i32 leftIdx = cell_id(incident.x0, y, nx);
      if (material[leftIdx] == 2) continue;
      const float hyIncident = mode_profile_tm_hy(
        incident,
        modeProfiles,
        modeMuProfiles,
        static_cast<float>(incident.x0) - 0.5f,
        offset,
        t,
        fieldScale
      );
      const float intensity = physical_intensity(ez[leftIdx] * ez[leftIdx], fieldScale);
      ezx[leftIdx] -= electric_update_coeff_x(leftIdx, s, intensity, runtimeFlags, gainSaturation, eps, loss, conductivity) * hyIncident;
      ez[leftIdx] = ezx[leftIdx] + ezy[leftIdx];
    }
  }
}

static inline void apply_mode_te_electric(
  i32 nx,
  i32 ny,
  float s,
  float time,
  float fieldScale,
  float* modeSources,
  float* modeProfiles,
  i32 modeSourceCount,
  float* ex,
  float* ey,
  float* epsY,
  float* lossY,
  float* conductivityY,
  u8* material,
  i32 runtimeFlags,
  float gainSaturation
) {
  for (i32 n = 0; n < modeSourceCount; n += 1) {
    const ModeProfileIncident incident = make_mode_profile_incident(modeSources + n * MODE_SOURCE_STRIDE);
    if (incident.x0 < 1 || incident.x0 >= nx - 1 || incident.y0 < 0 || incident.length <= 0) continue;
    for (i32 offset = 0; offset < incident.length; offset += 1) {
      if (absf(modeProfiles[incident.profileOffset + offset]) < 1.0e-5f) continue;
      const i32 y = incident.y0 + offset;
      if (y < 0 || y >= ny) continue;
      const i32 leftIdx = cell_id(incident.x0 - 1, y, nx);
      if (material[leftIdx] == 2) continue;
      const float hzIncident = mode_profile_scalar(incident, modeProfiles, static_cast<float>(incident.x0), offset, time, fieldScale);
      const float intensity = physical_intensity(ex[leftIdx] * ex[leftIdx] + ey[leftIdx] * ey[leftIdx], fieldScale);
      ey[leftIdx] += transverse_electric_update_coeff_y(leftIdx, s, intensity, runtimeFlags, gainSaturation, epsY, lossY, conductivityY) * hzIncident;
    }
  }
}

static inline void apply_mode_te_magnetic(
  i32 nx,
  i32 ny,
  float s,
  float time,
  float fieldScale,
  float* modeSources,
  float* modeProfiles,
  float* modeEpsilonProfiles,
  i32 modeSourceCount,
  float* hz,
  float* hzx,
  float* hzy,
  float* mu,
  float* muLoss,
  u8* material
) {
  const float t = time + 0.5f;
  for (i32 n = 0; n < modeSourceCount; n += 1) {
    const ModeProfileIncident incident = make_mode_profile_incident(modeSources + n * MODE_SOURCE_STRIDE);
    if (incident.x0 < 1 || incident.x0 >= nx - 1 || incident.y0 < 0 || incident.length <= 0) continue;
    for (i32 offset = 0; offset < incident.length; offset += 1) {
      if (absf(modeProfiles[incident.profileOffset + offset]) < 1.0e-5f) continue;
      const i32 y = incident.y0 + offset;
      if (y < 0 || y >= ny) continue;
      const i32 leftIdx = cell_id(incident.x0, y, nx);
      if (material[leftIdx] == 2) continue;
      const float eyIncident = mode_profile_te_ey(
        incident,
        modeProfiles,
        modeEpsilonProfiles,
        static_cast<float>(incident.x0) - 0.5f,
        offset,
        t,
        fieldScale
      );
      hzx[leftIdx] += magnetic_update_coeff_x(leftIdx, s, mu, muLoss) * eyIncident;
      hz[leftIdx] = hzx[leftIdx] + hzy[leftIdx];
    }
  }
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
  u8* material
) {
  for (i32 n = 0; n < tfsfSourceCount; n += 1) {
    const TfsfIncident incident = make_tfsf_incident(tfsfSources + n * TFSF_STRIDE);
    const i32 x0 = incident.x0;
    const i32 x1 = incident.x1;
    const i32 y0 = incident.y0;
    const i32 y1 = incident.y1;
    if (x0 < 1 || x1 >= nx - 1 || y0 < 1 || y1 >= ny - 1 || x1 <= x0 || y1 <= y0) continue;
    for (i32 y = y0; y <= y1; y += 1) {
      const i32 leftIdx = cell_id(x0 - 1, y, nx);
      if (material[leftIdx] != 2) {
        const float eLeft = tfsf_incident_scalar(incident, static_cast<float>(x0), static_cast<float>(y), time, fieldScale);
        hy[leftIdx] -= magnetic_update_coeff_x(leftIdx, s, muY, muLossY) * eLeft;
      }
      const i32 rightIdx = cell_id(x1, y, nx);
      if (material[rightIdx] != 2) {
        const float eRight = tfsf_incident_scalar(incident, static_cast<float>(x1), static_cast<float>(y), time, fieldScale);
        hy[rightIdx] += magnetic_update_coeff_x(rightIdx, s, muY, muLossY) * eRight;
      }
    }
    for (i32 x = x0; x <= x1; x += 1) {
      const i32 topIdx = cell_id(x, y0 - 1, nx);
      if (material[topIdx] != 2) {
        const float eTop = tfsf_incident_scalar(incident, static_cast<float>(x), static_cast<float>(y0), time, fieldScale);
        hx[topIdx] += magnetic_update_coeff_y(topIdx, s, mu, muLoss) * eTop;
      }
      const i32 bottomIdx = cell_id(x, y1, nx);
      if (material[bottomIdx] != 2) {
        const float eBottom = tfsf_incident_scalar(incident, static_cast<float>(x), static_cast<float>(y1), time, fieldScale);
        hx[bottomIdx] -= magnetic_update_coeff_y(bottomIdx, s, mu, muLoss) * eBottom;
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
  i32 runtimeFlags,
  float gainSaturation
) {
  const float t = time + 0.5f;
  for (i32 n = 0; n < tfsfSourceCount; n += 1) {
    const TfsfIncident incident = make_tfsf_incident(tfsfSources + n * TFSF_STRIDE);
    const i32 x0 = incident.x0;
    const i32 x1 = incident.x1;
    const i32 y0 = incident.y0;
    const i32 y1 = incident.y1;
    if (x0 < 1 || x1 >= nx - 1 || y0 < 1 || y1 >= ny - 1 || x1 <= x0 || y1 <= y0) continue;
    for (i32 y = y0; y <= y1; y += 1) {
      const i32 leftIdx = cell_id(x0, y, nx);
      if (material[leftIdx] != 2) {
        const float scalar = tfsf_incident_scalar(incident, static_cast<float>(x0) - 0.5f, static_cast<float>(y), t, fieldScale);
        const float hLeft = incident.tmHyScale * scalar;
        const float intensity = physical_intensity(ez[leftIdx] * ez[leftIdx], fieldScale);
        ezx[leftIdx] -= electric_update_coeff_x(leftIdx, s, intensity, runtimeFlags, gainSaturation, eps, loss, conductivity) * hLeft;
        ez[leftIdx] = ezx[leftIdx] + ezy[leftIdx];
      }
      const i32 rightIdx = cell_id(x1, y, nx);
      if (material[rightIdx] != 2) {
        const float scalar = tfsf_incident_scalar(incident, static_cast<float>(x1) + 0.5f, static_cast<float>(y), t, fieldScale);
        const float hRight = incident.tmHyScale * scalar;
        const float intensity = physical_intensity(ez[rightIdx] * ez[rightIdx], fieldScale);
        ezx[rightIdx] += electric_update_coeff_x(rightIdx, s, intensity, runtimeFlags, gainSaturation, eps, loss, conductivity) * hRight;
        ez[rightIdx] = ezx[rightIdx] + ezy[rightIdx];
      }
    }
    for (i32 x = x0; x <= x1; x += 1) {
      const i32 topIdx = cell_id(x, y0, nx);
      if (material[topIdx] != 2) {
        const float scalar = tfsf_incident_scalar(incident, static_cast<float>(x), static_cast<float>(y0) - 0.5f, t, fieldScale);
        const float hTop = incident.tmHxScale * scalar;
        const float intensity = physical_intensity(ez[topIdx] * ez[topIdx], fieldScale);
        ezy[topIdx] += electric_update_coeff_y(topIdx, s, intensity, runtimeFlags, gainSaturation, epsY, lossY, conductivityY) * hTop;
        ez[topIdx] = ezx[topIdx] + ezy[topIdx];
      }
      const i32 bottomIdx = cell_id(x, y1, nx);
      if (material[bottomIdx] != 2) {
        const float scalar = tfsf_incident_scalar(incident, static_cast<float>(x), static_cast<float>(y1) + 0.5f, t, fieldScale);
        const float hBottom = incident.tmHxScale * scalar;
        const float intensity = physical_intensity(ez[bottomIdx] * ez[bottomIdx], fieldScale);
        ezy[bottomIdx] -= electric_update_coeff_y(bottomIdx, s, intensity, runtimeFlags, gainSaturation, epsY, lossY, conductivityY) * hBottom;
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
  i32 runtimeFlags,
  float gainSaturation
) {
  for (i32 n = 0; n < tfsfSourceCount; n += 1) {
    const TfsfIncident incident = make_tfsf_incident(tfsfSources + n * TFSF_STRIDE);
    const i32 x0 = incident.x0;
    const i32 x1 = incident.x1;
    const i32 y0 = incident.y0;
    const i32 y1 = incident.y1;
    if (x0 < 1 || x1 >= nx - 1 || y0 < 1 || y1 >= ny - 1 || x1 <= x0 || y1 <= y0) continue;
    for (i32 y = y0; y <= y1; y += 1) {
      const i32 leftIdx = cell_id(x0 - 1, y, nx);
      if (material[leftIdx] != 2) {
        const float hLeft = tfsf_incident_scalar(incident, static_cast<float>(x0), static_cast<float>(y), time, fieldScale);
        const float intensity = physical_intensity(ex[leftIdx] * ex[leftIdx] + ey[leftIdx] * ey[leftIdx], fieldScale);
        ey[leftIdx] += transverse_electric_update_coeff_y(leftIdx, s, intensity, runtimeFlags, gainSaturation, epsY, lossY, conductivityY) * hLeft;
      }
      const i32 rightIdx = cell_id(x1, y, nx);
      if (material[rightIdx] != 2) {
        const float hRight = tfsf_incident_scalar(incident, static_cast<float>(x1), static_cast<float>(y), time, fieldScale);
        const float intensity = physical_intensity(ex[rightIdx] * ex[rightIdx] + ey[rightIdx] * ey[rightIdx], fieldScale);
        ey[rightIdx] -= transverse_electric_update_coeff_y(rightIdx, s, intensity, runtimeFlags, gainSaturation, epsY, lossY, conductivityY) * hRight;
      }
    }
    for (i32 x = x0; x <= x1; x += 1) {
      const i32 topIdx = cell_id(x, y0 - 1, nx);
      if (material[topIdx] != 2) {
        const float hTop = tfsf_incident_scalar(incident, static_cast<float>(x), static_cast<float>(y0), time, fieldScale);
        const float intensity = physical_intensity(ex[topIdx] * ex[topIdx] + ey[topIdx] * ey[topIdx], fieldScale);
        ex[topIdx] -= transverse_electric_update_coeff_x(topIdx, s, intensity, runtimeFlags, gainSaturation, eps, loss, conductivity) * hTop;
      }
      const i32 bottomIdx = cell_id(x, y1, nx);
      if (material[bottomIdx] != 2) {
        const float hBottom = tfsf_incident_scalar(incident, static_cast<float>(x), static_cast<float>(y1), time, fieldScale);
        const float intensity = physical_intensity(ex[bottomIdx] * ex[bottomIdx] + ey[bottomIdx] * ey[bottomIdx], fieldScale);
        ex[bottomIdx] += transverse_electric_update_coeff_x(bottomIdx, s, intensity, runtimeFlags, gainSaturation, eps, loss, conductivity) * hBottom;
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
  u8* material
) {
  const float t = time + 0.5f;
  for (i32 n = 0; n < tfsfSourceCount; n += 1) {
    const TfsfIncident incident = make_tfsf_incident(tfsfSources + n * TFSF_STRIDE);
    const i32 x0 = incident.x0;
    const i32 x1 = incident.x1;
    const i32 y0 = incident.y0;
    const i32 y1 = incident.y1;
    if (x0 < 1 || x1 >= nx - 1 || y0 < 1 || y1 >= ny - 1 || x1 <= x0 || y1 <= y0) continue;
    for (i32 y = y0; y <= y1; y += 1) {
      const i32 leftIdx = cell_id(x0, y, nx);
      if (material[leftIdx] != 2) {
        const float scalar = tfsf_incident_scalar(incident, static_cast<float>(x0) - 0.5f, static_cast<float>(y), t, fieldScale);
        const float eLeft = incident.teEyScale * scalar;
        hzx[leftIdx] += magnetic_update_coeff_x(leftIdx, s, mu, muLoss) * eLeft;
        hz[leftIdx] = hzx[leftIdx] + hzy[leftIdx];
      }
      const i32 rightIdx = cell_id(x1, y, nx);
      if (material[rightIdx] != 2) {
        const float scalar = tfsf_incident_scalar(incident, static_cast<float>(x1) + 0.5f, static_cast<float>(y), t, fieldScale);
        const float eRight = incident.teEyScale * scalar;
        hzx[rightIdx] -= magnetic_update_coeff_x(rightIdx, s, mu, muLoss) * eRight;
        hz[rightIdx] = hzx[rightIdx] + hzy[rightIdx];
      }
    }
    for (i32 x = x0; x <= x1; x += 1) {
      const i32 topIdx = cell_id(x, y0, nx);
      if (material[topIdx] != 2) {
        const float scalar = tfsf_incident_scalar(incident, static_cast<float>(x), static_cast<float>(y0) - 0.5f, t, fieldScale);
        const float eTop = incident.teExScale * scalar;
        hzy[topIdx] -= magnetic_update_coeff_y(topIdx, s, muY, muLossY) * eTop;
        hz[topIdx] = hzx[topIdx] + hzy[topIdx];
      }
      const i32 bottomIdx = cell_id(x, y1, nx);
      if (material[bottomIdx] != 2) {
        const float scalar = tfsf_incident_scalar(incident, static_cast<float>(x), static_cast<float>(y1) + 0.5f, t, fieldScale);
        const float eBottom = incident.teExScale * scalar;
        hzy[bottomIdx] += magnetic_update_coeff_y(bottomIdx, s, muY, muLossY) * eBottom;
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
  u32 modulatedMaterialOffset,
  u32 modulationPhaseOffsetOffset,
  u32 nonlinearMaterialOffset,
  u32 electricTensorMaterialOffset,
  u32 gyrotropicMaterialOffset,
  u32 dispersiveMaterialOffset,
  u32 dispersionAxesOffset,
  u32 dispersionAxisXOffset,
  u32 dispersionAxisYOffset,
  u32 modulationBaseEpsOffset,
  u32 modulationBaseEpsYOffset,
  u32 epsilonXYOffset,
  u32 gyrotropyGOffset,
  u32 dispersionOmegaPOffset,
  u32 dispersionGammaOffset,
  u32 dispersionOmega0Offset,
  u32 dispersionDeltaEpsOffset,
  u32 dispersionTauOffset,
  u32 muDispersiveMaterialOffset,
  u32 muDispersionAxesOffset,
  u32 muDispersionOmegaPOffset,
  u32 muDispersionGammaOffset,
  u32 muDispersionOmega0Offset,
  u32 muDispersionDeltaMuOffset,
  u32 muDispersionTauOffset,
  u32 dispPzOffset,
  u32 dispJzOffset,
  u32 dispPxOffset,
  u32 dispJxOffset,
  u32 dispPyOffset,
  u32 dispJyOffset,
  u32 magDispMzOffset,
  u32 magDispJzOffset,
  u32 magDispMxOffset,
  u32 magDispJxOffset,
  u32 magDispMyOffset,
  u32 magDispJyOffset,
  u32 cpmlKappaEXOffset,
  u32 cpmlKappaHXOffset,
  u32 cpmlKappaEYOffset,
  u32 cpmlKappaHYOffset,
  u32 cpmlAEXOffset,
  u32 cpmlAHXOffset,
  u32 cpmlAEYOffset,
  u32 cpmlAHYOffset,
  u32 cpmlBEXOffset,
  u32 cpmlBHXOffset,
  u32 cpmlBEYOffset,
  u32 cpmlBHYOffset,
  u32 cpmlPsiHxYOffset,
  u32 cpmlPsiHyXOffset,
  u32 cpmlPsiEzXOffset,
  u32 cpmlPsiEzYOffset,
  u32 cpmlPsiExYOffset,
  u32 cpmlPsiEyXOffset,
  u32 cpmlPsiHzXOffset,
  u32 cpmlPsiHzYOffset,
  i32 runtimeFlags,
  float kerrChi3,
  float kerrSaturation,
  float gainSaturation,
  float modulationDepth,
  float modulationPeriodCells,
  float modulationCosTheta,
  float modulationSinTheta,
  float modulationOmegaCycles,
  float modulationPhase,
  float time,
  float fieldScale,
  u32 tfsfSourcesOffset,
  i32 tfsfSourceCount,
  u32 modeSourcesOffset,
  u32 modeProfilesOffset,
  u32 modeEpsilonProfilesOffset,
  u32 modeMuProfilesOffset,
  i32 modeSourceCount
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
  u8* modulatedMaterial = u8_array(modulatedMaterialOffset);
  float* modulationPhaseOffset = f32(modulationPhaseOffsetOffset);
  u8* nonlinearMaterial = u8_array(nonlinearMaterialOffset);
  u8* dispersiveMaterial = u8_array(dispersiveMaterialOffset);
  u8* dispersionAxes = u8_array(dispersionAxesOffset);
  float* modulationBaseEps = f32(modulationBaseEpsOffset);
  float* modulationBaseEpsY = f32(modulationBaseEpsYOffset);
  float* dispersionOmegaP = f32(dispersionOmegaPOffset);
  float* dispersionGamma = f32(dispersionGammaOffset);
  float* dispersionOmega0 = f32(dispersionOmega0Offset);
  float* dispersionDeltaEps = f32(dispersionDeltaEpsOffset);
  float* dispersionTau = f32(dispersionTauOffset);
  float* dispersionAxisX = f32(dispersionAxisXOffset);
  float* dispersionAxisY = f32(dispersionAxisYOffset);
  u8* muDispersiveMaterial = u8_array(muDispersiveMaterialOffset);
  u8* muDispersionAxes = u8_array(muDispersionAxesOffset);
  float* muDispersionOmegaP = f32(muDispersionOmegaPOffset);
  float* muDispersionGamma = f32(muDispersionGammaOffset);
  float* muDispersionOmega0 = f32(muDispersionOmega0Offset);
  float* muDispersionDeltaMu = f32(muDispersionDeltaMuOffset);
  float* muDispersionTau = f32(muDispersionTauOffset);
  float* dispPz = f32(dispPzOffset);
  float* dispJz = f32(dispJzOffset);
  float* dispPx = f32(dispPxOffset);
  float* dispJx = f32(dispJxOffset);
  float* dispPy = f32(dispPyOffset);
  float* dispJy = f32(dispJyOffset);
  float* magDispMz = f32(magDispMzOffset);
  float* magDispJz = f32(magDispJzOffset);
  float* magDispMx = f32(magDispMxOffset);
  float* magDispJx = f32(magDispJxOffset);
  float* magDispMy = f32(magDispMyOffset);
  float* magDispJy = f32(magDispJyOffset);
  float* cpmlKappaEX = f32(cpmlKappaEXOffset);
  float* cpmlKappaHX = f32(cpmlKappaHXOffset);
  float* cpmlKappaEY = f32(cpmlKappaEYOffset);
  float* cpmlKappaHY = f32(cpmlKappaHYOffset);
  float* cpmlAEX = f32(cpmlAEXOffset);
  float* cpmlAHX = f32(cpmlAHXOffset);
  float* cpmlAEY = f32(cpmlAEYOffset);
  float* cpmlAHY = f32(cpmlAHYOffset);
  float* cpmlBEX = f32(cpmlBEXOffset);
  float* cpmlBHX = f32(cpmlBHXOffset);
  float* cpmlBEY = f32(cpmlBEYOffset);
  float* cpmlBHY = f32(cpmlBHYOffset);
  float* cpmlPsiHxY = f32(cpmlPsiHxYOffset);
  float* cpmlPsiHyX = f32(cpmlPsiHyXOffset);
  float* cpmlPsiEzX = f32(cpmlPsiEzXOffset);
  float* cpmlPsiEzY = f32(cpmlPsiEzYOffset);
  float* tfsfSources = f32(tfsfSourcesOffset);
  float* modeSources = f32(modeSourcesOffset);
  float* modeProfiles = f32(modeProfilesOffset);
  float* modeMuProfiles = f32(modeMuProfilesOffset);
  const i32 n = nx * ny;

  if (runtimeFlags & (STEP_KERR | STEP_MODULATION)) {
    apply_dynamic_permittivity_response(
      nx,
      ny,
      0,
      runtimeFlags,
      kerrChi3,
      kerrSaturation,
      modulationDepth,
      modulationPeriodCells,
      modulationCosTheta,
      modulationSinTheta,
      modulationOmegaCycles,
      modulationPhase,
      time,
      ez,
      hx,
      hy,
      eps,
      epsY,
      material,
      modulatedMaterial,
      modulationPhaseOffset,
      nonlinearMaterial,
      modulationBaseEps,
      modulationBaseEpsY,
      fieldScale
    );
  }

  for (i32 y = 0; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 0; x < nx; x += 1) {
      const i32 i = row + x;
      const float dEzDy = cpml_derivative(ez[i + nx] - ez[i], cpmlPsiHxY, i, y, cpmlKappaHY, cpmlAHY, cpmlBHY);
      const float decay = magnetic_loss_decay(muLoss[i]);
      const float materialScale = s / safe_material_denominator(mu[i]);
      hx[i] = (hx[i] - materialScale * dEzDy) * decay;
    }
  }

  for (i32 y = 0; y < ny; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 0; x < nx - 1; x += 1) {
      const i32 i = row + x;
      const float dEzDx = cpml_derivative(ez[i + 1] - ez[i], cpmlPsiHyX, i, x, cpmlKappaHX, cpmlAHX, cpmlBHX);
      const float decay = magnetic_loss_decay(muLossY[i]);
      const float materialScale = s / safe_material_denominator(muY[i]);
      hy[i] = (hy[i] + materialScale * dEzDx) * decay;
    }
  }

  if (runtimeFlags & STEP_MAGNETIC_ADE) {
    apply_magnetic_ade_tm(
      nx,
      ny,
      s,
      hx,
      hy,
      mu,
      muLoss,
      muY,
      muLossY,
      material,
      muDispersiveMaterial,
      muDispersionAxes,
      muDispersionOmegaP,
      muDispersionGamma,
      muDispersionOmega0,
      muDispersionDeltaMu,
      muDispersionTau,
      magDispMx,
      magDispJx,
      magDispMy,
      magDispJy
    );
  }

  if (tfsfSourceCount > 0) {
    apply_tfsf_tm_magnetic(nx, ny, s, time, fieldScale, tfsfSources, tfsfSourceCount, hx, hy, mu, muLoss, muY, muLossY, material);
  }
  if (modeSourceCount > 0) {
    apply_mode_tm_magnetic(nx, ny, s, time, fieldScale, modeSources, modeProfiles, modeSourceCount, hy, muY, muLossY, material);
  }

  for (i32 y = 1; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 1; x < nx - 1; x += 1) {
      const i32 i = row + x;
      if (material[i] == 2) {
        zero_tm_cell(ez, ezx, ezy, i);
        continue;
      }
      const float dHyDx = cpml_derivative(hy[i] - hy[i - 1], cpmlPsiEzX, i, x, cpmlKappaEX, cpmlAEX, cpmlBEX);
      const float dHxDy = cpml_derivative(hx[i] - hx[i - nx], cpmlPsiEzY, i, y, cpmlKappaEY, cpmlAEY, cpmlBEY);
      const float sigmaDampX = conductivity_damp(conductivity[i], eps[i], s);
      const float sigmaDampY = conductivity_damp(conductivityY[i], epsY[i], s);
      const float sigmaCaX = (1.0f - sigmaDampX) / (1.0f + sigmaDampX);
      const float sigmaCaY = (1.0f - sigmaDampY) / (1.0f + sigmaDampY);
      const float sigmaCbX = 1.0f / (1.0f + sigmaDampX);
      const float sigmaCbY = 1.0f / (1.0f + sigmaDampY);
      const float intensity = physical_intensity(ez[i] * ez[i], fieldScale);
      const float decayX = electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
      const float decayY = electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
      const float ezxNew =
        (sigmaCaX * ezx[i] + sigmaCbX * (s / safe_material_denominator(eps[i])) * dHyDx) * decayX;
      const float ezyNew =
        (sigmaCaY * ezy[i] - sigmaCbY * (s / safe_material_denominator(epsY[i])) * dHxDy) * decayY;
      ezx[i] = ezxNew;
      ezy[i] = ezyNew;
      ez[i] = ezxNew + ezyNew;
    }
  }

  if (runtimeFlags & STEP_ELECTRIC_ADE) {
    apply_electric_ade_tm(
      nx,
      ny,
      s,
      ez,
      ezx,
      ezy,
      eps,
      epsY,
      material,
      dispersiveMaterial,
      dispersionAxes,
      dispersionOmegaP,
      dispersionGamma,
      dispersionOmega0,
      dispersionDeltaEps,
      dispersionTau,
      dispPz,
      dispJz
    );
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
      runtimeFlags,
      gainSaturation
    );
  }
  if (modeSourceCount > 0) {
    apply_mode_tm_electric(
      nx,
      ny,
      s,
      time,
      fieldScale,
      modeSources,
      modeProfiles,
      modeMuProfiles,
      modeSourceCount,
      ez,
      ezx,
      ezy,
      eps,
      loss,
      conductivity,
      material,
      runtimeFlags,
      gainSaturation
    );
  }

  rebalance_tm_split_storage(n, ez, ezx, ezy, eps, loss, epsY, lossY, conductivity, conductivityY, material);
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
  u32 modulatedMaterialOffset,
  u32 modulationPhaseOffsetOffset,
  u32 nonlinearMaterialOffset,
  u32 electricTensorMaterialOffset,
  u32 gyrotropicMaterialOffset,
  u32 dispersiveMaterialOffset,
  u32 dispersionAxesOffset,
  u32 dispersionAxisXOffset,
  u32 dispersionAxisYOffset,
  u32 modulationBaseEpsOffset,
  u32 modulationBaseEpsYOffset,
  u32 epsilonXYOffset,
  u32 gyrotropyGOffset,
  u32 dispersionOmegaPOffset,
  u32 dispersionGammaOffset,
  u32 dispersionOmega0Offset,
  u32 dispersionDeltaEpsOffset,
  u32 dispersionTauOffset,
  u32 muDispersiveMaterialOffset,
  u32 muDispersionAxesOffset,
  u32 muDispersionOmegaPOffset,
  u32 muDispersionGammaOffset,
  u32 muDispersionOmega0Offset,
  u32 muDispersionDeltaMuOffset,
  u32 muDispersionTauOffset,
  u32 dispPzOffset,
  u32 dispJzOffset,
  u32 dispPxOffset,
  u32 dispJxOffset,
  u32 dispPyOffset,
  u32 dispJyOffset,
  u32 magDispMzOffset,
  u32 magDispJzOffset,
  u32 magDispMxOffset,
  u32 magDispJxOffset,
  u32 magDispMyOffset,
  u32 magDispJyOffset,
  u32 cpmlKappaEXOffset,
  u32 cpmlKappaHXOffset,
  u32 cpmlKappaEYOffset,
  u32 cpmlKappaHYOffset,
  u32 cpmlAEXOffset,
  u32 cpmlAHXOffset,
  u32 cpmlAEYOffset,
  u32 cpmlAHYOffset,
  u32 cpmlBEXOffset,
  u32 cpmlBHXOffset,
  u32 cpmlBEYOffset,
  u32 cpmlBHYOffset,
  u32 cpmlPsiHxYOffset,
  u32 cpmlPsiHyXOffset,
  u32 cpmlPsiEzXOffset,
  u32 cpmlPsiEzYOffset,
  u32 cpmlPsiExYOffset,
  u32 cpmlPsiEyXOffset,
  u32 cpmlPsiHzXOffset,
  u32 cpmlPsiHzYOffset,
  i32 runtimeFlags,
  float kerrChi3,
  float kerrSaturation,
  float gainSaturation,
  float modulationDepth,
  float modulationPeriodCells,
  float modulationCosTheta,
  float modulationSinTheta,
  float modulationOmegaCycles,
  float modulationPhase,
  float time,
  float fieldScale,
  u32 tfsfSourcesOffset,
  i32 tfsfSourceCount,
  u32 modeSourcesOffset,
  u32 modeProfilesOffset,
  u32 modeEpsilonProfilesOffset,
  u32 modeMuProfilesOffset,
  i32 modeSourceCount
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
  u8* modulatedMaterial = u8_array(modulatedMaterialOffset);
  float* modulationPhaseOffset = f32(modulationPhaseOffsetOffset);
  u8* nonlinearMaterial = u8_array(nonlinearMaterialOffset);
  u8* electricTensorMaterial = u8_array(electricTensorMaterialOffset);
  u8* gyrotropicMaterial = u8_array(gyrotropicMaterialOffset);
  u8* dispersiveMaterial = u8_array(dispersiveMaterialOffset);
  u8* dispersionAxes = u8_array(dispersionAxesOffset);
  float* modulationBaseEps = f32(modulationBaseEpsOffset);
  float* modulationBaseEpsY = f32(modulationBaseEpsYOffset);
  float* epsilonXY = f32(epsilonXYOffset);
  float* gyrotropyG = f32(gyrotropyGOffset);
  float* dispersionOmegaP = f32(dispersionOmegaPOffset);
  float* dispersionGamma = f32(dispersionGammaOffset);
  float* dispersionOmega0 = f32(dispersionOmega0Offset);
  float* dispersionDeltaEps = f32(dispersionDeltaEpsOffset);
  float* dispersionTau = f32(dispersionTauOffset);
  float* dispersionAxisX = f32(dispersionAxisXOffset);
  float* dispersionAxisY = f32(dispersionAxisYOffset);
  u8* muDispersiveMaterial = u8_array(muDispersiveMaterialOffset);
  u8* muDispersionAxes = u8_array(muDispersionAxesOffset);
  float* muDispersionOmegaP = f32(muDispersionOmegaPOffset);
  float* muDispersionGamma = f32(muDispersionGammaOffset);
  float* muDispersionOmega0 = f32(muDispersionOmega0Offset);
  float* muDispersionDeltaMu = f32(muDispersionDeltaMuOffset);
  float* muDispersionTau = f32(muDispersionTauOffset);
  float* dispPx = f32(dispPxOffset);
  float* dispJx = f32(dispJxOffset);
  float* dispPy = f32(dispPyOffset);
  float* dispJy = f32(dispJyOffset);
  float* magDispMz = f32(magDispMzOffset);
  float* magDispJz = f32(magDispJzOffset);
  float* cpmlKappaEX = f32(cpmlKappaEXOffset);
  float* cpmlKappaHX = f32(cpmlKappaHXOffset);
  float* cpmlKappaEY = f32(cpmlKappaEYOffset);
  float* cpmlKappaHY = f32(cpmlKappaHYOffset);
  float* cpmlAEX = f32(cpmlAEXOffset);
  float* cpmlAHX = f32(cpmlAHXOffset);
  float* cpmlAEY = f32(cpmlAEYOffset);
  float* cpmlAHY = f32(cpmlAHYOffset);
  float* cpmlBEX = f32(cpmlBEXOffset);
  float* cpmlBHX = f32(cpmlBHXOffset);
  float* cpmlBEY = f32(cpmlBEYOffset);
  float* cpmlBHY = f32(cpmlBHYOffset);
  float* cpmlPsiExY = f32(cpmlPsiExYOffset);
  float* cpmlPsiEyX = f32(cpmlPsiEyXOffset);
  float* cpmlPsiHzX = f32(cpmlPsiHzXOffset);
  float* cpmlPsiHzY = f32(cpmlPsiHzYOffset);
  float* tfsfSources = f32(tfsfSourcesOffset);
  float* modeSources = f32(modeSourcesOffset);
  float* modeProfiles = f32(modeProfilesOffset);
  float* modeEpsilonProfiles = f32(modeEpsilonProfilesOffset);
  const i32 n = nx * ny;

  if (runtimeFlags & (STEP_KERR | STEP_MODULATION)) {
    apply_dynamic_permittivity_response(
      nx,
      ny,
      1,
      runtimeFlags,
      kerrChi3,
      kerrSaturation,
      modulationDepth,
      modulationPeriodCells,
      modulationCosTheta,
      modulationSinTheta,
      modulationOmegaCycles,
      modulationPhase,
      time,
      hz,
      ex,
      ey,
      eps,
      epsY,
      material,
      modulatedMaterial,
      modulationPhaseOffset,
      nonlinearMaterial,
      modulationBaseEps,
      modulationBaseEpsY,
      fieldScale
    );
  }

  for (i32 y = 0; y < ny - 1; y += 1) {
    const i32 row = y * nx;
    for (i32 x = 0; x < nx; x += 1) {
      const i32 i = row + x;
      if (material[i] == 2) {
        ex[i] = 0.0f;
        continue;
      }
      if ((runtimeFlags & STEP_TENSOR_GYRO) && (gyrotropicMaterial[i] || electricTensorMaterial[i])) continue;
      const float dHzDy = cpml_derivative(hz[i + nx] - hz[i], cpmlPsiExY, i, y, cpmlKappaEY, cpmlAEY, cpmlBEY);
      const float sigmaDamp = conductivity_damp(conductivity[i], eps[i], s);
      const float sigmaCa = (1.0f - sigmaDamp) / (1.0f + sigmaDamp);
      const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
      const float intensity = physical_intensity(ex[i] * ex[i] + ey[i] * ey[i], fieldScale);
      const float decay = electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
      ex[i] = (sigmaCa * ex[i] + sigmaCb * (s / safe_material_denominator(eps[i])) * dHzDy) * decay;
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
      const float dHzDx = cpml_derivative(hz[i + 1] - hz[i], cpmlPsiEyX, i, x, cpmlKappaEX, cpmlAEX, cpmlBEX);
      const float sigmaDamp = conductivity_damp(conductivityY[i], epsY[i], s);
      const float sigmaCa = (1.0f - sigmaDamp) / (1.0f + sigmaDamp);
      const float sigmaCb = 1.0f / (1.0f + sigmaDamp);
      const float intensity = physical_intensity(ex[i] * ex[i] + ey[i] * ey[i], fieldScale);
      const float decay = electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
      ey[i] = (sigmaCa * ey[i] - sigmaCb * (s / safe_material_denominator(epsY[i])) * dHzDx) * decay;
    }
  }

  if (runtimeFlags & STEP_TENSOR_GYRO) {
    for (i32 y = 0; y < ny - 1; y += 1) {
      const i32 row = y * nx;
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
        const float dHzDy = cpml_derivative(hz[i + nx] - hz[i], cpmlPsiExY, i, y, cpmlKappaEY, cpmlAEY, cpmlBEY);
        const float dHzDx = cpml_derivative(hz[i + 1] - hz[i], cpmlPsiEyX, i, x, cpmlKappaEX, cpmlAEX, cpmlBEX);
        const float sourceX = sigmaCbX * s * dHzDy;
        const float sourceY = -sigmaCbY * s * dHzDx;
        const float coupledX = (epsYi * sourceX - upperOffDiagonal * sourceY) / safeDet;
        const float coupledY = (-lowerOffDiagonal * sourceX + epsX * sourceY) / safeDet;
        const float intensity = physical_intensity(ex[i] * ex[i] + ey[i] * ey[i], fieldScale);
        const float decayX = electric_loss_decay(loss[i], intensity, runtimeFlags, gainSaturation);
        const float decayY = electric_loss_decay(lossY[i], intensity, runtimeFlags, gainSaturation);
        ex[i] = (sigmaCaX * ex[i] + coupledX) * decayX;
        ey[i] = (sigmaCaY * ey[i] + coupledY) * decayY;
      }
    }
  }

  if (runtimeFlags & STEP_ELECTRIC_ADE) {
    apply_electric_ade_te(
      nx,
      ny,
      s,
      ex,
      ey,
      eps,
      epsY,
      epsilonXY,
      gyrotropyG,
      material,
      dispersiveMaterial,
      dispersionAxes,
      dispersionAxisX,
      dispersionAxisY,
      dispersionOmegaP,
      dispersionGamma,
      dispersionOmega0,
      dispersionDeltaEps,
      dispersionTau,
      dispPx,
      dispJx,
      dispPy,
      dispJy
    );
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
      runtimeFlags,
      gainSaturation
    );
  }
  if (modeSourceCount > 0) {
    apply_mode_te_electric(
      nx,
      ny,
      s,
      time,
      fieldScale,
      modeSources,
      modeProfiles,
      modeSourceCount,
      ex,
      ey,
      epsY,
      lossY,
      conductivityY,
      material,
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
      const float dEyDx = cpml_derivative(ey[i] - ey[i - 1], cpmlPsiHzX, i, x, cpmlKappaHX, cpmlAHX, cpmlBHX);
      const float dExDy = cpml_derivative(ex[i] - ex[i - nx], cpmlPsiHzY, i, y, cpmlKappaHY, cpmlAHY, cpmlBHY);
      const float hzxNew = (hzx[i] - (s / safe_material_denominator(mu[i])) * dEyDx) * magnetic_loss_decay(muLoss[i]);
      const float hzyNew = (hzy[i] + (s / safe_material_denominator(muY[i])) * dExDy) * magnetic_loss_decay(muLossY[i]);
      hzx[i] = hzxNew;
      hzy[i] = hzyNew;
      hz[i] = hzxNew + hzyNew;
    }
  }

  if (runtimeFlags & STEP_MAGNETIC_ADE) {
    apply_magnetic_ade_te(
      nx,
      ny,
      s,
      hz,
      hzx,
      hzy,
      mu,
      muLoss,
      muY,
      muLossY,
      material,
      muDispersiveMaterial,
      muDispersionAxes,
      muDispersionOmegaP,
      muDispersionGamma,
      muDispersionOmega0,
      muDispersionDeltaMu,
      muDispersionTau,
      magDispMz,
      magDispJz
    );
  }

  if (tfsfSourceCount > 0) {
    apply_tfsf_te_magnetic(nx, ny, s, time, fieldScale, tfsfSources, tfsfSourceCount, hz, hzx, hzy, mu, muLoss, muY, muLossY, material);
  }
  if (modeSourceCount > 0) {
    apply_mode_te_magnetic(
      nx,
      ny,
      s,
      time,
      fieldScale,
      modeSources,
      modeProfiles,
      modeEpsilonProfiles,
      modeSourceCount,
      hz,
      hzx,
      hzy,
      mu,
      muLoss,
      material
    );
  }

  rebalance_te_split_storage(n, hz, hzx, hzy, ex, ey, mu, muLoss, muY, muLossY, material);
}
