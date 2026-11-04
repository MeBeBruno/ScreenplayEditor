import { validateScreenplayDocument } from './domain-logic.js';
import { parseLatexScreenplaySource } from './latex-processor.js';

const STORAGE_DOCUMENTS_KEY = 'scriptbridge_documents_v3';
const STORAGE_THEME_KEY = 'scriptbridge_theme_v3';
const STORAGE_ONBOARDING_HIDDEN_KEY = 'scriptbridge_onboarding_hidden_v3';

const APRIL_RIDER_DEMO_LATEX = [
	'\\documentclass{screenplay}[2012/06/30]',
	'\\title{Für ein paar Tage mehr}',
	'\\author{April Rider}',
	'\\address{Musterstraße 12\\\\10115 Berlin\\\\Projektkurs Film}',
	'\\begin{document}',
	'\\coverpage',
	'\\fadein',
	'\\intslug[TAG]{Seminarraum im Grand Hotel}',
	'JOE und APRIL stürmen durch die Flügeltüren in einen hell erleuchteten Seminarraum.',
	'\\begin{dialogue}{Joe}',
	'Sind wir noch rechtzeitig?',
	'\\end{dialogue}',
	'\\begin{dialogue}{April}',
	'Wie könnten sie ohne uns anfangen? Wir sind die Hauptattraktion.',
	'\\end{dialogue}',
	'Joe schnauft durch und lehnt sich vorne im Raum an das Rednerpult.',
	'\\begin{dialogue}[blickt sich im Raum um]{Joe}',
	'Sind wir das?',
	'\\end{dialogue}',
	'\\begin{dialogue}{April}',
	'Stell dich nicht so an. Du weißt genau, dass wir eingeladen wurden, um über das Drehbuchformat zu sprechen.',
	'\\end{dialogue}',
	'\\begin{dialogue}{Joe}',
	'Aber warum ist der Saal dann komplett leer?',
	'\\end{dialogue}',
	'April und Joe blicken beide durch den Raum~-- endlose Reihen leerer Stühle und weit und breit kein Mensch zu sehen.',
	'\\begin{dialogue}{April}',
	'Okay, ganz ruhig, keine Panik.',
	'\\end{dialogue}',
	'Sie atmet dreimal tief durch. Dann schaut sie auf ihre Armbanduhr und lächelt.',
	'\\begin{dialogue}[fährt fort]{April}',
	'Wir sind eine Stunde zu früh.\\dots Wir sollten proben.',
	'\\end{dialogue}',
	'\\begin{dialogue}{Joe}',
	'Alles klar, fang du an. Seitenränder?',
	'\\end{dialogue}',
	'\\begin{dialogue}{April}',
	'Links anderthalb Zoll. Rechts ein Zoll. Oben ein Zoll bis zum Textkörper, ein halber Zoll bis zur Seitenzahl. Unten ein halber bis anderthalb Zoll, je nachdem, wo der Seitenumbruch landet.',
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
	const parsedDemo = parseLatexScreenplaySource(APRIL_RIDER_DEMO_LATEX, generateUniqueIdentifier);
	return {
		identifier: generateUniqueIdentifier(),
		title: parsedDemo.metadataPatch.title || 'Für ein paar Tage mehr',
		author: parsedDemo.metadataPatch.author || 'April Rider',
		address: parsedDemo.metadataPatch.address || 'Musterstraße 12\n10115 Berlin\nProjektkurs Film',
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