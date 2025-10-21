#!/usr/bin/env node

/**
 * Coverage Gate Check
 * 检查测试覆盖率是否满足门控要求
 */

import fs from 'fs';
import path from 'path';

const COVERAGE_THRESHOLDS = {
	lines: 80,
	functions: 80,
	branches: 75,
	statements: 80
};

const COVERAGE_FILE = './coverage/coverage-final.json';

function checkCoverage() {
	if (!fs.existsSync(COVERAGE_FILE)) {
		console.error('❌ Coverage file not found. Run tests with coverage first.');
		console.error(`   Expected: ${COVERAGE_FILE}`);
		process.exit(1);
	}

	const coverage = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));

	// Calculate total coverage
	let totalLines = 0;
	let coveredLines = 0;
	let totalFunctions = 0;
	let coveredFunctions = 0;
	let totalBranches = 0;
	let coveredBranches = 0;
	let totalStatements = 0;
	let coveredStatements = 0;

	for (const file in coverage) {
		const fileCoverage = coverage[file];

		// Lines
		if (fileCoverage.l) {
			for (const line in fileCoverage.l) {
				totalLines++;
				if (fileCoverage.l[line] > 0) coveredLines++;
			}
		}

		// Functions
		if (fileCoverage.f) {
			for (const func in fileCoverage.f) {
				totalFunctions++;
				if (fileCoverage.f[func] > 0) coveredFunctions++;
			}
		}

		// Branches
		if (fileCoverage.b) {
			for (const branch in fileCoverage.b) {
				const branchData = fileCoverage.b[branch];
				if (Array.isArray(branchData)) {
					totalBranches += branchData.length;
					coveredBranches += branchData.filter(b => b > 0).length;
				}
			}
		}

		// Statements
		if (fileCoverage.s) {
			for (const stmt in fileCoverage.s) {
				totalStatements++;
				if (fileCoverage.s[stmt] > 0) coveredStatements++;
			}
		}
	}

	const metrics = {
		lines: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 100,
		functions: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100) : 100,
		branches: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 100,
		statements: totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100) : 100
	};

	console.log('\n📊 Coverage Report\n');
	console.log('Metric       | Coverage | Threshold | Status');
	console.log('-------------|----------|-----------|--------');

	let allPassed = true;

	for (const [metric, threshold] of Object.entries(COVERAGE_THRESHOLDS)) {
		const coverage = metrics[metric];
		const status = coverage >= threshold ? '✅ PASS' : '❌ FAIL';
		const displayMetric = metric.padEnd(12);
		const displayCoverage = `${coverage}%`.padEnd(8);
		const displayThreshold = `${threshold}%`.padEnd(9);

		console.log(`${displayMetric} | ${displayCoverage} | ${displayThreshold} | ${status}`);

		if (coverage < threshold) {
			allPassed = false;
		}
	}

	console.log('\n');

	if (allPassed) {
		console.log('✅ All coverage thresholds met!');
		process.exit(0);
	} else {
		console.log('❌ Coverage thresholds not met. Please improve test coverage.');
		process.exit(1);
	}
}

checkCoverage();

