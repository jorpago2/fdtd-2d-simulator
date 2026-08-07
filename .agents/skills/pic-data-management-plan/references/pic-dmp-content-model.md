# PIC DMP Content Model

## Output Standard

The plan must read like an institutional operating procedure for a research group, not a form. Use prose for policy and rationale, tables for records and responsibilities, and diagrams for data flow and traceability.

## Integrated Photonics Data Classes

### Publications

Manage:

- manuscripts, preprints, accepted versions, supplementary information
- figure source data
- figure-generation scripts
- data availability statements
- public dataset releases and DOIs
- code releases and software environment files

Minimum metadata:

- publication short ID
- title, authors, ORCID, corresponding author
- project/funder reference
- linked design IDs, sample IDs, measurement IDs, simulation IDs
- repository URL, DOI, access class, license
- manuscript version: submitted, revised, accepted, published
- figure-to-data mapping

Method:

1. Create `08_publications/paper_<short_id>/` when manuscript drafting starts.
2. Store each figure in `figures/fig_<n>/` with source data, script/notebook, exported figure, and README.
3. Freeze a release candidate before submission and again after acceptance.
4. Deposit public data and code only after IP/PDK/NDA review.

### Design and Simulations

Manage:

- specifications, design notebooks, layouts, GDS/OASIS, netlists
- PDK-dependent files and restricted cells
- solver files, parameter sweeps, modes, fields, S-parameters
- scripts, mesh settings, material models, solver versions
- compact models and system-level simulations

Minimum metadata:

- design ID, component/circuit type, variant, version
- simulation ID, solver, software version, commit, date
- material model, wavelength range, polarization, temperature
- geometry parameters, mesh/domain/boundary conditions
- parameter sweep ranges and convergence criteria
- relation to fabrication run or publication figure

Method:

1. Treat design notes, scripts, parameter files, and exported metrics as version-controlled text.
2. Keep proprietary PDK files in a restricted folder excluded from public release.
3. Store raw solver outputs separately from processed/exported metrics.
4. Record convergence or validation evidence for any simulation supporting a claim.
5. Export publication-supporting data in open formats when possible.

### Fabricated Samples

Manage:

- mask version, fabrication run, wafer, die, chip, device
- process recipes and deviations
- inspection data: optical microscopy, SEM, AFM, profilometry, ellipsometry
- packaging, wire bonding, fiber array alignment, PCB, storage location
- sample transfers, damage, disposal, loan, or shipment

Minimum metadata:

- sample ID, wafer ID, die ID, chip ID, device ID
- project, design ID, GDS version, fabrication run
- foundry/sala limpia, process stack, date, responsible person
- storage location, physical status, access restrictions
- inspection files and quality status

Method:

1. Assign IDs before characterization.
2. Maintain `sample_inventory.csv` or ELN-backed sample registry.
3. Link each physical sample to design, fabrication run, measurements, and publications.
4. Never rely only on handwritten labels.
5. Record damaged or excluded samples rather than deleting them from the record.

### Characterization Results

Manage:

- raw spectra, time traces, IV curves, RF/S-parameter data
- optical/electro-optical/RF/thermal setups
- calibration, references, dark/background, through/reference traces
- processed data, fitting parameters, uncertainty, outlier/exclusion rules
- scripts and notebooks that generate metrics and figures

Minimum metadata:

- measurement ID
- sample ID, device ID, operator, date
- setup ID, instrument model/configuration, calibration status
- wavelength/frequency range, polarization, temperature, optical power, bias, modulation settings
- raw file path, processed file path, script commit, analysis version
- extracted metrics and uncertainty

Method:

1. Raw data are immutable.
2. Processed data are versioned.
3. Every campaign has a setup README.
4. Every publication figure links to raw data, processed data, and script.
5. Calibration data are stored with the measurement campaign, not only in instrument software.

## Recommended Architecture

Minimum viable architecture:

- Git/GitLab repository for PGD, scripts, README files, metadata templates, analysis notebooks, and publication packaging.
- Lab/NAS storage for raw simulations, raw characterization, inspection images, and internal restricted data.
- ELN for daily records, fabrication notes, measurement campaign logs, sample status, decisions, and deviations.
- Zenodo or institutional repository for public releases.

Better architecture when the group can support it:

- DVC or git-annex for large data pointers and versioning.
- Automated metadata templates checked by scripts.
- Sample registry with barcode/QR labels.
- DOI release checklist integrated with publication workflow.

## Access Classes

Use these classes:

- OPEN: public dataset/code/documentation, normally with DOI and license.
- INTERNAL: accessible to the group and collaborators under normal project governance.
- EMBARGOED: temporarily closed until publication, patent filing, deliverable review, or contract date.
- RESTRICTED: limited by PDK, foundry, NDA, collaboration agreement, personal data, or security.
- CONFIDENTIAL-IP: patentable design, process know-how, exploitation-sensitive result.

Every dataset must have one class and one review date.

## Naming Patterns

Use stable, readable IDs:

- Project: `PID2026_SHORTNAME`
- Design: `DES_<project>_<component>_<variant>_vNN`
- Simulation: `SIM_<design>_<solver>_<yyyymmdd>_vNN`
- Fabrication run: `RUN_<provider>_<yyyymm>_<short>`
- Sample: `SMP_<run>_W<wafer>_D<die>_C<chip>_DEV<device>`
- Measurement: `MEA_<sample>_<method>_<yyyymmdd>_<seq>`
- Analysis: `ANA_<measurement-or-dataset>_<yyyymmdd>_vNN`
- Publication: `PUB_<firstauthor>_<journal-or-conf>_<yyyy>_<short>`

## Required Diagrams

### Lifecycle

```text
Scientific question
  -> Design requirements
  -> Simulation/model
  -> Layout/GDS
  -> Fabrication run
  -> Sample inventory
  -> Characterization campaign
  -> Analysis and figures
  -> Publication package
  -> Repository release and archive
```

### Storage Architecture

```text
Workstations/instruments
  -> raw drop zone on lab server/NAS
  -> curated project folder
  -> Git/GitLab for code and metadata
  -> DVC/git-annex pointers for large data
  -> ELN sample and campaign records
  -> Zenodo/institutional repository for public release
```

### Traceability

```text
Figure panel
  <- analysis script/notebook
  <- processed dataset
  <- raw measurement
  <- measurement setup + calibration
  <- sample ID
  <- fabrication run
  <- design/layout version
  <- simulation/specification
```

## Tool Decision Table

| Need | Minimum viable | Stronger option |
|---|---|---|
| Code/versioning | Git/GitLab | GitLab CI checks for metadata |
| Large data | NAS + checksums | DVC or git-annex |
| Lab record | structured Markdown/Word logs | eLabFTW or LabArchives |
| Sample inventory | CSV/XLSX with fixed schema | ELN/LIMS with QR labels |
| Layout | KLayout + GDS/OASIS | PDK-integrated flow with restricted vault |
| Simulation | Lumerical/COMSOL/Python exports | scripted parameter sweeps + provenance |
| Data analysis | Python/Jupyter/MATLAB | environment files + reproducible pipelines |
| Publication release | Zenodo/institutional repository | DOI, DataCite metadata, code release |

## Document Quality Checks

Fail the document if:

- it is mostly questions or checklist rows
- it lacks folder/repository architecture
- it lacks diagrams
- it does not name tools
- it does not define ID conventions
- it does not separate raw/processed/publication data
- it does not discuss PDK/NDA/IP restrictions
- publication figures cannot be traced back to raw data and scripts
- samples are not connected to fabrication and measurements
