#!/usr/bin/env python3
"""
Combine Python and TypeScript/JavaScript coverage reports into a unified HTML report.
This script merges coverage data from both test suites and generates a combined report.
"""

import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Tuple


def parse_python_coverage_xml(xml_path: str) -> Dict[str, Dict]:
    """Parse Python coverage.xml and extract file coverage data."""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    coverage_data = {}

    # Process each source file
    for package in root.findall('.//package'):
        for cls in package.findall('.//class'):
            filename = cls.get('filename')
            if not filename:
                continue

            # Get lines data for this file
            lines_element = cls.find('lines')

            if lines_element is not None:
                lines_hit = 0
                lines_count = 0

                for line in lines_element.findall('line'):
                    lines_count += 1
                    if int(line.get('hits', '0')) > 0:
                        lines_hit += 1

                if lines_count > 0:
                    # Clean up the filename path
                    if filename.startswith('/'):
                        filename = 'src/' + filename.split('/src/')[-1] if '/src/' in filename else filename

                    coverage_data[filename] = {
                        'lines_covered': lines_hit,
                        'lines_total': lines_count,
                        'coverage': (lines_hit / lines_count) * 100
                    }

    return coverage_data


def parse_jest_lcov(lcov_path: str) -> Dict[str, Dict]:
    """Parse Jest's lcov.info and extract file coverage data."""
    coverage_data = {}
    current_file = None
    lines_hit = set()
    lines_total = set()

    with open(lcov_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('SF:'):
                current_file = line[3:]
                # Convert to relative path
                if '/web-admin/' in current_file:
                    current_file = 'web-admin/' + current_file.split('/web-admin/')[-1]
                lines_hit = set()
                lines_total = set()
            elif line.startswith('DA:'):
                parts = line[3:].split(',')
                line_num = int(parts[0])
                hits = int(parts[1])
                lines_total.add(line_num)
                if hits > 0:
                    lines_hit.add(line_num)
            elif line == 'end_of_record' and current_file:
                if lines_total:
                    coverage_data[current_file] = {
                        'lines_covered': len(lines_hit),
                        'lines_total': len(lines_total),
                        'coverage': (len(lines_hit) / len(lines_total)) * 100 if lines_total else 0
                    }

    return coverage_data


def generate_combined_html_report(python_coverage: Dict, jest_coverage: Dict, output_path: str):
    """Generate a combined HTML coverage report."""
    html_template = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Combined Coverage Report - WNBA LED Scoreboard</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 30px;
        }}
        h1 {{
            color: #333;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
        }}
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }}
        .metric {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
        }}
        .metric-value {{
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }}
        .metric-label {{
            color: #666;
            font-size: 14px;
        }}
        .good {{ color: #28a745; }}
        .medium {{ color: #ffc107; }}
        .poor {{ color: #dc3545; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
        }}
        th {{
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #dee2e6;
        }}
        td {{
            padding: 10px 12px;
            border-bottom: 1px solid #e9ecef;
        }}
        tr:hover {{
            background: #f8f9fa;
        }}
        .coverage-bar {{
            background: #e9ecef;
            height: 20px;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
        }}
        .coverage-fill {{
            height: 100%;
            background: linear-gradient(90deg, #28a745, #20c997);
            transition: width 0.3s;
        }}
        .coverage-text {{
            position: absolute;
            width: 100%;
            text-align: center;
            line-height: 20px;
            font-size: 12px;
            font-weight: 600;
            color: #333;
        }}
        .section-header {{
            background: #f8f9fa;
            padding: 8px 12px;
            font-weight: 600;
            color: #495057;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Combined Coverage Report</h1>
        <div class="summary">
            <div class="metric">
                <div class="metric-label">Overall Coverage</div>
                <div class="metric-value {overall_class}">{overall_coverage:.1f}%</div>
            </div>
            <div class="metric">
                <div class="metric-label">Python Coverage</div>
                <div class="metric-value {python_class}">{python_coverage:.1f}%</div>
            </div>
            <div class="metric">
                <div class="metric-label">TypeScript Coverage</div>
                <div class="metric-value {ts_class}">{ts_coverage:.1f}%</div>
            </div>
            <div class="metric">
                <div class="metric-label">Total Files</div>
                <div class="metric-value">{total_files}</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>File</th>
                    <th>Lines</th>
                    <th>Coverage</th>
                    <th style="width: 200px">Progress</th>
                </tr>
            </thead>
            <tbody>
                {python_rows}
                {ts_rows}
            </tbody>
        </table>
    </div>
</body>
</html>
    """

    def get_coverage_class(coverage: float) -> str:
        if coverage >= 80:
            return 'good'
        elif coverage >= 60:
            return 'medium'
        return 'poor'

    def format_file_row(filepath: str, data: Dict) -> str:
        coverage_class = get_coverage_class(data['coverage'])
        coverage_pct = data['coverage']
        return f"""
        <tr>
            <td>{filepath}</td>
            <td>{data['lines_covered']}/{data['lines_total']}</td>
            <td class="{coverage_class}">{coverage_pct:.1f}%</td>
            <td>
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: {coverage_pct}%"></div>
                    <div class="coverage-text">{coverage_pct:.1f}%</div>
                </div>
            </td>
        </tr>
        """

    # Calculate totals
    python_total_lines = sum(d['lines_total'] for d in python_coverage.values())
    python_covered_lines = sum(d['lines_covered'] for d in python_coverage.values())
    python_pct = (python_covered_lines / python_total_lines * 100) if python_total_lines else 0

    ts_total_lines = sum(d['lines_total'] for d in jest_coverage.values())
    ts_covered_lines = sum(d['lines_covered'] for d in jest_coverage.values())
    ts_pct = (ts_covered_lines / ts_total_lines * 100) if ts_total_lines else 0

    overall_total = python_total_lines + ts_total_lines
    overall_covered = python_covered_lines + ts_covered_lines
    overall_pct = (overall_covered / overall_total * 100) if overall_total else 0

    # Generate rows
    python_rows = ['<tr class="section-header"><td colspan="4">Python Files</td></tr>']
    python_rows.extend([format_file_row(f, d) for f, d in sorted(python_coverage.items())])

    ts_rows = ['<tr class="section-header"><td colspan="4">TypeScript/JavaScript Files</td></tr>']
    ts_rows.extend([format_file_row(f, d) for f, d in sorted(jest_coverage.items())])

    # Fill template
    html = html_template.format(
        overall_coverage=overall_pct,
        overall_class=get_coverage_class(overall_pct),
        python_coverage=python_pct,
        python_class=get_coverage_class(python_pct),
        ts_coverage=ts_pct,
        ts_class=get_coverage_class(ts_pct),
        total_files=len(python_coverage) + len(jest_coverage),
        python_rows='\n'.join(python_rows),
        ts_rows='\n'.join(ts_rows)
    )

    with open(output_path, 'w') as f:
        f.write(html)

    return overall_pct, python_pct, ts_pct


def main():
    """Main function to combine coverage reports."""
    root_dir = Path(__file__).parent.parent

    # Generate Python coverage
    print("📊 Generating Python coverage...")
    subprocess.run([
        sys.executable, '-m', 'coverage', 'run',
        '-m', 'unittest', 'discover', 'tests', '-q'
    ], cwd=root_dir, capture_output=True)

    subprocess.run([
        sys.executable, '-m', 'coverage', 'xml',
        '-o', 'coverage.xml'
    ], cwd=root_dir)

    # Generate TypeScript coverage
    print("📊 Generating TypeScript coverage...")
    subprocess.run([
        'npm', 'run', 'test:coverage'
    ], cwd=root_dir / 'web-admin', capture_output=True)

    # Parse coverage data
    python_coverage = {}
    if (root_dir / 'coverage.xml').exists():
        python_coverage = parse_python_coverage_xml(root_dir / 'coverage.xml')
        print(f"✅ Parsed Python coverage: {len(python_coverage)} files")

    jest_coverage = {}
    lcov_path = root_dir / 'web-admin' / 'coverage' / 'lcov.info'
    if lcov_path.exists():
        jest_coverage = parse_jest_lcov(lcov_path)
        print(f"✅ Parsed TypeScript coverage: {len(jest_coverage)} files")

    # Generate combined report
    output_path = root_dir / 'coverage-combined.html'
    overall, python_pct, ts_pct = generate_combined_html_report(
        python_coverage,
        jest_coverage,
        output_path
    )

    print(f"\n📈 Coverage Summary:")
    print(f"   Overall: {overall:.1f}%")
    print(f"   Python:  {python_pct:.1f}%")
    print(f"   TypeScript: {ts_pct:.1f}%")
    print(f"\n✨ Combined report generated: {output_path}")
    print(f"   Run 'open {output_path}' to view in browser")


if __name__ == '__main__':
    main()