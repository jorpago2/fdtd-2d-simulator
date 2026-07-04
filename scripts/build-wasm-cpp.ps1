param(
  [string]$SourcePath = "native/fdtd-core/fdtd-core.cpp",
  [string]$WasmPath = "assets/wasm/fdtd-core.wasm",
  [string]$Compiler = "clang++"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot $SourcePath
$wasm = Join-Path $repoRoot $WasmPath
$compilerCommand = Get-Command $Compiler -ErrorAction SilentlyContinue

if (-not $compilerCommand -and $Compiler -eq "clang++" -and $env:WASI_SDK_PATH) {
  $candidate = Join-Path $env:WASI_SDK_PATH "bin\clang++.exe"
  if (Test-Path -LiteralPath $candidate) {
    $compilerCommand = Get-Command $candidate -ErrorAction SilentlyContinue
  }
}

if (-not $compilerCommand -and $Compiler -eq "clang++") {
  $toolRoot = Join-Path $HOME ".cache\fdtd-tools"
  $candidate = Get-ChildItem -Path $toolRoot -Filter "wasi-sdk-*-windows" -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "bin\clang++.exe" } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
  if ($candidate) {
    $compilerCommand = Get-Command $candidate -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path -LiteralPath $source)) {
  throw "C++ WASM source not found: $source"
}

if (-not $compilerCommand) {
  throw "Compiler '$Compiler' was not found. Install LLVM/clang with wasm32 support, set WASI_SDK_PATH, or pass -Compiler with an absolute clang++ path."
}

$args = @(
  "--target=wasm32",
  "-O3",
  "-flto",
  "-nostdlib",
  "-fno-exceptions",
  "-fno-rtti",
  "-Wl,--no-entry",
  "-Wl,--import-memory",
  "-Wl,--export=step",
  "-Wl,--export=step_hz",
  "-Wl,--export=kernel_features",
  "-Wl,--allow-undefined",
  "-o",
  $wasm,
  $source
)

& $compilerCommand.Source @args
if ($LASTEXITCODE -ne 0) {
  throw "C++ WASM build failed with exit code $LASTEXITCODE"
}

Write-Output "Built $wasm ($((Get-Item -LiteralPath $wasm).Length) bytes)"
