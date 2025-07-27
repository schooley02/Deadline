# Deadline App - Source Material Catalogue

## Overview
This catalogue contains all relevant source artifacts for the Deadline productivity gaming application. Each file has been copied to the shared workspace with stable URIs that downstream agents can reference unambiguously.

## Project Specification
- **File**: `01_PROJECT_SPEC.md`
- **Original Path**: `C:\Users\jscho\Deadline\PROJECT_SPEC.md`
- **URI**: `file://C:/Users/jscho/Deadline/shared_workspace/01_PROJECT_SPEC.md`
- **Description**: Complete project specification including elevator pitch, features, user stories, technical requirements, and implementation details

## Main Application Files

### HTML Files
- **File**: `02_main_index.html`
- **Original Path**: `C:\Users\jscho\Deadline\index.html`
- **URI**: `file://C:/Users/jscho/Deadline/shared_workspace/02_main_index.html`
- **Description**: Main application HTML file

### JavaScript Files
- **File**: `03_main_script.js`
- **Original Path**: `C:\Users\jscho\Deadline\script.js`
- **URI**: `file://C:/Users/jscho/Deadline/shared_workspace/03_main_script.js`
- **Description**: Main application JavaScript logic

### CSS Files
- **File**: `04_main_style.css`
- **Original Path**: `C:\Users\jscho\Deadline\style.css`
- **URI**: `file://C:/Users/jscho/Deadline/shared_workspace/04_main_style.css`
- **Description**: Main application styling

## Deadline-MPE (Minimum Playable Experience) Files

### HTML Files
- **File**: `05_MPE_index.html`
- **Original Path**: `C:\Users\jscho\Deadline\Deadline-MPE\index.html`
- **URI**: `file://C:/Users/jscho/Deadline/shared_workspace/05_MPE_index.html`
- **Description**: MPE version HTML file

### JavaScript Files
- **File**: `06_MPE_script.js`
- **Original Path**: `C:\Users\jscho\Deadline\Deadline-MPE\script.js`
- **URI**: `file://C:/Users/jscho/Deadline/shared_workspace/06_MPE_script.js`
- **Description**: Primary MPE JavaScript logic

- **File**: `07_MPE_script2.js`
- **Original Path**: `C:\Users\jscho\Deadline\Deadline-MPE\script2.js`
- **URI**: `file://C:/Users/jscho/Deadline/shared_workspace/07_MPE_script2.js`
- **Description**: Additional MPE JavaScript functionality

### CSS Files
- **File**: `08_MPE_style.css`
- **Original Path**: `C:\Users\jscho\Deadline\Deadline-MPE\style.css`
- **URI**: `file://C:/Users/jscho/Deadline/shared_workspace/08_MPE_style.css`
- **Description**: MPE version styling

## File Structure Summary

```
shared_workspace/
├── 00_SOURCE_CATALOGUE.md      # This catalogue file
├── 01_PROJECT_SPEC.md          # Project specification
├── 02_main_index.html          # Main app HTML
├── 03_main_script.js           # Main app JavaScript
├── 04_main_style.css           # Main app CSS
├── 05_MPE_index.html           # MPE HTML
├── 06_MPE_script.js            # MPE JavaScript (primary)
├── 07_MPE_script2.js           # MPE JavaScript (additional)
└── 08_MPE_style.css            # MPE CSS
```

## Usage for Downstream Agents

Downstream agents should reference files using their stable URIs in the format:
`file://C:/Users/jscho/Deadline/shared_workspace/[FILENAME]`

For example:
- Project specification: `file://C:/Users/jscho/Deadline/shared_workspace/01_PROJECT_SPEC.md`
- MPE implementation: `file://C:/Users/jscho/Deadline/shared_workspace/05_MPE_index.html`

## Notes
- All files have been copied with their complete contents preserved
- Numbering scheme (01-08) provides logical ordering for reference
- Original paths are documented for traceability
- Both main application files and MPE implementation files are included
- This catalogue serves as the single source of truth for all source material locations

## Verification
Created on: $(Get-Date)
Total files catalogued: 8 source files + 1 catalogue
Workspace location: C:\Users\jscho\Deadline\shared_workspace\
