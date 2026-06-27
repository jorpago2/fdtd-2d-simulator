// Minimal C++ source for the browser WASM FDTD kernel.
//
// The exported signatures intentionally match fdtd-core.wat and
// src/wasm-backend.js: array arguments are byte offsets into the imported
// WebAssembly linear memory owned by JavaScript.

using i32 = int;
using u32 = unsigned int;
using u8 = unsigned char;

static inline float* f32(u32 offset) {
  return reinterpret_cast<float*>(offset);
}

static inline u8* u8_array(u32 offset) {
  return reinterpret_cast<u8*>(offset);
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
  u32 muOffset,
  u32 muLossOffset,
  u32 muYOffset,
  u32 muLossYOffset,
  u32 materialOffset,
  u32 eCaXOffset,
  u32 eCbXOffset,
  u32 eCaYOffset,
  u32 eCbYOffset,
  u32 hCaXOffset,
  u32 hCbXOffset,
  u32 hCaYOffset,
  u32 hCbYOffset
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
  float* mu = f32(muOffset);
  float* muLoss = f32(muLossOffset);
  float* muY = f32(muYOffset);
  float* muLossY = f32(muLossYOffset);
  u8* material = u8_array(materialOffset);
  float* eCaX = f32(eCaXOffset);
  float* eCbX = f32(eCbXOffset);
  float* eCaY = f32(eCaYOffset);
  float* eCbY = f32(eCbYOffset);
  float* hCaX = f32(hCaXOffset);
  float* hCbX = f32(hCbXOffset);
  float* hCaY = f32(hCaYOffset);
  float* hCbY = f32(hCbYOffset);

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
      const float ezxNew = (eCaX[x] * ezx[i] + eCbX[x] * (s / eps[i]) * dHyDx) / (1.0f + loss[i]);
      const float ezyNew = (eCaY[y] * ezy[i] - eCbY[y] * (s / epsY[i]) * dHxDy) / (1.0f + lossY[i]);
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
  u32 muOffset,
  u32 muLossOffset,
  u32 muYOffset,
  u32 muLossYOffset,
  u32 materialOffset,
  u32 eCaXOffset,
  u32 eCbXOffset,
  u32 eCaYOffset,
  u32 eCbYOffset,
  u32 hCaXOffset,
  u32 hCbXOffset,
  u32 hCaYOffset,
  u32 hCbYOffset
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
  float* mu = f32(muOffset);
  float* muLoss = f32(muLossOffset);
  float* muY = f32(muYOffset);
  float* muLossY = f32(muLossYOffset);
  u8* material = u8_array(materialOffset);
  float* eCaX = f32(eCaXOffset);
  float* eCbX = f32(eCbXOffset);
  float* eCaY = f32(eCaYOffset);
  float* eCbY = f32(eCbYOffset);
  float* hCaX = f32(hCaXOffset);
  float* hCbX = f32(hCbXOffset);
  float* hCaY = f32(hCaYOffset);
  float* hCbY = f32(hCbYOffset);

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
      ex[i] = (ca * ex[i] + cb * (s / eps[i]) * (hz[i + nx] - hz[i])) / (1.0f + loss[i]);
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
      ey[i] = (eCaX[x] * ey[i] - eCbX[x] * (s / epsY[i]) * (hz[i + 1] - hz[i])) / (1.0f + lossY[i]);
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
