import { validateScreenplayDocument } from './domain-logic.js';
import { parseLatexScreenplaySource } from './latex-processor.js';

const STORAGE_DOCUMENTS_KEY = 'scriptbridge_documents_v3';
const STORAGE_THEME_KEY = 'scriptbridge_theme_v3';
const STORAGE_ONBOARDING_HIDDEN_KEY = 'scriptbridge_onboarding_hidden_v3';

const DEMO_LATEX = [
	'\\documentclass{screenplay}',
	'\\title{Demo-Play}',
	'\\author{MeBeBruno}',
	'\\address{github.com/MeBeBruno}',
	'\\begin{document}',
	'\\coverpage',
	'\\fadein',
	'\\intslug[TAG]{Farbiger Raum}',
	'DEH und MOH treten ein.',
	'\\begin{dialogue}{DEH}',
	'Haben wir die Action schon verpasst?',
	'\\end{dialogue}',
	'\\begin{dialogue}{MOH}',
	'Niemals, die muss doch erst einmal geschrieben werden!',
	'\\end{dialogue}',
	'DEH blickt sich um und erblickt die leeren Seiten des Skriptes.',
	'\\begin{dialogue}[sieht wieder zu MOH]{DEH}',
	'Ich bin gespannt was hier passieren wird\\dots',
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
			timeOfDay: 'TAG'
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
			transitionType: 'SCHNITT AUF:'
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
	const parsedDemo = parseLatexScreenplaySource(DEMO_LATEX, generateUniqueIdentifier);
	return {
		identifier: generateUniqueIdentifier(),
		title: parsedDemo.metadataPatch.title || 'Demo-Play',
		author: parsedDemo.metadataPatch.author || 'MeBeBruno',
		address: parsedDemo.metadataPatch.address || 'github.com/MeBeBruno',
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
	const untitledTitles = ['Hier steht mal ein toller Titel', 'Bli Bla Blub!', '🧙🔫💘👁️😔', 'Mein neues Drehbuch', 'Mein tolles Drehbuch', 'Mein Drehbuch', 'Hier hast du dein Drehbuch'];
	const timestampNow = createCurrentIsoTimestamp();
	let randomTitleIndex = Math.floor(Math.random() * untitledTitles.length);
	return {
		identifier: generateUniqueIdentifier(),
		title: untitledTitles[randomTitleIndex],
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
		throw new Error('Gespeicherte Dokumentenliste ist ungültig.');
	}
	for (const documentItem of parsedCollection) {
		validateScreenplayDocument(documentItem);
	}
	return parsedCollection;
}

export function saveDocumentsToStorage(documentsArray) {
	if (!Array.isArray(documentsArray)) {
		throw new Error('Zu speichernde Dokumente müssen ein Array sein.');
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

	const sanitizedName = String(documentTitle || 'drehbuch')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9äöüß-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'drehbuch';

	filenameField.value = sanitizedName + '.tex';
	codeField.value = latexSourceCode;
	formNode.submit();
}