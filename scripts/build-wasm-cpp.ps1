param(
  [string]$SourcePath = "wasm-src/fdtd-core.cpp",
  [string]$WasmPath = "fdtd-core.wasm",
  [string]$Compiler = "clang++"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot $SourcePath
$wasm = Join-Path $repoRoot $WasmPath
$compilerCommand = Get-Command $Compiler -ErrorAction SilentlyContinue

if (-not (Test-Path -LiteralPath $source)) {
  throw "C++ WASM source not found: $source"
}

if (-not $compilerCommand) {
  throw "Compiler '$Compiler' was not found. Install LLVM/clang with wasm32 support or pass -Compiler with an absolute clang++ path."
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
