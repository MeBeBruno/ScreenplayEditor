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
	const untitledTitles = [
		'Hier steht mal ein toller Titel',
		'Das fixen wir in der Postproduktion',
		'🧙🔫💘👁️😔',
		'Tatort: Pfandautomat',
		'Schatten über Castrop-Rauxel',
		'Bli Bla Blub!',
		'Ein Hamster sieht rot',
		'Monolog eines halbleeren Wasserglases',
		'Mein neues Drehbuch',
		'Zeitreise, aber nur um fünf Minuten',
		'Titel folgt, sobald die Muse küsst',
		'Explosionen, Gefühle und ein Hund',
		'🛸🐄🌾🚜😱',
		'Mord im Kleingartenverein',
		'Wenn die letzte Taube fällt',
		'Schnick, Schnack und der große Schnuck',
		'Die existenzielle Krise einer Stehlampe',
		'Schwarz-Weiß, 4:3, drei Stunden Regen',
		'Mein tolles Drehbuch',
		'Zombies auf dem Traumschiff',
		'Ich wollte eigentlich nur kurz Kaffee holen',
		'Kein Budget für Spezialeffekte',
		'🕵️‍♂️🔍👣🚪👻',
		'Die Rache der Laminiergeräte',
		'Jenseits der dritten Kaffeetasse',
		'Papperlapapp im Weltraum',
		'Zwei Alpakas gegen den Rest der Welt',
		'Leise weint das Baguette',
		'Mein Drehbuch',
		'Ein Vampir mit Sonnenallergie und Höhenangst',
		'Arbeitstitel Nummer 404',
		'Kamerafahrt ins Ungewisse',
		'🦖🌋🏃‍♂️🚁🕶️',
		'Passierschein A38 – Der Film',
		'Rückkehr der vergessenen Passwörter',
		'Hokuspokus Fidibus, wo ist der Bus?',
		'Der philosophierende Kühlschrank',
		'Nihilismus für Einsteiger',
		'Hier hast du dein Drehbuch',
		'Cyberpunk im Schwarzwald',
		'Vorläufiger Geniestreich',
		'Schnitt, wir drehen das nochmal',
		'🤖❤️🍞⚡🔥',
		'Kasse 3 öffnet für niemanden',
		'Das Imperium schlägt die Tür zu',
		'Kuddelmuddel Deluxe',
		'Kommissar Dackel ermittelt',
		'Zwei Menschen schweigen sich im Café an',
		'Unbenanntes Meisterwerk',
		'Ritter der Tafelrunde im Homeoffice',
		'Noch kein Titel, aber schon drei Logiklöcher',
		'Produktplatzierung hier einfügen',
		'🧛‍♂️🧄🍕🏥⚰️',
		'Verschwörung im Treppenhaus',
		'Fluch der Karibik – Jetzt im Hallenbad',
		'Pillepalle auf hoher See',
		'Rebellion der Bürostühle',
		'Die unerträgliche Leichtigkeit des Nichts',
		'Streng geheimes Filmprojekt',
		'Außerirdische landen in Bielefeld',
		'Hier könnte Ihre Oscar-Rede beginnen',
		'Der Tonmann hat schon wieder geweint',
		'🧜‍♀️👑🌊🦈🎸',
		'Schweigepflicht beim Bäcker',
		'Götterdämmerung im Pausenraum',
		'Schabernack um Mitternacht',
		'Eine Melone auf Abwegen',
		'Kunstpause als abendfüllender Spielfilm',
		'Drehbuch ohne Namen, aber mit Charakter',
		'Ein Musical über Steuererklärungen',
		'Schreibblockade in drei Akten',
		'Innenszene: Nacht, Regen, Verzweiflung',
		'🥷🥐🗼🚓💨',
		'Endstation Schienenersatzverkehr',
		'Die Chroniken von Irgendwo',
		'Rambazamba im Ruhewagen',
		'Geheimagent Goldfisch',
		'Metapher ohne Untertitel',
		'Bitte hier klicken und Titel erfinden',
		'Sherlock Holmes sucht seine Brille',
		'Das leere Blatt schlägt zurück',
		'Vom Winde verweht – Die Sparversion',
		'🧟‍♂️🛒🧻🥫🏏',
		'Hausordnung nach Paragraph 12',
		'Spiel mir das Lied vom Feierabend',
		'Kokolores mit Soße',
		'Der Staubsauger, der zu viel wusste',
		'Ein roter Luftballon fliegt nach links',
		'Projekt X – Der Name war leider schon vergeben',
		'Piraten auf dem Bodensee',
		'Später umbenennen, ganz bestimmt',
		'Drehbuch_Final_Endgültig_Wirklich_Version_12',
		'🐉🏰👸⚔️🥞',
		'Das Geheimnis der zweiten Socke',
		'Tödliche Verspätung – Teil 4',
		'Zickzack zum Schicksal',
		'Pinguine im Kreisverkehr',
		'Existenzieller Weltschmerz in Pastellfarben',
		'Dein nächster Kassenmagnet',
		'Ein Geist mit Angst im Dunkeln',
		'Erstmal anfangen, Titel kommt im Schnitt',
		'Wenn das Studio fragt: Es ist eine Komödie',
		'🎩🐇🪄💥🚑',
		'Blutgericht beim Elternabend',
		'Sturmhöhe, aber im Erdgeschoss',
		'Holterdiepolter ins Glück',
		'Das Tagebuch einer beleidigten Leberwurst',
		'Szenen einer Wohngemeinschaft',
		'Absolut brillantes Skript',
		'Western in der Fußgängerzone',
		'Der Anfang vom Ende meiner Freizeit',
		'Zu teuer für das Abendprogramm',
		'🦍🏢✈️🍌👑',
		'Sonntagsruhe wird nicht verhandelt',
		'Apokalypse am Dienstagvormittag',
		'Klimbim und Krawall',
		'Angriff der Killertomaten aus dem Biomarkt',
		'Der Regisseur hat beim Lesen geweint',
		'Hier entsteht großes Kino',
		'Superheld ohne Superkraft, aber mit gutem Willen',
		'Kreativer Vulkanausbruch in Vorbereitung',
		'Wackelkamera und bedeutungsschwere Stille',
		'👵🧶🐈🧶🌍',
		'Showdown am Wertstoffhof',
		'Das Schweigen der Zimmerpflanzen',
		'Wischwasch auf Breitwand',
		'Warum der Kaktus niemanden umarmt',
		'Festival-Liebling ohne Handlung',
		'Platzhalter mit großem Potenzial',
		'Drachenzähmen leicht vermasselt',
		'Dieses Dokument rettet meine Karriere',
		'Der Praktikant hält das Mikrofon ins Bild',
		'🧊🚢🎻💔🚪',
		'Der letzte freie Parkplatz',
		'Der Herr der Augenringe',
		'Schnickschnack für Fortgeschrittene',
		'Ein Flamingo im Finanzamt',
		'Fünfzehn Minuten Standbild einer Raufasertapete',
		'Streng vertraulicher Kassenschlager',
		'Liebeskomödie im Stau auf der A7',
		'Speichern nicht vergessen – Der Film',
		'Abspann läuft rückwärts',
		'🦝🗑️💎🚓🏖️',
		'Alarmstufe Gelber Sack',
		'Stirb langsam, aber pünktlich',
		'Halligalli im Niemandsland',
		'Die geheimen Pläne der Büropflanze',
		'Bedeutungsschweres Seufzen im Herbst',
		'Ein Werk von historischer Tragweite',
		'Der Mafia-Boss, der lieber häkeln wollte'
	];
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