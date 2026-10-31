import { validateScreenplayDocument } from './domain-logic.js';
import { parseLatexScreenplaySource } from './latex-processor.js';

const STORAGE_DOCUMENTS_KEY = 'scriptbridge_documents_v3';
const STORAGE_THEME_KEY = 'scriptbridge_theme_v3';
const STORAGE_ONBOARDING_HIDDEN_KEY = 'scriptbridge_onboarding_hidden_v3';

const APRIL_RIDER_DEMO_LATEX = [
	'\\documentclass{screenplay}[2012/06/30]',
	'\\title{For a Few Days More}',
	'\\author{April Rider}',
	'\\address{555 George St NNW\\\\Kaplan, ND 77777\\\\999-999-9999}',
	'\\begin{document}',
	'\\coverpage',
	'\\fadein',
	'\\intslug[day]{Driskill Hotel Seminar Room}',
	'JOE and APRIL burst through the doors into a clean, well-lit seminar room.',
	'\\begin{dialogue}{Joe}',
	'Are we in time?',
	'\\end{dialogue}',
	'\\begin{dialogue}{April}',
	'How could they start without us? We\'re the main attraction.',
	'\\end{dialogue}',
	'Joe catches his breath as he leans against the podium at the front of the room.',
	'\\begin{dialogue}[looking about the room]{Joe}',
	'We are?',
	'\\end{dialogue}',
	'\\begin{dialogue}{April}',
	'Don\'t be a moron. You know we\'ve been invited to Austin to discuss script format.',
	'\\end{dialogue}',
	'\\begin{dialogue}{Joe}',
	'But why is the room empty?',
	'\\end{dialogue}',
	'April and Joe both look out across the room~-- rows of empty chairs and nary a person in sight.',
	'\\begin{dialogue}{April}',
	'Okay, okay, don\'t panic.',
	'\\end{dialogue}',
	'She takes three deep breaths. Then she looks at her watch and smiles.',
	'\\begin{dialogue}[continuing]{April}',
	'We\'re an hour early.\\dots We should rehearse.',
	'\\end{dialogue}',
	'\\begin{dialogue}{Joe}',
	'Okay, you start. Margins?',
	'\\end{dialogue}',
	'\\begin{dialogue}{April}',
	'Left, 1.5 inches. Right, 1.0 inches. Top, 1.0 inches to the body, 0.5 inches to the number. Bottom, 0.5 to 1.5 inches, depending on where the page break comes.',
	'\\end{dialogue}',
	'\\end{document}'
].join('\n');

export function generateUniqueIdentifier() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return 'id-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 100000000).toString(36);
}

export function createCurrentIsoTimestamp() {
	return new Date().toISOString();
}

export function formatIsoTimestampReadable(isoTimestamp) {
	const epochMs = Date.parse(isoTimestamp);
	if (Number.isNaN(epochMs)) {
		return 'Unbekannt';
	}
	const dateFormatter = new Intl.DateTimeFormat('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
	return dateFormatter.format(new Date(epochMs));
}

export function createEmptyBlockRecord(blockType) {
	if (blockType === 'scene_heading') {
		return {
			identifier: generateUniqueIdentifier(),
			type: 'scene_heading',
			environment: 'INT',
			location: '',
			timeOfDay: 'day'
		};
	}
	if (blockType === 'dialogue') {
		return {
			identifier: generateUniqueIdentifier(),
			type: 'dialogue',
			speaker: '',
			segments: [
				{
					identifier: generateUniqueIdentifier(),
					segmentType: 'speech',
					text: ''
				}
			]
		};
	}
	if (blockType === 'transition') {
		return {
			identifier: generateUniqueIdentifier(),
			type: 'transition',
			transitionType: 'CUT TO:'
		};
	}
	return {
		identifier: generateUniqueIdentifier(),
		type: 'action',
		content: ''
	};
}

export function createDemoScreenplayDocument() {
	const timestampNow = createCurrentIsoTimestamp();
	const parsedDemo = parseLatexScreenplaySource(APRIL_RIDER_DEMO_LATEX, generateUniqueIdentifier);
	return {
		identifier: generateUniqueIdentifier(),
		title: parsedDemo.metadataPatch.title || 'For a Few Days More',
		author: parsedDemo.metadataPatch.author || 'April Rider',
		address: parsedDemo.metadataPatch.address || '555 George St NNW\nKaplan, ND 77777\n999-999-9999',
		creationTimestamp: timestampNow,
		modificationTimestamp: timestampNow,
		includeTitlePage: true,
		includeFadeIn: true,
		includeFadeOut: false,
		includeTheEnd: false,
		blocks: parsedDemo.blocks
	};
}

export function createBlankScreenplayDocument() {
	const timestampNow = createCurrentIsoTimestamp();
	return {
		identifier: generateUniqueIdentifier(),
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
			createEmptyBlockRecord('scene_heading'),
			createEmptyBlockRecord('action')
		]
	};
}

