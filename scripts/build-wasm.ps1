param(
  [string]$WatPath = "fdtd-core.wat",
  [string]$WasmPath = "fdtd-core.wasm"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$wat = Join-Path $repoRoot $WatPath
$wasm = Join-Path $repoRoot $WasmPath
$toolDir = Join-Path $env:TEMP "fdtd-wabt-py"

if (-not (Test-Path -LiteralPath $wat)) {
  throw "WAT source not found: $wat"
}

New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
$env:PYTHONPATH = $toolDir

$checkWabt = @'
try:
    import wabt  # noqa: F401
    print("yes")
except Exception:
    print("no")
'@
$hasWabt = $checkWabt | python -

if ($hasWabt.Trim() -ne "yes") {
  python -m pip install --quiet --target $toolDir wabt
}

$buildWasm = @"
from pathlib import Path
from wabt import Wabt

wat = Path(r"$wat")
wasm = Path(r"$wasm")
wabt = Wabt()
wabt.wat_to_wasm(str(wat), output=str(wasm))
wabt.wasm_validate(str(wasm))
print(f"Built {wasm} ({wasm.stat().st_size} bytes)")
"@
$buildWasm | python -
