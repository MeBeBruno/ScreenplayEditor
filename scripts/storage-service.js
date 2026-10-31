import { validateDocumentStructure } from './domain-logic.js';

const DOCUMENTS_STORAGE_KEY = 'scriptbridge_documents_v2';
const THEME_STORAGE_KEY = 'scriptbridge_theme_v2';

export function createUniqueIdentifier() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return 'id-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 100000000).toString(36);
}

export function createCurrentIsoTimestamp() {
	return new Date().toISOString();
}

export function formatTimestampForHumanDisplay(isoTimestamp) {
	const parsedEpoch = Date.parse(isoTimestamp);
	if (Number.isNaN(parsedEpoch)) {
		return 'Unbekannt';
	}
	const formatter = new Intl.DateTimeFormat('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
	return formatter.format(new Date(parsedEpoch));
}

export function buildEmptyBlockByType(blockType) {
	if (blockType === 'scene_heading') {
		return {
			identifier: createUniqueIdentifier(),
			type: 'scene_heading',
			environment: 'INT',
			location: '',
			timeOfDay: 'DAY'
		};
	}
	if (blockType === 'dialogue') {
		return {
			identifier: createUniqueIdentifier(),
			type: 'dialogue',
			speaker: '',
			modifier: '',
			segments: [
				{
					identifier: createUniqueIdentifier(),
					segmentType: 'speech',
					text: ''
				}
			]
		};
	}
	if (blockType === 'transition') {
		return {
			identifier: createUniqueIdentifier(),
			type: 'transition',
			transitionType: 'CUT TO:'
		};
	}
	return {
		identifier: createUniqueIdentifier(),
		type: 'action',
		content: ''
	};
}

export function buildInitialExampleDocument() {
	const timestampNow = createCurrentIsoTimestamp();
	return {
		identifier: createUniqueIdentifier(),
		title: 'Das letzte Signal',
		author: 'Drehbuch-Team',
		address: '1. Entwurfsfassung',
		creationTimestamp: timestampNow,
		modificationTimestamp: timestampNow,
		includeTitlePage: true,
		includeFadeIn: true,
		includeFadeOut: true,
		includeTheEnd: true,
		blocks: [
			{
				identifier: createUniqueIdentifier(),
				type: 'scene_heading',
				environment: 'INT',
				location: 'KONTROLLRAUM',
				timeOfDay: 'NIGHT'
			},
			{
				identifier: createUniqueIdentifier(),
				type: 'action',
				content: 'Auf dem Hauptbildschirm blinkt eine einzelne gruene Kurve. JONAS (40) beugt sich dicht ueber das Mikrofon.'
			},
			{
				identifier: createUniqueIdentifier(),
				type: 'dialogue',
				speaker: 'JONAS',
				modifier: '',
				segments: [
					{
						identifier: createUniqueIdentifier(),
						segmentType: 'parenthetical',
						text: 'kaum hoerbar'
					},
					{
						identifier: createUniqueIdentifier(),
						segmentType: 'speech',
						text: 'Antwortet irgendjemand auf dieser Frequenz?'
					}
				]
			}
		]
	};
}

export function buildBlankDocumentRecord() {
	const timestampNow = createCurrentIsoTimestamp();
	return {
		identifier: createUniqueIdentifier(),
		title: 'Unbetiteltes Drehbuch',
		author: '',
		address: '',
		creationTimestamp: timestampNow,
		modificationTimestamp: timestampNow,
		includeTitlePage: true,
		includeFadeIn: true,
		includeFadeOut: true,
		includeTheEnd: true,
		blocks: [
			buildEmptyBlockByType('scene_heading'),
			buildEmptyBlockByType('action')
		]
	};
}

export function readDocumentsFromLocalStorage() {
	const rawString = window.localStorage.getItem(DOCUMENTS_STORAGE_KEY);
	if (rawString === null || rawString.trim().length === 0) {
		const starterList = [buildInitialExampleDocument()];
		writeDocumentsToLocalStorage(starterList);
		return starterList;
	}
	const parsedList = JSON.parse(rawString);
	if (!Array.isArray(parsedList)) {
		throw new Error('Gespeicherte Daten sind beschaedigt.');
	}
	for (const documentItem of parsedList) {
		validateDocumentStructure(documentItem);
	}
	return parsedList;
}

export function writeDocumentsToLocalStorage(documentsArray) {
	if (!Array.isArray(documentsArray)) {
		throw new Error('Speicherdaten muessen eine Liste sein.');
	}
	for (const documentItem of documentsArray) {
		validateDocumentStructure(documentItem);
	}
	window.localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documentsArray));
}

export function readThemeFromLocalStorage() {
	const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
	if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
		return savedTheme;
	}
	return 'system';
}

export function writeThemeToLocalStorage(themeName) {
	window.localStorage.setItem(THEME_STORAGE_KEY, themeName);
}

export function downloadTextAsFile(fileName, textContent, mimeType) {
	const dataBlob = new Blob([textContent], { type: mimeType });
	const blobUrl = URL.createObjectURL(dataBlob);
	const linkElement = document.createElement('a');
	linkElement.href = blobUrl;
	linkElement.download = fileName;
	document.body.appendChild(linkElement);
	linkElement.click();
	document.body.removeChild(linkElement);
	URL.revokeObjectURL(blobUrl);
}

export function postLatexToOverleaf(documentTitle, latexSourceCode) {
	const formElement = document.getElementById('overleaf-bridge-form');
	const filenameInput = document.getElementById('overleaf-filename-input');
	const latexInput = document.getElementById('overleaf-latex-input');

	if (formElement === null || filenameInput === null || latexInput === null) {
		throw new Error('Overleaf-Formular konnte nicht gefunden werden.');
	}

	const cleanSlug = String(documentTitle || 'drehbuch')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9äöüß-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'drehbuch';

	filenameInput.value = cleanSlug + '.tex';
	latexInput.value = latexSourceCode;
	formElement.submit();
}