export function loadDocumentsFromStorage() {
	const storedJson = window.localStorage.getItem(STORAGE_DOCUMENTS_KEY);
	if (storedJson === null || storedJson.trim().length === 0) {
		const initialDocuments = [createDemoScreenplayDocument()];
		saveDocumentsToStorage(initialDocuments);
		return initialDocuments;
	}
	const parsedCollection = JSON.parse(storedJson);
	if (!Array.isArray(parsedCollection)) {
		throw new Error('Gespeicherte Dokumentenliste ist ungueltig.');
	}
	for (const documentItem of parsedCollection) {
		validateScreenplayDocument(documentItem);
	}
	return parsedCollection;
}

export function saveDocumentsToStorage(documentsArray) {
	if (!Array.isArray(documentsArray)) {
		throw new Error('Zu speichernde Dokumente muessen ein Array sein.');
	}
	for (const documentItem of documentsArray) {
		validateScreenplayDocument(documentItem);
	}
	window.localStorage.setItem(STORAGE_DOCUMENTS_KEY, JSON.stringify(documentsArray));
}

export function loadThemeFromStorage() {
	const themeValue = window.localStorage.getItem(STORAGE_THEME_KEY);
	if (themeValue === 'light' || themeValue === 'dark' || themeValue === 'system') {
		return themeValue;
	}
	return 'system';
}

export function saveThemeToStorage(themeValue) {
	window.localStorage.setItem(STORAGE_THEME_KEY, themeValue);
}

export function loadOnboardingHiddenFlag() {
	return window.localStorage.getItem(STORAGE_ONBOARDING_HIDDEN_KEY) === 'true';
}

export function saveOnboardingHiddenFlag(isHiddenBoolean) {
	window.localStorage.setItem(STORAGE_ONBOARDING_HIDDEN_KEY, String(Boolean(isHiddenBoolean)));
}

export function triggerBrowserFileDownload(fileName, contentString, mimeType) {
	const blobObject = new Blob([contentString], { type: mimeType });
	const objectUrl = URL.createObjectURL(blobObject);
	const anchorNode = document.createElement('a');
	anchorNode.href = objectUrl;
	anchorNode.download = fileName;
	document.body.appendChild(anchorNode);
	anchorNode.click();
	document.body.removeChild(anchorNode);
	URL.revokeObjectURL(objectUrl);
}

export function submitScreenplayToOverleaf(documentTitle, latexSourceCode) {
	const formNode = document.getElementById('overleaf-post-form');
	const filenameField = document.getElementById('overleaf-snip-filename');
	const codeField = document.getElementById('overleaf-snip-code');

	if (formNode === null || filenameField === null || codeField === null) {
		throw new Error('Overleaf-Formular fehlt im Dokument.');
	}

	const sanitizedName = String(documentTitle || 'screenplay')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9äöüß-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'screenplay';

	filenameField.value = sanitizedName + '.tex';
	codeField.value = latexSourceCode;
	formNode.submit();
}