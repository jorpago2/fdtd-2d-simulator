(module
  (import "env" "memory" (memory 1 4096))

  (func (export "kernel_features") (result i32)
    (i32.const 0))

  (func (export "step")
    (param $nx i32)
    (param $ny i32)
    (param $s f32)
    (param $ez i32)
    (param $ezx i32)
    (param $ezy i32)
    (param $hx i32)
    (param $hy i32)
    (param $eps i32)
    (param $loss i32)
    (param $epsY i32)
    (param $lossY i32)
    (param $conductivity i32)
    (param $conductivityY i32)
    (param $mu i32)
    (param $muLoss i32)
    (param $muY i32)
    (param $muLossY i32)
    (param $material i32)
    (param $nonlinearMaterial i32)
    (param $electricTensorMaterial i32)
    (param $gyrotropicMaterial i32)
    (param $modulationBaseEps i32)
    (param $modulationBaseEpsY i32)
    (param $epsilonXY i32)
    (param $gyrotropyG i32)
    (param $eCaX i32)
    (param $eCbX i32)
    (param $eCaY i32)
    (param $eCbY i32)
    (param $hCaX i32)
    (param $hCbX i32)
    (param $hCaY i32)
    (param $hCbY i32)
    (param $runtimeFlags i32)
    (param $kerrChi3 f32)
    (param $kerrSaturation f32)
    (param $gainSaturation f32)
    (local $x i32)
    (local $y i32)
    (local $row i32)
    (local $i i32)
    (local $addr i32)
    (local $ca f32)
    (local $cb f32)
    (local $ezCurrent f32)
    (local $delta f32)
    (local $dHyDx f32)
    (local $dHxDy f32)
    (local $decay f32)
    (local $materialScale f32)
    (local $ezxNew f32)
    (local $ezyNew f32)

    ;; Hx update: Hx(y, x) -= S * dEz/dy with Y-PML coefficients.
    (local.set $y (i32.const 0))
    (block $hxRowsDone
      (loop $hxRows
        (br_if $hxRowsDone (i32.ge_s (local.get $y) (i32.sub (local.get $ny) (i32.const 1))))
        (local.set $row (i32.mul (local.get $y) (local.get $nx)))
        (local.set $ca (f32.load (i32.add (local.get $hCaY) (i32.shl (local.get $y) (i32.const 2)))))
        (local.set $cb (f32.load (i32.add (local.get $hCbY) (i32.shl (local.get $y) (i32.const 2)))))
        (local.set $x (i32.const 0))
        (block $hxColsDone
          (loop $hxCols
            (br_if $hxColsDone (i32.ge_s (local.get $x) (local.get $nx)))
            (local.set $i (i32.add (local.get $row) (local.get $x)))
            (local.set $addr (i32.add (local.get $hx) (i32.shl (local.get $i) (i32.const 2))))
            (local.set $ezCurrent
              (f32.load
                (i32.add
                  (local.get $ez)
                  (i32.shl (local.get $i) (i32.const 2)))))
            (local.set $delta
              (f32.sub
                (f32.load
                  (i32.add
                    (local.get $ez)
                    (i32.shl (i32.add (local.get $i) (local.get $nx)) (i32.const 2))))
                (local.get $ezCurrent)))
            (local.set $decay
              (f32.div
                (f32.const 1)
                (f32.add
                  (f32.const 1)
                  (f32.load (i32.add (local.get $muLoss) (i32.shl (local.get $i) (i32.const 2)))))))
            (local.set $materialScale
              (f32.div
                (local.get $s)
                (f32.load (i32.add (local.get $mu) (i32.shl (local.get $i) (i32.const 2))))))
            (f32.store
              (local.get $addr)
              (f32.mul
                (f32.sub
                  (f32.mul (local.get $ca) (f32.load (local.get $addr)))
                  (f32.mul (f32.mul (local.get $cb) (local.get $materialScale)) (local.get $delta)))
                (local.get $decay)))
            (local.set $x (i32.add (local.get $x) (i32.const 1)))
            (br $hxCols)))
        (local.set $y (i32.add (local.get $y) (i32.const 1)))
        (br $hxRows)))

    ;; Hy update: Hy(y, x) += S * dEz/dx with X-PML coefficients.
    (local.set $y (i32.const 0))
    (block $hyRowsDone
      (loop $hyRows
        (br_if $hyRowsDone (i32.ge_s (local.get $y) (local.get $ny)))
        (local.set $row (i32.mul (local.get $y) (local.get $nx)))
        (local.set $x (i32.const 0))
        (block $hyColsDone
          (loop $hyCols
            (br_if $hyColsDone (i32.ge_s (local.get $x) (i32.sub (local.get $nx) (i32.const 1))))
            (local.set $i (i32.add (local.get $row) (local.get $x)))
            (local.set $addr (i32.add (local.get $hy) (i32.shl (local.get $i) (i32.const 2))))
            (local.set $ezCurrent
              (f32.load
                (i32.add
                  (local.get $ez)
                  (i32.shl (local.get $i) (i32.const 2)))))
            (local.set $delta
              (f32.sub
                (f32.load
                  (i32.add
                    (local.get $ez)
                    (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 2))))
                (local.get $ezCurrent)))
            (local.set $decay
              (f32.div
                (f32.const 1)
                (f32.add
                  (f32.const 1)
                  (f32.load (i32.add (local.get $muLossY) (i32.shl (local.get $i) (i32.const 2)))))))
            (local.set $materialScale
              (f32.div
                (local.get $s)
                (f32.load (i32.add (local.get $muY) (i32.shl (local.get $i) (i32.const 2))))))
            (f32.store
              (local.get $addr)
              (f32.mul
                (f32.add
                  (f32.mul
                    (f32.load (i32.add (local.get $hCaX) (i32.shl (local.get $x) (i32.const 2))))
                    (f32.load (local.get $addr)))
                  (f32.mul
                    (f32.mul
                      (f32.load (i32.add (local.get $hCbX) (i32.shl (local.get $x) (i32.const 2))))
                      (local.get $materialScale))
                    (local.get $delta)))
                (local.get $decay)))
            (local.set $x (i32.add (local.get $x) (i32.const 1)))
            (br $hyCols)))
        (local.set $y (i32.add (local.get $y) (i32.const 1)))
        (br $hyRows)))

    ;; Ez split-field update with material scaling, loss, PEC cells, and PML coefficients.
    (local.set $y (i32.const 1))
    (block $ezRowsDone
      (loop $ezRows
        (br_if $ezRowsDone (i32.ge_s (local.get $y) (i32.sub (local.get $ny) (i32.const 1))))
        (local.set $row (i32.mul (local.get $y) (local.get $nx)))
        (local.set $x (i32.const 1))
        (block $ezColsDone
          (loop $ezCols
            (br_if $ezColsDone (i32.ge_s (local.get $x) (i32.sub (local.get $nx) (i32.const 1))))
            (local.set $i (i32.add (local.get $row) (local.get $x)))
            (if
              (i32.eq
                (i32.load8_u (i32.add (local.get $material) (local.get $i)))
                (i32.const 2))
              (then
                (f32.store (i32.add (local.get $ez) (i32.shl (local.get $i) (i32.const 2))) (f32.const 0))
                (f32.store (i32.add (local.get $ezx) (i32.shl (local.get $i) (i32.const 2))) (f32.const 0))
                (f32.store (i32.add (local.get $ezy) (i32.shl (local.get $i) (i32.const 2))) (f32.const 0)))
              (else
                (local.set $dHyDx
                  (f32.sub
                    (f32.load (i32.add (local.get $hy) (i32.shl (local.get $i) (i32.const 2))))
                    (f32.load (i32.add (local.get $hy) (i32.shl (i32.sub (local.get $i) (i32.const 1)) (i32.const 2))))))
                (local.set $dHxDy
                  (f32.sub
                    (f32.load (i32.add (local.get $hx) (i32.shl (local.get $i) (i32.const 2))))
                    (f32.load (i32.add (local.get $hx) (i32.shl (i32.sub (local.get $i) (local.get $nx)) (i32.const 2))))))
                (local.set $decay
                  (f32.div
                    (f32.const 1)
                    (f32.add
                      (f32.const 1)
                      (f32.load (i32.add (local.get $loss) (i32.shl (local.get $i) (i32.const 2)))))))
                (local.set $materialScale
                  (f32.div
                    (local.get $s)
                    (f32.load (i32.add (local.get $eps) (i32.shl (local.get $i) (i32.const 2))))))
                (local.set $ezxNew
                  (f32.mul
                    (f32.add
                      (f32.mul
                        (f32.load (i32.add (local.get $eCaX) (i32.shl (local.get $x) (i32.const 2))))
                        (f32.load (i32.add (local.get $ezx) (i32.shl (local.get $i) (i32.const 2)))))
                      (f32.mul
                        (f32.mul
                          (f32.load (i32.add (local.get $eCbX) (i32.shl (local.get $x) (i32.const 2))))
                          (local.get $materialScale))
                        (local.get $dHyDx)))
                    (local.get $decay)))
                (local.set $decay
                  (f32.div
                    (f32.const 1)
                    (f32.add
                      (f32.const 1)
                      (f32.load (i32.add (local.get $lossY) (i32.shl (local.get $i) (i32.const 2)))))))
                (local.set $materialScale
                  (f32.div
                    (local.get $s)
                    (f32.load (i32.add (local.get $epsY) (i32.shl (local.get $i) (i32.const 2))))))
                (local.set $ezyNew
                  (f32.mul
                    (f32.sub
                      (f32.mul
                        (f32.load (i32.add (local.get $eCaY) (i32.shl (local.get $y) (i32.const 2))))
                        (f32.load (i32.add (local.get $ezy) (i32.shl (local.get $i) (i32.const 2)))))
                      (f32.mul
                        (f32.mul
                          (f32.load (i32.add (local.get $eCbY) (i32.shl (local.get $y) (i32.const 2))))
                          (local.get $materialScale))
                        (local.get $dHxDy)))
                    (local.get $decay)))
                (f32.store (i32.add (local.get $ezx) (i32.shl (local.get $i) (i32.const 2))) (local.get $ezxNew))
                (f32.store (i32.add (local.get $ezy) (i32.shl (local.get $i) (i32.const 2))) (local.get $ezyNew))
                (f32.store
                  (i32.add (local.get $ez) (i32.shl (local.get $i) (i32.const 2)))
                  (f32.add (local.get $ezxNew) (local.get $ezyNew)))))
            (local.set $x (i32.add (local.get $x) (i32.const 1)))
            (br $ezCols)))
        (local.set $y (i32.add (local.get $y) (i32.const 1)))
        (br $ezRows))))

  (func (export "step_hz")
    (param $nx i32)
    (param $ny i32)
    (param $s f32)
    (param $hz i32)
    (param $hzx i32)
    (param $hzy i32)
    (param $ex i32)
    (param $ey i32)
    (param $eps i32)
    (param $loss i32)
    (param $epsY i32)
    (param $lossY i32)
    (param $conductivity i32)
    (param $conductivityY i32)
    (param $mu i32)
    (param $muLoss i32)
    (param $muY i32)
    (param $muLossY i32)
    (param $material i32)
    (param $nonlinearMaterial i32)
    (param $electricTensorMaterial i32)
    (param $gyrotropicMaterial i32)
    (param $modulationBaseEps i32)
    (param $modulationBaseEpsY i32)
    (param $epsilonXY i32)
    (param $gyrotropyG i32)
    (param $eCaX i32)
    (param $eCbX i32)
    (param $eCaY i32)
    (param $eCbY i32)
    (param $hCaX i32)
    (param $hCbX i32)
    (param $hCaY i32)
    (param $hCbY i32)
    (param $runtimeFlags i32)
    (param $kerrChi3 f32)
    (param $kerrSaturation f32)
    (param $gainSaturation f32)
    (local $x i32)
    (local $y i32)
    (local $row i32)
    (local $i i32)
    (local $addr i32)
    (local $ca f32)
    (local $cb f32)
    (local $hzCurrent f32)
    (local $delta f32)
    (local $dEyDx f32)
    (local $dExDy f32)
    (local $decay f32)
    (local $materialScale f32)
    (local $hzxNew f32)
    (local $hzyNew f32)

    ;; Ex update: Ex(y, x) += S / eps_x * dHz/dy with Y-PML coefficients.
    (local.set $y (i32.const 0))
    (block $exRowsDone
      (loop $exRows
        (br_if $exRowsDone (i32.ge_s (local.get $y) (i32.sub (local.get $ny) (i32.const 1))))
        (local.set $row (i32.mul (local.get $y) (local.get $nx)))
        (local.set $ca (f32.load (i32.add (local.get $eCaY) (i32.shl (local.get $y) (i32.const 2)))))
        (local.set $cb (f32.load (i32.add (local.get $eCbY) (i32.shl (local.get $y) (i32.const 2)))))
        (local.set $x (i32.const 0))
        (block $exColsDone
          (loop $exCols
            (br_if $exColsDone (i32.ge_s (local.get $x) (local.get $nx)))
            (local.set $i (i32.add (local.get $row) (local.get $x)))
            (local.set $addr (i32.add (local.get $ex) (i32.shl (local.get $i) (i32.const 2))))
            (if
              (i32.eq
                (i32.load8_u (i32.add (local.get $material) (local.get $i)))
                (i32.const 2))
              (then
                (f32.store (local.get $addr) (f32.const 0)))
              (else
                (local.set $hzCurrent
                  (f32.load
                    (i32.add
                      (local.get $hz)
                      (i32.shl (local.get $i) (i32.const 2)))))
                (local.set $delta
                  (f32.sub
                    (f32.load
                      (i32.add
                        (local.get $hz)
                        (i32.shl (i32.add (local.get $i) (local.get $nx)) (i32.const 2))))
                    (local.get $hzCurrent)))
                (local.set $decay
                  (f32.div
                    (f32.const 1)
                    (f32.add
                      (f32.const 1)
                      (f32.load (i32.add (local.get $loss) (i32.shl (local.get $i) (i32.const 2)))))))
                (local.set $materialScale
                  (f32.div
                    (local.get $s)
                    (f32.load (i32.add (local.get $eps) (i32.shl (local.get $i) (i32.const 2))))))
                (f32.store
                  (local.get $addr)
                  (f32.mul
                    (f32.add
                      (f32.mul (local.get $ca) (f32.load (local.get $addr)))
                      (f32.mul (f32.mul (local.get $cb) (local.get $materialScale)) (local.get $delta)))
                    (local.get $decay)))))
            (local.set $x (i32.add (local.get $x) (i32.const 1)))
            (br $exCols)))
        (local.set $y (i32.add (local.get $y) (i32.const 1)))
        (br $exRows)))

    ;; Ey update: Ey(y, x) -= S / eps_y * dHz/dx with X-PML coefficients.
    (local.set $y (i32.const 0))
    (block $eyRowsDone
      (loop $eyRows
        (br_if $eyRowsDone (i32.ge_s (local.get $y) (local.get $ny)))
        (local.set $row (i32.mul (local.get $y) (local.get $nx)))
        (local.set $x (i32.const 0))
        (block $eyColsDone
          (loop $eyCols
            (br_if $eyColsDone (i32.ge_s (local.get $x) (i32.sub (local.get $nx) (i32.const 1))))
            (local.set $i (i32.add (local.get $row) (local.get $x)))
            (local.set $addr (i32.add (local.get $ey) (i32.shl (local.get $i) (i32.const 2))))
            (if
              (i32.eq
                (i32.load8_u (i32.add (local.get $material) (local.get $i)))
                (i32.const 2))
              (then
                (f32.store (local.get $addr) (f32.const 0)))
              (else
                (local.set $hzCurrent
                  (f32.load
                    (i32.add
                      (local.get $hz)
                      (i32.shl (local.get $i) (i32.const 2)))))
                (local.set $delta
                  (f32.sub
                    (f32.load
                      (i32.add
                        (local.get $hz)
                        (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 2))))
                    (local.get $hzCurrent)))
                (local.set $decay
                  (f32.div
                    (f32.const 1)
                    (f32.add
                      (f32.const 1)
                      (f32.load (i32.add (local.get $lossY) (i32.shl (local.get $i) (i32.const 2)))))))
                (local.set $materialScale
                  (f32.div
                    (local.get $s)
                    (f32.load (i32.add (local.get $epsY) (i32.shl (local.get $i) (i32.const 2))))))
                (f32.store
                  (local.get $addr)
                  (f32.mul
                    (f32.sub
                      (f32.mul
                        (f32.load (i32.add (local.get $eCaX) (i32.shl (local.get $x) (i32.const 2))))
                        (f32.load (local.get $addr)))
                      (f32.mul
                        (f32.mul
                          (f32.load (i32.add (local.get $eCbX) (i32.shl (local.get $x) (i32.const 2))))
                          (local.get $materialScale))
                        (local.get $delta)))
                    (local.get $decay)))))
            (local.set $x (i32.add (local.get $x) (i32.const 1)))
            (br $eyCols)))
        (local.set $y (i32.add (local.get $y) (i32.const 1)))
        (br $eyRows)))

    ;; Hz split-field update with material scaling, magnetic loss, PEC cells, and PML coefficients.
    (local.set $y (i32.const 1))
    (block $hzRowsDone
      (loop $hzRows
        (br_if $hzRowsDone (i32.ge_s (local.get $y) (i32.sub (local.get $ny) (i32.const 1))))
        (local.set $row (i32.mul (local.get $y) (local.get $nx)))
        (local.set $x (i32.const 1))
        (block $hzColsDone
          (loop $hzCols
            (br_if $hzColsDone (i32.ge_s (local.get $x) (i32.sub (local.get $nx) (i32.const 1))))
            (local.set $i (i32.add (local.get $row) (local.get $x)))
            (if
              (i32.eq
                (i32.load8_u (i32.add (local.get $material) (local.get $i)))
                (i32.const 2))
              (then
                (f32.store (i32.add (local.get $hz) (i32.shl (local.get $i) (i32.const 2))) (f32.const 0))
                (f32.store (i32.add (local.get $hzx) (i32.shl (local.get $i) (i32.const 2))) (f32.const 0))
                (f32.store (i32.add (local.get $hzy) (i32.shl (local.get $i) (i32.const 2))) (f32.const 0))
                (f32.store (i32.add (local.get $ex) (i32.shl (local.get $i) (i32.const 2))) (f32.const 0))
                (f32.store (i32.add (local.get $ey) (i32.shl (local.get $i) (i32.const 2))) (f32.const 0)))
              (else
                (local.set $dEyDx
                  (f32.sub
                    (f32.load (i32.add (local.get $ey) (i32.shl (local.get $i) (i32.const 2))))
                    (f32.load (i32.add (local.get $ey) (i32.shl (i32.sub (local.get $i) (i32.const 1)) (i32.const 2))))))
                (local.set $dExDy
                  (f32.sub
                    (f32.load (i32.add (local.get $ex) (i32.shl (local.get $i) (i32.const 2))))
                    (f32.load (i32.add (local.get $ex) (i32.shl (i32.sub (local.get $i) (local.get $nx)) (i32.const 2))))))
                (local.set $decay
                  (f32.div
                    (f32.const 1)
                    (f32.add
                      (f32.const 1)
                      (f32.load (i32.add (local.get $muLoss) (i32.shl (local.get $i) (i32.const 2)))))))
                (local.set $materialScale
                  (f32.div
                    (local.get $s)
                    (f32.load (i32.add (local.get $mu) (i32.shl (local.get $i) (i32.const 2))))))
                (local.set $hzxNew
                  (f32.mul
                    (f32.sub
                      (f32.mul
                        (f32.load (i32.add (local.get $hCaX) (i32.shl (local.get $x) (i32.const 2))))
                        (f32.load (i32.add (local.get $hzx) (i32.shl (local.get $i) (i32.const 2)))))
                      (f32.mul
                        (f32.mul
                          (f32.load (i32.add (local.get $hCbX) (i32.shl (local.get $x) (i32.const 2))))
                          (local.get $materialScale))
                        (local.get $dEyDx)))
                    (local.get $decay)))
                (local.set $decay
                  (f32.div
                    (f32.const 1)
                    (f32.add
                      (f32.const 1)
                      (f32.load (i32.add (local.get $muLossY) (i32.shl (local.get $i) (i32.const 2)))))))
                (local.set $materialScale
                  (f32.div
                    (local.get $s)
                    (f32.load (i32.add (local.get $muY) (i32.shl (local.get $i) (i32.const 2))))))
                (local.set $hzyNew
                  (f32.mul
                    (f32.add
                      (f32.mul
                        (f32.load (i32.add (local.get $hCaY) (i32.shl (local.get $y) (i32.const 2))))
                        (f32.load (i32.add (local.get $hzy) (i32.shl (local.get $i) (i32.const 2)))))
                      (f32.mul
                        (f32.mul
                          (f32.load (i32.add (local.get $hCbY) (i32.shl (local.get $y) (i32.const 2))))
                          (local.get $materialScale))
                        (local.get $dExDy)))
                    (local.get $decay)))
                (f32.store (i32.add (local.get $hzx) (i32.shl (local.get $i) (i32.const 2))) (local.get $hzxNew))
                (f32.store (i32.add (local.get $hzy) (i32.shl (local.get $i) (i32.const 2))) (local.get $hzyNew))
                (f32.store
                  (i32.add (local.get $hz) (i32.shl (local.get $i) (i32.const 2)))
                  (f32.add (local.get $hzxNew) (local.get $hzyNew)))))
            (local.set $x (i32.add (local.get $x) (i32.const 1)))
            (br $hzCols)))
        (local.set $y (i32.add (local.get $y) (i32.const 1)))
        (br $hzRows))))
)
