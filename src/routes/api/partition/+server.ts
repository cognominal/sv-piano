import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

type ExecError = NodeJS.ErrnoException & { stderr?: string; stdout?: string };

const missingModuleRegex = /No module named ['"]music21['"]/;

function isExecError(error: unknown): error is ExecError {
	return typeof error === 'object' && error !== null;
}

function formatPythonError(error: unknown) {
	const fallback = 'Failed to generate MusicXML';
	const combined: string[] = [];
	let stderr = '';
	let message = '';
	let status = 500;

	if (isExecError(error)) {
		if (typeof error.stderr === 'string') {
			stderr = error.stderr.trim();
			if (stderr) combined.push(stderr);
		}
		if (error.message) {
			const cleaned = error.message.replace(/^Command failed:.*?\n/s, '').trim();
			if (cleaned) combined.push(cleaned);
		}
	}

	const combinedText = combined.join('\n');
	if (missingModuleRegex.test(combinedText)) {
		return {
			message: 'music21 is not installed. Install with: python3 -m pip install music21',
			status: 503
		};
	}

	if (stderr) {
		const lines = stderr.split('\n').map((line) => line.trim()).filter(Boolean);
		message = lines[lines.length - 1] ?? '';
	}

	return {
		message: message || combinedText || fallback,
		status
	};
}

async function runPython(inputPath: string, outputPath: string) {
	const script = [
		'import sys',
		'from music21 import converter',
		'score = converter.parse(sys.argv[1])',
		'try:',
		'    score.write("musicxml", fp=sys.argv[2])',
		'except Exception:',
		'    score.splitAtDurations(recurse=True)',
		'    score.write("musicxml", fp=sys.argv[2], makeNotation=False)'
	].join('\n');

	await execFileAsync('python3', ['-c', script, inputPath, outputPath]);
}

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file');

	if (!(file instanceof File)) {
		return new Response('Missing MIDI file', { status: 400 });
	}

	const buffer = new Uint8Array(await file.arrayBuffer());
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sv-piano-'));
	const midiPath = path.join(tempDir, 'input.mid');
	const xmlPath = path.join(tempDir, 'output.musicxml');

	try {
		await fs.writeFile(midiPath, buffer);
		await runPython(midiPath, xmlPath);
		const xml = await fs.readFile(xmlPath, 'utf8');
		return new Response(xml, {
			headers: {
				'Content-Type': 'application/vnd.recordare.musicxml+xml'
			}
		});
	} catch (error) {
		const { message, status } = formatPythonError(error);
		return new Response(message, { status });
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
};
