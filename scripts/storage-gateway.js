import { validateArrayInstance, validateDocumentRecord } from './domain-calculations.js';

const STORAGE_COLLECTION_KEY = 'scriptbridge_screenplay_documents_v1';
const STORAGE_THEME_KEY = 'scriptbridge_theme_preference_v1';

export function generateUniqueIdentifier() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	const timestampComponent = Date.now().toString(36);
	const randomComponent = Math.floor(Math.random() * 1000000000).toString(36);
	return 'identifier-' + timestampComponent + '-' + randomComponent;
}

export function getCurrentIsoTimestamp() {
	return new Date().toISOString();
}

export function formatIsoTimestampForDisplay(isoTimestampString) {
	const parsedMilliseconds = Date.parse(isoTimestampString);
	if (Number.isNaN(parsedMilliseconds)) {
		return 'Unbekanntes Datum';
	}
	const dateFormatter = new Intl.DateTimeFormat('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
	return dateFormatter.format(new Date(parsedMilliseconds));
}

export function createStarterDocumentRecord() {
	const currentTimestamp = getCurrentIsoTimestamp();
	return {
		identifier: generateUniqueIdentifier(),
		title: 'Das Echo der Maschine',
		author: 'Drehbuch-Team',
		address: '1. Entwurfsfassung',
		creationTimestamp: currentTimestamp,
		modificationTimestamp: currentTimestamp,
		includeTitlePage: true,
		includeFadeIn: true,
		includeFadeOut: true,
		includeTheEnd: true,
		blocks: [
			{
				identifier: generateUniqueIdentifier(),
				type: 'scene_heading',
				environment: 'INT',
				location: 'SERVERRAUM',
				timeOfDay: 'NIGHT'
			},
			{
				identifier: generateUniqueIdentifier(),
				type: 'action',
				content: 'Blaues Licht pulsiert im Takt der Kuehlaggregate. ELENA (34) tippt konzentriert auf einem schmalen Terminal.'
			},
			{
				identifier: generateUniqueIdentifier(),
				type: 'dialogue',
				speaker: 'ELENA',
				modifier: '',
				segments: [
					{
						identifier: generateUniqueIdentifier(),
						segmentType: 'parenthetical',
						text: 'ohne den Blick vom Monitor zu heben'
					},
					{
						identifier: generateUniqueIdentifier(),
						segmentType: 'speech',
						text: 'Die Sequenz ist vollstaendig uebersetzt. Kein einziger Syntaxfehler.'
					}
				]
			}
		]
	};
}

export function createEmptyDocumentRecord() {
	const currentTimestamp = getCurrentIsoTimestamp();
	return {
		identifier: generateUniqueIdentifier(),
		title: 'Neues Drehbuch',
		author: '',
		address: '',
		creationTimestamp: currentTimestamp,
		modificationTimestamp: currentTimestamp,
		includeTitlePage: true,
		includeFadeIn: true,
		includeFadeOut: true,
		includeTheEnd: true,
		blocks: [
			{
				identifier: generateUniqueIdentifier(),
				type: 'scene_heading',
				environment: 'INT',
				location: 'SCHAUPLATZ',
				timeOfDay: 'DAY'
			},
			{
				identifier: generateUniqueIdentifier(),
				type: 'action',
				content: ''
			}
		]
	};
}

export function createDefaultBlockByType(blockType) {
	if (blockType === 'scene_heading') {
		return {
			identifier: generateUniqueIdentifier(),
			type: 'scene_heading',
			environment: 'INT',
			location: '',
			timeOfDay: 'DAY'
		};
	}
	if (blockType === 'dialogue') {
		return {
			identifier: generateUniqueIdentifier(),
			type: 'dialogue',
			speaker: '',
			modifier: '',
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

export function loadDocumentCollectionFromLocalStorage() {
	const rawSerializedData = window.localStorage.getItem(STORAGE_COLLECTION_KEY);
	if (rawSerializedData === null || rawSerializedData.trim().length === 0) {
		const initialCollection = [createStarterDocumentRecord()];
		saveDocumentCollectionToLocalStorage(initialCollection);
		return initialCollection;
	}
	const parsedCollection = JSON.parse(rawSerializedData);
	validateArrayInstance(parsedCollection, 'parsedCollection');
	for (const documentItem of parsedCollection) {
		validateDocumentRecord(documentItem);
	}
	return parsedCollection;
}

export function saveDocumentCollectionToLocalStorage(documentCollection) {
	validateArrayInstance(documentCollection, 'documentCollection');
	for (const documentItem of documentCollection) {
		validateDocumentRecord(documentItem);
	}
	const serializedPayload = JSON.stringify(documentCollection);
	window.localStorage.setItem(STORAGE_COLLECTION_KEY, serializedPayload);
}

export function loadThemePreferenceFromLocalStorage() {
	const storedTheme = window.localStorage.getItem(STORAGE_THEME_KEY);
	if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
		return storedTheme;
	}
	return 'system';
}

export function saveThemePreferenceToLocalStorage(themeValue) {
	window.localStorage.setItem(STORAGE_THEME_KEY, themeValue);
}

export function triggerFileDownload(filenameString, contentString, mimeTypeString) {
	const blobObject = new Blob([contentString], { type: mimeTypeString });
	const objectUrl = URL.createObjectURL(blobObject);
	const temporaryAnchor = document.createElement('a');
	temporaryAnchor.href = objectUrl;
	temporaryAnchor.download = filenameString;
	document.body.appendChild(temporaryAnchor);
	temporaryAnchor.click();
	document.body.removeChild(temporaryAnchor);
	URL.revokeObjectURL(objectUrl);
}

export function submitLatexToOverleafForm(documentTitle, latexSourceCode) {
	const formElement = document.getElementById('overleaf-submission-form');
	const snipNameInput = document.getElementById('overleaf-snip-name-input');
	const snipContentInput = document.getElementById('overleaf-snip-content-input');

	if (formElement === null || snipNameInput === null || snipContentInput === null) {
		throw new Error('Das Overleaf-Uebergabeformular wurde im DOM nicht gefunden.');
	}

	const sanitizedFilename = String(documentTitle || 'drehbuch')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9äöüß-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'drehbuch';

	snipNameInput.value = sanitizedFilename + '.tex';
	snipContentInput.value = latexSourceCode;
	formElement.submit();
}