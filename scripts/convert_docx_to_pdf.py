#!/usr/bin/env python3
"""
Batch convert all .docx files in a folder to PDF using docx2pdf.

Usage:
    python convert_docx_to_pdf.py <input_folder> [output_folder]

If output_folder is omitted, PDFs are placed alongside the originals.

Requirements:
    pip install docx2pdf
    On macOS: Microsoft Word must be installed.
    On Windows: Microsoft Word or LibreOffice must be installed.
    On Linux: LibreOffice is used (install with: sudo apt install libreoffice).
"""

import sys
import os
from pathlib import Path

try:
    from docx2pdf import convert
except ImportError:
    print("Error: docx2pdf not installed. Run: pip install docx2pdf")
    sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    input_dir = Path(sys.argv[1]).expanduser().resolve()
    if not input_dir.is_dir():
        print(f"Error: '{input_dir}' is not a directory.")
        sys.exit(1)

    output_dir = Path(sys.argv[2]).expanduser().resolve() if len(sys.argv) >= 3 else None
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)

    docx_files = sorted(input_dir.rglob("*.docx"))
    if not docx_files:
        print(f"No .docx files found in {input_dir}")
        sys.exit(0)

    print(f"Converting {len(docx_files)} file(s)...")
    ok = 0
    errors = []

    for docx_path in docx_files:
        try:
            if output_dir:
                # Mirror sub-folder structure relative to input_dir
                rel = docx_path.relative_to(input_dir)
                pdf_path = (output_dir / rel).with_suffix(".pdf")
                pdf_path.parent.mkdir(parents=True, exist_ok=True)
                convert(str(docx_path), str(pdf_path))
            else:
                convert(str(docx_path))
            print(f"  ✓ {docx_path.name}")
            ok += 1
        except Exception as e:
            print(f"  ✗ {docx_path.name}: {e}")
            errors.append(docx_path.name)

    print(f"\nDone: {ok} converted, {len(errors)} failed.")
    if errors:
        print("Failed files:")
        for name in errors:
            print(f"  - {name}")


if __name__ == "__main__":
    main()
