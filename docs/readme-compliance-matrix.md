# README Compliance Matrix

This document tracks compliance of all README files against the requirements specified in `docs/product.md`.

## Required Sections (from product.md)

1. **Overview Section**: What it does, how it differs, key concepts, unique concepts subsection, how unique concepts work
2. **Configuration Section**: All parameters explained, example configs, guidance on values
3. **Setup Instructions**: Prerequisites, step-by-step setup, sample data preparation
4. **Usage Instructions**: How to run scripts, what happens, examples, validation scenario
5. **Expected Outcomes**: What to expect, how to verify, example queries
6. **Understanding the Code**: Key components, algorithm overview, Mermaid diagrams (if unique process)
7. **Troubleshooting**: Common errors, debugging, tips

### Additional Requirements
- Runtime Data Storage: Explanation of `.tmp/` directory
- Mermaid diagrams: Required for projects with unique processing steps

## Compliance Status

| Project | Overview | Config | Setup | Usage | Expected | Code | Troubleshooting | .tmp/ | Diagrams | Notes |
|---------|----------|--------|-------|-------|----------|------|-----------------|-------|----------|-------|
| **basic-rag** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | N/A (baseline) | Complete, excellent example |
| **csv-rag** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ | ✓ | Missing .tmp/ explanation |
| **reliable-rag** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ | ✓ | Missing .tmp/ explanation |
| **chunk-optimizer** | ⚠ | ✓ | ⚠ | ⚠ | ⚠ | ⚠ | ✗ | ⚠ | N/A | Missing unique concepts subsection, incomplete sections |
| **proposition-chunking** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ | ✓ | Missing .tmp/ explanation |
| **query-transform** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Complete |
| **hyde** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Complete |
| **hype** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Complete |
| **chunk-headers** | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓ | ✗ | Very minimal, needs major work |
| **relevant-segments** | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓ | ✗ | Very minimal, needs major work |
| **context-window** | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓ | ✗ | Very minimal, needs major work |
| **semantic-chunking** | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓ | ✗ | Very minimal, needs major work |
| **contextual-compression** | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓ | ✗ | Very minimal, needs major work |
| **document-augmentation** | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ✓ | ✗ | Very minimal, needs major work |

## Legend
- ✓ = Complete and compliant
- ⚠ = Present but incomplete or missing required subsections
- ✗ = Missing entirely
- N/A = Not applicable (e.g., baseline project doesn't need unique diagrams)

## Detailed Gap Analysis

### High Priority (3+ missing sections)

#### chunk-headers
- **Overview**: Missing "What makes this project unique" subsection, missing "How unique concepts work and can be adjusted"
- **Configuration**: Present but minimal, needs detailed parameter explanations
- **Setup**: Minimal, needs step-by-step instructions
- **Usage**: Missing detailed step-by-step explanation, validation scenario is minimal
- **Expected Outcomes**: Minimal, needs more detail
- **Understanding the Code**: Minimal, needs algorithm overview
- **Troubleshooting**: Minimal, needs more common errors
- **Diagrams**: Missing Mermaid diagrams (required for unique process)

#### contextual-compression
- **Overview**: Missing "What makes this project unique" subsection, missing "How unique concepts work and can be adjusted"
- **Configuration**: Present but minimal, needs detailed parameter explanations
- **Setup**: Minimal, needs step-by-step instructions
- **Usage**: Missing detailed step-by-step explanation, validation scenario is minimal
- **Expected Outcomes**: Minimal, needs more detail
- **Understanding the Code**: Minimal, needs algorithm overview
- **Troubleshooting**: Minimal, needs more common errors
- **Diagrams**: Missing Mermaid diagrams (required for unique process)

#### relevant-segments
- **Overview**: Missing "What makes this project unique" subsection, missing "How unique concepts work and can be adjusted"
- **Configuration**: Present but minimal, needs detailed parameter explanations
- **Setup**: Minimal, needs step-by-step instructions
- **Usage**: Missing detailed step-by-step explanation, validation scenario is minimal
- **Expected Outcomes**: Minimal, needs more detail
- **Understanding the Code**: Minimal, needs algorithm overview
- **Troubleshooting**: Minimal, needs more common errors
- **Diagrams**: Missing Mermaid diagrams (required for unique process)

#### context-window
- **Overview**: Missing "What makes this project unique" subsection, missing "How unique concepts work and can be adjusted"
- **Configuration**: Present but minimal, needs detailed parameter explanations
- **Setup**: Minimal, needs step-by-step instructions
- **Usage**: Missing detailed step-by-step explanation, validation scenario is minimal
- **Expected Outcomes**: Minimal, needs more detail
- **Understanding the Code**: Minimal, needs algorithm overview
- **Troubleshooting**: Minimal, needs more common errors
- **Diagrams**: Missing Mermaid diagrams (required for unique process)

#### semantic-chunking
- **Overview**: Missing "What makes this project unique" subsection, missing "How unique concepts work and can be adjusted"
- **Configuration**: Present but minimal, needs detailed parameter explanations
- **Setup**: Minimal, needs step-by-step instructions
- **Usage**: Missing detailed step-by-step explanation, validation scenario is minimal
- **Expected Outcomes**: Minimal, needs more detail
- **Understanding the Code**: Minimal, needs algorithm overview
- **Troubleshooting**: Minimal, needs more common errors
- **Diagrams**: Missing Mermaid diagrams (required for unique process)

#### document-augmentation
- **Overview**: Missing "What makes this project unique" subsection, missing "How unique concepts work and can be adjusted"
- **Configuration**: Present but minimal, needs detailed parameter explanations
- **Setup**: Minimal, needs step-by-step instructions
- **Usage**: Missing detailed step-by-step explanation, validation scenario is minimal
- **Expected Outcomes**: Minimal, needs more detail
- **Understanding the Code**: Minimal, needs algorithm overview
- **Troubleshooting**: Minimal, needs more common errors
- **Diagrams**: Missing Mermaid diagrams (required for unique process)

### Medium Priority (1-2 missing sections)

#### chunk-optimizer
- **Overview**: Missing "What makes this project unique" subsection, missing "How unique concepts work and can be adjusted"
- **Usage**: Has validation scenario but could be more detailed
- **Expected Outcomes**: Present but could be more comprehensive
- **Understanding the Code**: Present but minimal
- **Troubleshooting**: Missing entirely

### Low Priority (minor improvements)

#### csv-rag
- **Runtime Data Storage**: Missing explicit .tmp/ explanation section

#### reliable-rag
- **Runtime Data Storage**: Missing explicit .tmp/ explanation section

#### proposition-chunking
- **Runtime Data Storage**: Missing explicit .tmp/ explanation section

## Summary

- **Complete (5 projects)**: basic-rag, query-transform, hyde, hype
- **Needs minor fixes (3 projects)**: csv-rag, reliable-rag, proposition-chunking (add .tmp/ explanation)
- **Needs moderate work (1 project)**: chunk-optimizer (add unique concepts, troubleshooting)
- **Needs major work (6 projects)**: chunk-headers, contextual-compression, relevant-segments, context-window, semantic-chunking, document-augmentation

## Next Steps

1. Update minimal READMEs first (6 Phase 3 projects)
2. Enhance chunk-optimizer
3. Add .tmp/ explanations to csv-rag, reliable-rag, proposition-chunking
4. Verify main README compliance
