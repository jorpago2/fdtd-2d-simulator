---
name: pic-data-management-plan
description: Create, audit, or revise operational Data Management Plans for integrated photonics research groups and PIC projects. Use for PGD/DMP documents involving photonic integrated circuits, design, simulation, fabrication, physical samples, optical/electro-optical characterization, publications, FAIR data, repositories, PDK/NDA/IP restrictions, lab notebooks, sample inventories, folder structures, metadata schemas, diagrams, tools, and methodology. Trigger when the user asks for a plan, not just a checklist, for research data management in photonics or experimental engineering.
---

# PIC Data Management Plan

## Core Rule

Produce an operational plan, not a questionnaire. A valid output must tell the group how data will be organized, named, stored, versioned, reviewed, protected, preserved, and published.

Never stop at a checklist. Include narrative policy, concrete workflows, folder/repository structure, tools, methodology, diagrams, roles, and minimum metadata.

## Required Workflow

1. Identify the research context: group, project, funder, data classes, restrictions, and publication needs.
2. Build the data lifecycle from idea to publication:
   `requirements -> design -> simulation -> layout -> fabrication -> sample inventory -> characterization -> analysis -> publication -> archive`.
3. Define the organizational model:
   storage tiers, repositories, folder tree, IDs, versioning rules, access classes, and responsibilities.
4. Specify tools and why they are used. Prefer practical academic tools:
   Git/GitLab, DVC or git-annex for large data, eLabFTW or LabArchives for ELN, KLayout, Lumerical/Ansys, COMSOL, Python/Jupyter, MATLAB, HDF5/CSV/JSON/Touchstone, Zenodo, institutional repository, ORCID, DOI/DataCite.
5. Define four dedicated data-management sections:
   publications, design/simulations, fabricated samples, characterization results.
6. Add diagrams. Use simple text diagrams if generating a DOCX directly; use real vector/raster diagrams when available.
7. Add FAIR and compliance sections only after the operational model exists.
8. Validate that every dataset can be traced to:
   responsible person, project, sample/design ID, raw data, processed data, code, figure/publication, access class, retention rule.

## Mandatory Document Structure

Use this structure unless the user explicitly asks otherwise:

1. Executive summary and scope
2. Data governance model
3. Data lifecycle and diagrams
4. Data organization and storage architecture
5. Tools and platforms
6. Methodology and SOPs
7. Data management for publications
8. Data management for design and simulations
9. Data management for fabricated samples
10. Data management for characterization results
11. Metadata model and naming conventions
12. FAIR implementation
13. Access, security, IP, PDK, NDA, and embargo policy
14. Preservation, publication, retention, and disposal
15. Implementation roadmap
16. Appendices: folder tree, templates, dataset record, sample record, measurement record, publication record

## Required Diagrams

Include at least these diagrams:

- Lifecycle diagram: design to publication.
- Repository/storage architecture: local workstations, lab server/NAS, Git, large-data store, ELN, public repository.
- Traceability diagram: publication figure back to sample, measurement, script, simulation, and design.
- Access-class diagram or table: open, internal, restricted, embargoed, confidential/IP.

Text diagrams are acceptable:

```text
Design requirements
  -> Simulation model
  -> Layout/GDS
  -> Fabrication run
  -> Sample ID
  -> Measurement campaign
  -> Analysis script
  -> Figure/table
  -> Publication dataset + DOI
```

## Organization Model

Always define:

- Project ID: stable identifier for project or funding action.
- Design ID: stable identifier for component/circuit/layout variant.
- Simulation ID: solver, version, parameter set, date, commit.
- Run ID: fabrication run, foundry/sala limpia, wafer, process stack.
- Sample ID: wafer/die/chip/device.
- Measurement ID: sample, setup, operator, instrument configuration, date.
- Analysis ID: script/notebook, commit, environment, input dataset.
- Publication ID: manuscript, figure, dataset DOI, code release.

Recommended folder tree:

```text
PID_<project>/
  00_admin_pgd/
  01_requirements/
  02_design/
    design_<design_id>/
      gds/
      klayout/
      pdk_restricted/
      design_notes/
  03_simulation/
    sim_<simulation_id>/
      input/
      raw/
      processed/
      notebooks/
      reports/
  04_fabrication/
    run_<run_id>/
      masks/
      process_docs/
      inspection/
      restricted/
  05_samples/
    sample_inventory.csv
    wafer_<wafer_id>/
  06_characterization/
    meas_<measurement_id>/
      raw/
      processed/
      calibration/
      setup/
      notebooks/
  07_analysis/
  08_publications/
    paper_<short_id>/
      manuscript/
      figures/
      data_release/
      code_release/
  09_archive/
```

## Tools Guidance

Recommend tools by role, not as decoration:

- Version control: Git/GitLab for code, scripts, text metadata, design notes, PGD, README, analysis notebooks.
- Large data versioning: DVC or git-annex when raw measurement/simulation files are too large for Git.
- ELN: eLabFTW or LabArchives for experiment records, fabrication notes, measurement campaigns, decisions, and audit trail.
- Layout/design: KLayout for GDS/OASIS inspection and DRC-adjacent documentation; PDK files remain restricted.
- Simulation: Lumerical/Ansys, COMSOL, Meep, tidy3d, MPB, or in-house code, depending on project reality.
- Analysis: Python/Jupyter, MATLAB, pandas, NumPy, SciPy, xarray/h5py, matplotlib, lmfit.
- Data formats: CSV/TSV for simple tables, HDF5 for multidimensional data, JSON/YAML for metadata, Touchstone for S-parameters, GDS/OASIS for layouts, TIFF/PNG/SVG/PDF for figures.
- Repositories: institutional repository/RIUNET if appropriate, Zenodo for public datasets and code releases, GitHub/GitLab plus Zenodo DOI for software snapshots.
- Identifiers: ORCID for people, DOI/DataCite for datasets, ROR for organizations where repository metadata supports it.

Do not present tools as mandatory if the group lacks them. Mark them as "recommended", "minimum viable", or "optional upgrade".

## Methodology Requirements

For every major data class, specify:

- creation/capture method
- raw data location
- processed data location
- metadata fields
- quality control
- responsible role
- access class
- versioning method
- preservation target
- publication route

Include a minimum viable SOP:

1. Create project folder and IDs before data generation.
2. Register design/simulation/sample/measurement in the corresponding inventory.
3. Store raw data as immutable.
4. Store processing scripts under version control.
5. Export processed/publication data in open formats.
6. Link figures to scripts and input datasets.
7. Review IP/PDK/NDA restrictions before public release.
8. Deposit final public package and record DOI.

## References

Read `references/pic-dmp-content-model.md` when drafting or revising a full document.
