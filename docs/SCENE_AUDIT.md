# Scene Physics Audit

Generated: 2026-07-04T21:43:06.383Z
Git commit: bbdce2d+working-tree
Scenes audited: 141
Steps per scene: 24

## Summary

| Status | Count | Meaning |
| --- | ---: | --- |
| PASS | 113 | Contract, runtime smoke, and validation coverage are acceptable. |
| VALIDATION_GAP | 0 | Scene runs and matches its contract, but lacks an executable dedicated validation case. |
| WARN | 28 | Scene runs, but has a documented teaching/modeling caveat. |
| FIX_REQUIRED | 0 | Scene violates its inferred physical or runtime contract. |

## Blocking Findings

No `FIX_REQUIRED` scenes were found in this pass.

## Full Scene Table

| # | Scene | Group | Status | Contract | Runtime | Validation | Notes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
|  | `empty` Empty | General | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=0.00e+0 | none | OK |
| 1 | `planeWaveAir` Plane wave in air | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | air_propagation:P0/smoke | OK |
| 2 | `planeWaveDielectric` Plane wave in dielectric | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.79e-8 | plane_wave_dielectric_material_route:P1/physics | OK |
| 3 | `gaussianPulseAir` Gaussian pulse in free space | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=8.70e-5 | gaussian_pulse_air_temporal_source:P1/physics | OK |
| 4 | `twoSourceInterference` Two-source interference | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=3.03e-6 | two_source_interference_pair:P1/physics | OK |
| 5 | `frequencyBeat` Two-frequency beat | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=5.26e-6 | frequency_beat_dual_frequency_sources:P1/physics | OK |
| 6 | `singleSlit` Single slit diffraction | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=9.72e-8 | single_slit_diffraction_symmetry:P1/physics | OK |
| 7 | `doubleSlit` Double slit | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=9.72e-8 | double_slit_interference_profile:P1/physics | OK |
| 8 | `circularAperture` Circular aperture | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | circular_aperture_screen_geometry:P1/physics | OK |
| 9 | `teTmComparison` TEz/TMz comparison | 1. Maxwell and propagation | PASS | HZ polarization | WASM CPML+TFSF, 24 steps, E=2.41e-4 | te_tm_comparison_angle_sweep:P1/physics | OK |
| 10 | `poyntingPlaneWave` Poynting vector | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=3.67e-5 | poynting_plane_wave_oblique_flux_view:P1/physics | OK |
| 11 | `evanescentWave` Evanescent isolated wave | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=5.07e-2 | evanescent_wave_source_metadata:P1/physics, source_physics_first_pass:P1/physics | OK |
| 12 | `pmlAbsorption` CPML absorption check | 1. Maxwell and propagation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=9.98e-6 | pml_reflection:P0/physics | OK |
| 13 | `normalInterface` Normal air-dielectric interface | 2. Interfaces and multilayers | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | normal_interface_fresnel:P0/physics, json_reproducibility:P1/smoke | OK |
| 14 | `obliqueRefraction` Oblique refraction | 2. Interfaces and multilayers | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=2.73e-7 | oblique_refraction_gaussian_interface:P1/physics | OK |
| 15 | `brewsterTm` Brewster TM minimum | 2. Interfaces and multilayers | PASS | HZ polarization | WASM CPML+TFSF, 24 steps, E=3.97e-4 | brewster_tm_minimum:P0/physics | OK |
| 16 | `brewsterTeTm` TE/TM Brewster comparison | 2. Interfaces and multilayers | PASS | HZ polarization | WASM CPML+TFSF, 24 steps, E=3.97e-4 | brewster_te_tm_angle_sweep:P1/physics, monitor_observable_first_pass:P1/physics | OK |
| 17 | `totalInternalReflection` Total internal reflection | 2. Interfaces and multilayers | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=5.07e-6 | total_internal_reflection_evanescent:P1/physics | OK |
| 18 | `frustratedTir` Frustrated TIR | 2. Interfaces and multilayers | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=5.07e-6 | frustrated_tir_tunneling:P1/physics | OK |
| 19 | `quarterWaveCoating` Quarter-wave coating | 2. Interfaces and multilayers | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | quarter_wave_coating_low_reflection:P1/physics | OK |
| 20 | `braggMirror` 1D Bragg mirror | 2. Interfaces and multilayers | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=8.70e-5 | bragg_mirror_stopband_reflection:P1/physics | OK |
| 21 | `lossyInterface` Lossy interface | 2. Interfaces and multilayers | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | lossy_interface_material_route:P1/physics | OK |
| 22 | `anisotropicInterface` Anisotropic interface | 2. Interfaces and multilayers | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=2.07e-7 | anisotropic_interface_tensor_route:P1/physics | OK |
| 23 | `jzDipole` Point electric dipole Jz | 3. Sources and radiation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=7.41e-5 | jz_dipole_localized_source:P1/physics | OK |
| 24 | `inPlaneDipole` In-plane electric dipole Jx/Jy | 3. Sources and radiation | PASS | HZ polarization | WASM CPML, 24 steps, E=1.86e-6 | in_plane_dipole_hz_source:P1/physics | OK |
| 25 | `mzDipole` Effective magnetic dipole Mz | 3. Sources and radiation | PASS | HZ polarization | WASM CPML, 24 steps, E=7.41e-5 | mz_dipole_hz_source:P1/physics | OK |
| 26 | `dipoleSubstrate` Dipole over substrate | 3. Sources and radiation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=5.03e-5 | dipole_substrate_material_overlap:P1/physics | OK |
| 27 | `dipoleNearPec` Dipole near PEC mirror | 3. Sources and radiation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=5.08e-5 | dipole_near_pec_mirror:P1/physics | OK |
| 28 | `huygensRadiator` Huygens source | 3. Sources and radiation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=7.40e-5 | huygens_radiator_directional_source:P1/physics | OK |
| 29 | `circularDipole` Circular dipole | 3. Sources and radiation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=9.34e-4 | circular_dipole_quadrature_source:P1/physics | OK |
| 30 | `janusDipole` Janus dipole | 3. Sources and radiation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=2.95e-4 | janus_dipole_guide_directional_source:P1/physics | OK |
| 31 | `dipoleArray` Equal-phase dipole array | 3. Sources and radiation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=8.74e-5 | dipole_array_equal_phase_geometry:P1/physics | OK |
| 32 | `phasedDipoleArray` Progressive-phase dipole array | 3. Sources and radiation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=2.76e-4 | phased_dipole_array_progressive_phase:P1/physics | OK |
| 33 | `apertureRadiator` Slot aperture radiator | 3. Sources and radiation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=6.96e-6 | aperture_radiator_slot_geometry:P1/physics | OK |
| 34 | `nearFarFieldNtff` Near-field / far-field NTFF | 3. Sources and radiation | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=4.96e-5 | near_far_field_ntff_proxy:P1/physics | OK |
| 35 | `slabWaveguide` Single-mode slab waveguide | 4. Guided optics | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.52e-6 | slab_waveguide_confinement:P0/physics | OK |
| 36 | `multimodeSlab` Multimode slab waveguide | 4. Guided optics | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=5.19e-6 | multimode_slab_two_mode_launch:P1/physics | OK |
| 37 | `lossyGuide` Lossy waveguide | 4. Guided optics | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=1.52e-6 | lossy_guide_absorptive_core:P1/physics | OK |
| 38 | `waveguideBend` Waveguide bend | 4. Guided optics | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.52e-6 | waveguide_bend_l_route:P1/physics | OK |
| 39 | `taperWaveguide` Tapered waveguide | 4. Guided optics | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.58e-6 | taper_waveguide_width_ramp:P1/physics | OK |
| 40 | `widthStepWaveguide` Width step waveguide | 4. Guided optics | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.52e-6 | width_step_waveguide_abrupt_step:P1/physics | OK |
| 41 | `directionalCoupler` Directional coupler | 4. Guided optics | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.57e-6 | directional_coupler_two_parallel_guides:P1/physics | OK |
| 42 | `mmiWaveguide` MMI section | 4. Guided optics | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=5.79e-6 | mmi_50_50_split:P1/physics | OK |
| 43 | `machZehnder` Mach-Zehnder interferometer | 4. Guided optics | WARN | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.58e-6 | mach_zehnder_dual_arm_route:P1/physics | Reduced 2D guided-interferometer layout; useful for arm splitting/recombination, not a calibrated phase-transfer curve. |
| 44 | `guideScatterer` Waveguide with scatterer | 4. Guided optics | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.77e-6 | guide_scatterer_off_axis_defect:P1/physics | OK |
| 45 | `microstrip` Microstrip line | 4. Guided optics | WARN | HZ polarization | WASM CPML+TFSF, 24 steps, E=3.04e-6 | microstrip_hz_cross_section_proxy:P1/physics | 2D Hz cross-section proxy for a microstrip-like field pattern, not a calibrated transmission-line model. |
| 46 | `stubResonator` Stub resonator | 4. Guided optics | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.52e-6 | stub_resonator_side_branch:P1/physics | OK |
| 47 | `fabryPerot` Fabry-Perot cavity | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=8.70e-5 | fabry_perot_cavity_localization:P1/physics | OK |
| 48 | `fabryPerotStanding` Fabry-Perot standing field | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=4.06e-8 | fabry_perot_standing_wave:P1/physics | OK |
| 49 | `ringResonator` Ring resonator | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=1.33e-6 | ring_resonator_coupling:P1/physics | OK |
| 50 | `addDropRing` Add-drop ring | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=1.33e-6 | add_drop_ring_coupling:P1/physics | OK |
| 51 | `racetrackResonator` Racetrack resonator | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.52e-6 | racetrack_resonator_bus_coupling:P1/physics | OK |
| 52 | `dielectricCavity` Dielectric defect cavity | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=1.41e-7 | dielectric_cavity_disk_dipole:P1/physics | OK |
| 53 | `pecCavity` PEC half-wave cavity | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=2.23e-7 | pec_cavity_frame_source:P1/physics | OK |
| 54 | `quarterWaveCavity` Quarter-wave cavity | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.58e-6 | quarter_wave_cavity_short_stub:P1/physics | OK |
| 55 | `qRingdown` Q by ringdown | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=1.46e-8 | resonator_ringdown_q:P0/physics | OK |
| 56 | `purcell2d` Purcell 2D proxy | 5. Resonators and cavities | WARN | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=9.34e-8 | purcell_2d_cavity_proxy:P1/physics | 2D Q/Aeff Purcell proxy; not an absolute 3D local-density-of-states or emitter-rate calculation. |
| 57 | `betaFactor` beta-factor guide coupling | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=8.40e-8 | beta_factor_guided_flux_proxy:P1/physics | OK |
| 58 | `degenerateModes` Degenerate cavity modes | 5. Resonators and cavities | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=1.38e-8 | degenerate_modes_dual_dipole_split:P1/physics | OK |
| 59 | `pecCylinder` PEC cylinder scattering | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | pec_cylinder_scattering_shadow:P1/physics | OK |
| 60 | `dielectricCylinder` Dielectric cylinder scattering | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | dielectric_cylinder_scattering_presence:P1/physics | OK |
| 61 | `mieCylinder` High-index Mie cylinder | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=8.70e-5 | mie_cylinder_high_index_response:P1/physics | OK |
| 62 | `rcsCylinder` RCS 2D cylinder | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=4.66e-8 | rcs_cylinder_ntff_finite:P1/physics | OK |
| 63 | `lossyCylinder` Lossy cylinder | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | lossy_cylinder_absorption_proxy:P1/physics | OK |
| 64 | `dielectricDimer` Dielectric dimer | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | dielectric_dimer_gap_coupling:P1/physics | OK |
| 65 | `kerker2d` Kerker-like 2D scattering | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=7.59e-8 | kerker_forward_backward_contrast:P1/physics | OK |
| 66 | `multipleScattering` Multiple scattering | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | multiple_scattering_cluster_spread:P1/physics | OK |
| 67 | `weakLocalization` Weak-localization disorder | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=8.70e-5 | weak_localization_disorder_spread:P1/physics | OK |
| 68 | `andersonLocalization` Anderson-localization disorder | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=4.41e-6 | anderson_localization_trapping_proxy:P1/physics | OK |
| 69 | `diffusiveRandomMedium` Diffusive random medium | 6. Scattering and disorder | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.58e-6 | diffusive_random_medium_transport:P1/physics | OK |
| 70 | `finiteConductivity` Finite-conductivity skin depth | 7. Material models and tensors | PASS | conductive material | WASM CPML+sigma+TFSF, 24 steps, E=4.54e-5 | finite_conductivity_skin_depth_proxy:P1/physics | OK |
| 71 | `drudeMetal` Drude metal | 7. Material models and tensors | PASS | dispersive material | WASM CPML+ADE+TFSF, 24 steps, E=3.25e-5 | advanced_material_smoke:P0/smoke, drude_ade_response:P1/physics | OK |
| 72 | `lorentzMedium` Lorentz resonant medium | 7. Material models and tensors | PASS | dispersive material | WASM CPML+ADE+TFSF, 24 steps, E=3.25e-5 | lorentz_resonant_ade_response:P1/physics | OK |
| 73 | `debyeDielectric` Debye dielectric | 7. Material models and tensors | PASS | dispersive material | WASM CPML+ADE+TFSF, 24 steps, E=2.89e-4 | debye_relaxation_ade_response:P1/physics | OK |
| 74 | `plasmaCutoff` Plasma cutoff | 7. Material models and tensors | PASS | dispersive material | WASM CPML+ADE+TFSF, 24 steps, E=4.66e-8 | plasma_cutoff_ade_response:P1/physics | OK |
| 75 | `enzSlab` ENZ slab | 7. Material models and tensors | PASS | dispersive material | WASM CPML+ADE+TFSF, 24 steps, E=6.96e-8 | enz_slab_near_zero_response:P1/physics | OK |
| 76 | `anisotropicMedium` Anisotropic medium | 7. Material models and tensors | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=5.90e-7 | anisotropic_tensor_block_response:P1/physics | OK |
| 77 | `hyperbolicMedium` Hyperbolic medium | 7. Material models and tensors | WARN | dispersive material | WASM CPML+ADE, 24 steps, E=3.13e-5 | hyperbolic_indefinite_tensor_proxy:P1/physics | Uses a reduced Drude tensor proxy for a hyperbolic medium; acceptable for visualization, not broadband material evidence. |
| 78 | `chiralMedium` 6-field chiral medium | 7. Material models and tensors | WARN | HZ polarization, bianisotropy | WASM 6-field, 24 steps, E=1.02e-6 | chiral_six_field_bianisotropy_response:P1/physics, bianisotropy_quantitative_gap:P1/physics | Six-field chiral-medium proxy; needs optical-rotation or S-parameter regression before quantitative chirality claims. |
| 79 | `bianisotropicMedium` 6-field bianisotropic medium | 7. Material models and tensors | PASS | HZ polarization, bianisotropy | WASM 6-field, 24 steps, E=8.91e-7 | bianisotropic_six_field_response:P1/physics | OK |
| 80 | `gyrotropicMedium` Gyrotropic medium | 7. Material models and tensors | WARN | HZ polarization, gyrotropy | WASM CPML+tensor+TFSF, 24 steps, E=1.10e-5 | gyrotropic_tensor_response:P1/physics | Gyrotropic-material route is active, but Faraday rotation/nonreciprocal S-parameters are not calibrated here. |
| 81 | `braggStack` 1D Bragg stack | 8. Periodic photonics and BICs | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=8.70e-5 | bragg_stack_periodic_layers:P1/physics | OK |
| 82 | `photonicCrystal` 2D photonic crystal | 8. Periodic photonics and BICs | PASS | blochK sweep | WASM CPML+TFSF, 24 steps, E=8.70e-5 | photonic_crystal_bloch_geometry:P1/physics | OK |
| 83 | `phcPointDefect` PhC point defect | 8. Periodic photonics and BICs | WARN | blochK sweep | WASM CPML, 24 steps, E=3.17e-5 | phc_point_defect_cavity_proxy:P1/physics | Photonic-crystal defect-cavity proxy; no eigenmode frequency or Q convergence is claimed. |
| 84 | `phcWaveguide` PhC line-defect waveguide | 8. Periodic photonics and BICs | PASS | blochK sweep | WASM CPML+TFSF, 24 steps, E=7.01e-9 | phc_waveguide_line_defect:P1/physics | OK |
| 85 | `phcOptimizedCavity` Optimized PhC cavity | 8. Periodic photonics and BICs | WARN | blochK sweep | WASM CPML, 24 steps, E=9.40e-7 | phc_optimized_cavity_proxy:P1/physics | Optimized-cavity geometry proxy; the optimization objective is not independently re-solved in this audit. |
| 86 | `phcDisorder` Disordered photonic crystal | 8. Periodic photonics and BICs | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=8.70e-5 | phc_disorder_lattice_jitter:P1/physics | OK |
| 87 | `phcDarkMode` Symmetry-dark mode | 8. Periodic photonics and BICs | WARN | blochK sweep | WASM CPML, 24 steps, E=1.50e-5 | phc_dark_mode_symmetry_proxy:P1/physics | Symmetry-dark-mode proxy; needs modal-overlap or radiation-suppression validation for quantitative claims. |
| 88 | `quasiBic` Quasi-BIC cavity | 8. Periodic photonics and BICs | PASS | blochK sweep | WASM CPML, 24 steps, E=1.08e-5 | quasi_bic_asymmetry_proxy:P1/physics | OK |
| 89 | `symmetryProtectedBic` Symmetry-protected BIC | 8. Periodic photonics and BICs | WARN | blochK sweep | WASM CPML, 24 steps, E=1.12e-5 | symmetry_protected_bic_proxy:P1/physics | Symmetry-protected BIC proxy; no eigenmode solver or diverging-Q convergence is claimed. |
| 90 | `fanoResonator` Fano side resonator | 8. Periodic photonics and BICs | PASS | static Maxwell/FDTD scene | WASM CPML+mode, 24 steps, E=2.52e-6 | fano_side_resonator_coupling:P1/physics | OK |
| 91 | `sshTrivial` SSH chain, trivial | 9. Topological photonics | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=7.77e-6 | ssh_trivial_bloch_reference:P1/physics | OK |
| 92 | `sshTopological` SSH chain, topological | 9. Topological photonics | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=1.34e-6 | ssh_topological_bloch_reference:P1/physics | OK |
| 93 | `sshInterface` SSH interface | 9. Topological photonics | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=1.33e-6 | ssh_interface_edge_proxy:P1/physics | OK |
| 94 | `sshDisorder` SSH with disorder | 9. Topological photonics | PASS | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=2.72e-7 | ssh_disorder_edge_proxy:P1/physics | OK |
| 95 | `nonHermitianSsh` Non-Hermitian SSH | 9. Topological photonics | WARN | nonlinear material, gain/loss | WASM CPML+gain, 24 steps, E=3.40e-7 | nonhermitian_ssh_gain_loss_proxy:P1/physics | Non-Hermitian SSH route is active, but eigenspectrum and biorthogonal-mode validation are out of scope. |
| 96 | `honeycombLattice` Honeycomb lattice | 9. Topological photonics | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=5.60e-6 | honeycomb_lattice_sublattice_geometry:P1/physics | OK |
| 97 | `valleyHall` Valley Hall interface | 9. Topological photonics | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=1.06e-8 | valley_hall_domain_wall:P1/physics | OK |
| 98 | `valleyHallBend` Valley Hall bend | 9. Topological photonics | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=1.06e-8 | valley_hall_bend_domain_wall:P1/physics | OK |
| 99 | `topologicalPumping` Topological pumping | 9. Topological photonics | WARN | time modulation | WASM CPML+mod, 24 steps, E=1.44e-7 | topological_pumping_modulated_ssh:P1/physics | Qualitative Thouless-pump-like transport proxy; no eigenmode or adiabatic-cycle validation in this pass. |
| 100 | `topologyDefect` Topology with strong defect | 9. Topological photonics | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=1.39e-8 | topology_defect_valley_channel:P1/physics | OK |
| 101 | `sppInterface` SPP metal-dielectric interface | 10. Plasmonics and metamaterials | PASS | HZ polarization, dispersive material | WASM CPML+ADE, 24 steps, E=3.61e-8 | spp_interface_surface_localization:P1/physics | OK |
| 102 | `sppGrating` SPP grating coupler | 10. Plasmonics and metamaterials | WARN | HZ polarization, dispersive material | WASM CPML+ADE+TFSF, 24 steps, E=1.19e-11 | spp_grating_surface_coupling:P1/physics | SPP grating geometry and surface localization are validated; coupling efficiency is not a de-embedded grating-coupler metric. |
| 103 | `localizedPlasmon` Localized plasmon disk | 10. Plasmonics and metamaterials | PASS | dispersive material | WASM CPML+ADE+TFSF, 24 steps, E=3.25e-5 | localized_plasmon_drude_disk:P1/physics | OK |
| 104 | `plasmonicDimer` Plasmonic dimer | 10. Plasmonics and metamaterials | PASS | dispersive material | WASM CPML+ADE+TFSF, 24 steps, E=2.68e-5 | plasmonic_dimer_hot_gap:P1/physics | OK |
| 105 | `metasurfacePhaseBars` Phase-gradient metasurface | 10. Plasmonics and metamaterials | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=6.96e-8 | metasurface_phase_bar_gradient:P1/physics | OK |
| 106 | `perfectAbsorber` Perfect absorber | 10. Plasmonics and metamaterials | PASS | static Maxwell/FDTD scene | WASM CPML+TFSF, 24 steps, E=2.42e-13 | perfect_absorber_lossy_backed_sheet:P1/physics | OK |
| 107 | `negativeIndexSlab` Negative-index slab | 10. Plasmonics and metamaterials | PASS | dispersive material, frequency sweep | WASM CPML+ADE+TFSF, 24 steps, E=6.09e-8 | negative_index_observable_finite:P1/physics, negative_index_quantitative_gap:P1/physics | OK |
| 108 | `superlensSlab` Drude superlens slab | 10. Plasmonics and metamaterials | WARN | dispersive material, frequency sweep | WASM CPML+ADE, 24 steps, E=4.16e-7 | superlens_image_proxy_finite:P1/physics | Drude superlens proxy with reduced transfer observable; not a calibrated evanescent-wave transfer-function measurement. |
| 109 | `hyperlens` Hyperlens | 10. Plasmonics and metamaterials | WARN | HZ polarization, dispersive material, frequency sweep | WASM CPML+ADE, 24 steps, E=1.04e-9 | hyperlens_reduced_mtf_proxy:P1/physics, hyperlens_mtf_quantitative_gap:P1/physics | Scalar 2D Hz hyperlens analogue; useful for teaching transfer trends, not a full cylindrical 3D validation. |
| 110 | `enzEmitter` Dipole near ENZ slab | 10. Plasmonics and metamaterials | PASS | dispersive material | WASM CPML+ADE, 24 steps, E=3.40e-5 | enz_emitter_slab_overlap:P1/physics | OK |
| 111 | `kerrSlab` Kerr nonlinear slab | 11. Nonlinear and active media | PASS | nonlinear material | WASM CPML+Kerr+TFSF, 24 steps, E=1.30e-8 | kerr_slab_nonlinear_overlap:P1/physics | OK |
| 112 | `shgSlab` SHG χ² slab | 11. Nonlinear and active media | PASS | nonlinear material, harmonic conversion, amplitude sweep | WASM CPML+harmonic+TFSF, 24 steps, E=8.91e-9 | shg_slab_harmonic_proxy:P1/physics | OK |
| 113 | `thgSlab` THG χ³ slab | 11. Nonlinear and active media | PASS | nonlinear material, harmonic conversion, amplitude sweep | WASM CPML+harmonic+TFSF, 24 steps, E=1.07e-8 | thg_slab_harmonic_proxy:P1/physics | OK |
| 114 | `spmKerrPulse` Kerr SPM pulse | 11. Nonlinear and active media | WARN | nonlinear material, amplitude sweep | WASM CPML+Kerr+TFSF, 24 steps, E=6.58e-6 | spm_kerr_sideband_proxy:P1/physics, nonlinear_material_first_pass:P1/physics | Kerr SPM proxy; spectral broadening is reduced/qualitative, not a calibrated nonlinear phase-shift curve. |
| 115 | `kerrBistableCavity` Kerr bistable cavity | 11. Nonlinear and active media | WARN | nonlinear material, amplitude sweep | WASM CPML+Kerr+mode, 24 steps, E=8.21e-6 | kerr_bistable_cavity_overlap:P1/physics | Kerr bistability proxy; no hysteresis sweep or steady-state branch extraction is claimed. |
| 116 | `vo2SwitchingSlab` VO₂ switching slab | 11. Nonlinear and active media | PASS | nonlinear material, amplitude sweep | WASM CPML+phase+TFSF, 24 steps, E=8.75e-6 | vo2_switching_phase_proxy:P1/physics | OK |
| 117 | `pcmMemoryCell` PCM memory cell | 11. Nonlinear and active media | PASS | nonlinear material, amplitude sweep | WASM CPML+phase+mode, 24 steps, E=2.96e-6 | pcm_memory_cell_phase_proxy:P1/physics | OK |
| 118 | `saturableAbsorber` Saturable absorber | 11. Nonlinear and active media | WARN | nonlinear material, amplitude sweep | WASM CPML+phase+TFSF, 24 steps, E=7.27e-6 | saturable_absorber_phase_proxy:P1/physics | Saturable-absorber route is active, but the transmission-vs-intensity curve is not calibrated in this audit. |
| 119 | `allOpticalSwitch` All-optical switch | 11. Nonlinear and active media | WARN | nonlinear material, amplitude sweep | WASM CPML+Kerr+phase+mode, 24 steps, E=8.26e-9 | all_optical_switch_active_section:P1/physics | All-optical-switch layout proxy; not a calibrated extinction-ratio or switching-energy result. |
| 120 | `nonlinearLimiter` Nonlinear limiter | 11. Nonlinear and active media | WARN | nonlinear material, amplitude sweep | WASM CPML+phase+TFSF, 24 steps, E=9.75e-6 | nonlinear_limiter_phase_proxy:P1/physics | Nonlinear limiter proxy; needs input-output transfer validation before limiter-threshold claims. |
| 121 | `temporalInterface` Temporal interface | 12. Time-varying and Floquet media | PASS | time modulation | WASM CPML+mod+TFSF, 24 steps, E=4.06e-8 | temporal_interface_uniform_floquet_proxy:P1/physics | OK |
| 122 | `temporalSlab` Temporal slab | 12. Time-varying and Floquet media | PASS | time modulation | WASM CPML+mod+TFSF, 24 steps, E=4.06e-8 | temporal_slab_uniform_floquet_proxy:P1/physics | OK |
| 123 | `temporalModulation` Temporal epsilon modulation | 12. Time-varying and Floquet media | PASS | time modulation | WASM CPML+mod+TFSF, 24 steps, E=3.68e-8 | floquet_power_balance_gap:P1/physics, temporal_modulation_region_floquet_proxy:P1/physics | OK |
| 124 | `temporalCrystal` Temporal crystal | 12. Time-varying and Floquet media | PASS | time modulation | WASM CPML+mod+TFSF, 24 steps, E=3.27e-8 | temporal_crystal_uniform_floquet_proxy:P1/physics | OK |
| 125 | `modulatedGuide` Temporally modulated guide | 12. Time-varying and Floquet media | PASS | time modulation | WASM CPML+mod+mode, 24 steps, E=7.84e-6 | modulated_guide_active_section:P1/physics | OK |
| 126 | `travelingModulation` Traveling epsilon modulation | 12. Time-varying and Floquet media | PASS | time modulation, direction sweep | WASM CPML+mod+TFSF, 24 steps, E=3.71e-9 | traveling_modulation_phase_proxy:P1/physics | OK |
| 127 | `temporalIsolator` Temporal isolator analogue | 12. Time-varying and Floquet media | WARN | time modulation, direction sweep | WASM CPML+mod+mode, 24 steps, E=1.48e-7 | temporal_isolator_traveling_proxy:P1/physics | Temporal-isolator analogue; reduced sideband/isolation observables are not de-embedded two-port S-parameters. |
| 128 | `modulatedRing` Modulated ring | 12. Time-varying and Floquet media | PASS | time modulation | WASM CPML+mod+mode, 24 steps, E=7.49e-6 | modulated_ring_resonator_proxy:P1/physics | OK |
| 129 | `floquetResonators` Floquet resonators | 12. Time-varying and Floquet media | PASS | time modulation | WASM CPML+mod+mode, 24 steps, E=6.79e-6 | floquet_resonators_staggered_phase_proxy:P1/physics | OK |
| 130 | `syntheticFrequency` Synthetic frequency dimension | 12. Time-varying and Floquet media | WARN | time modulation | WASM CPML+mod+mode, 24 steps, E=6.31e-6 | synthetic_frequency_chain_proxy:P1/physics | Synthetic-frequency-dimension proxy; sideband graph intuition is shown without a calibrated frequency-lattice model. |
| 131 | `ptSymmetricCoupler` PT-symmetric gain/loss guides | 13. Coupled and non-Hermitian workflows | PASS | nonlinear material, gain/loss, gainLoss sweep | WASM CPML+gain+TFSF, 24 steps, E=2.09e-5 | pt_symmetric_coupler_modal_proxy:P1/physics | OK |
| 132 | `exceptionalPointCoupler` Exceptional point proxy | 13. Coupled and non-Hermitian workflows | WARN | gain/loss, gainLoss sweep | WASM CPML+gain+TFSF, 24 steps, E=1.72e-5 | exceptional_point_coupler_modal_proxy:P1/physics | Exceptional-point proxy; reduced modal coalescence is checked, not a full eigenvalue/topology validation. |
| 133 | `nonHermitianSkin` Non-Hermitian skin analogue | 13. Coupled and non-Hermitian workflows | WARN | gain/loss | WASM CPML+gain, 24 steps, E=5.46e-8 | non_hermitian_skin_edge_proxy:P1/physics, coupled_workflow_first_pass:P1/physics | Reduced active/lossy lattice analogue; not a non-Bloch eigenmode validation. |
| 134 | `bicKerr` BIC + Kerr | 13. Coupled and non-Hermitian workflows | PASS | nonlinear material, blochK sweep | WASM CPML+Kerr, 24 steps, E=3.18e-6 | bic_kerr_active_phc_proxy:P1/physics | OK |
| 135 | `bicEnz` BIC + ENZ | 13. Coupled and non-Hermitian workflows | PASS | dispersive material, blochK sweep | WASM CPML+ADE, 24 steps, E=6.79e-6 | bic_enz_dispersive_phc_proxy:P1/physics | OK |
| 136 | `janusTopologicalGuide` Janus + topological guide | 13. Coupled and non-Hermitian workflows | WARN | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=9.93e-7 | janus_topological_guide_source_proxy:P1/physics | Hybrid Janus/topological-guide proxy; directional coupling is qualitative without protected-transport spectra. |
| 137 | `huygensCavity` Huygens + cavity | 13. Coupled and non-Hermitian workflows | WARN | static Maxwell/FDTD scene | WASM CPML, 24 steps, E=3.32e-7 | huygens_cavity_source_proxy:P1/physics | Hybrid Huygens/cavity source workflow; not a calibrated Purcell, beta-factor, or far-field optimization. |
| 138 | `topologyTemporalMod` Topology + temporal modulation | 13. Coupled and non-Hermitian workflows | PASS | time modulation, direction sweep | WASM CPML+mod+TFSF, 24 steps, E=3.07e-14 | topology_temporal_mod_coupled_proxy:P1/physics | OK |
| 139 | `nonreciprocalValleyHall` Nonreciprocity + Valley Hall | 13. Coupled and non-Hermitian workflows | WARN | time modulation, direction sweep | WASM CPML+mod+TFSF, 24 steps, E=2.63e-14 | nonreciprocal_valley_hall_traveling_proxy:P1/physics | Nonreciprocal Valley-Hall proxy; needs reverse-port spectra and topological invariant checks for quantitative claims. |
| 140 | `spaceTimeCrystal` Space-time crystal | 13. Coupled and non-Hermitian workflows | WARN | time modulation, direction sweep | WASM CPML+mod+TFSF, 24 steps, E=3.32e-8 | space_time_crystal_traveling_proxy:P1/physics | Space-time-crystal proxy; modulation and sidebands are reduced observables, not a full band-structure validation. |

## Interpretation

- This audit checks whether each example is educationally coherent and runnable, not whether it is publication-grade.
- `VALIDATION_GAP` marks a scene that still needs an executable targeted metric before stronger claims are made.
- Use `scripts/audit-scene-contracts.mjs --write` to regenerate this report after preset changes.

