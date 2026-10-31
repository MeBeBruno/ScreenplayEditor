import {
	calculateDocumentMetrics,
	extractUniqueCharacterNames,
	filterAndSortDocuments,
	reorderArrayElements,
	validateDocumentRecord
} from './domain-calculations.js';

import {
	buildArtificialIntelligenceSystemPrompt,
	compileDocumentToLatexSource,
	parseArtificialIntelligenceTextIntoBlocks
} from './latex-compiler.js';

import {
	createDefaultBlockByType,
	createEmptyDocumentRecord,
	formatIsoTimestampForDisplay,
	generateUniqueIdentifier,
	getCurrentIsoTimestamp,
	loadDocumentCollectionFromLocalStorage,
	loadThemePreferenceFromLocalStorage,
	saveDocumentCollectionToLocalStorage,
	saveThemePreferenceToLocalStorage,
	submitLatexToOverleafForm,
	triggerFileDownload
} from './storage-gateway.js';

const applicationState = {
	documents: [],
	activeDocumentIdentifier: null,
	searchQuery: '',
	sortField: 'modificationTimestamp',
	sortDirection: 'descending',
	isPreviewDrawerOpen: false,
	activePreviewTab: 'manuscript',
	themePreference: 'system'
};

function displayNotificationToast(messageText) {
	const toastRegion = document.getElementById('notification-toast-region');
	if (toastRegion === null) {
		return;
	}
	const toastElement = document.createElement('div');
	toastElement.className = 'notification-toast';
	toastElement.textContent = messageText;
	toastRegion.appendChild(toastElement);
	window.setTimeout(function removeExpiredToast() {
		if (toastElement.parentNode === toastRegion) {
			toastRegion.removeChild(toastElement);
		}
	}, 3200);
}

function executeWithErrorBoundary(operationFunction) {
	try {
		operationFunction();
	} catch (caughtError) {
		const errorMessage = caughtError instanceof Error ? caughtError.message : 'Unbekannter Systemfehler';
		displayNotificationToast('Hinweis: ' + errorMessage);
	}
}

function getActiveDocumentRecord() {
	if (applicationState.activeDocumentIdentifier === null) {
		return null;
	}
	return applicationState.documents.find(function matchIdentifier(documentItem) {
		return documentItem.identifier === applicationState.activeDocumentIdentifier;
	}) || null;
}

function updateSaveStatusBadge(statusText) {
	const statusBadge = document.getElementById('save-status-indicator');
	if (statusBadge !== null) {
		statusBadge.textContent = statusText;
	}
}

function persistStateAndTouchActiveDocument(activeDocumentRecord) {
	if (activeDocumentRecord !== null) {
		activeDocumentRecord.modificationTimestamp = getCurrentIsoTimestamp();
		validateDocumentRecord(activeDocumentRecord);
	}
	saveDocumentCollectionToLocalStorage(applicationState.documents);
	if (activeDocumentRecord !== null) {
		const formattedTime = formatIsoTimestampForDisplay(activeDocumentRecord.modificationTimestamp);
		updateSaveStatusBadge('Gespeichert: ' + formattedTime);
	}
}

function applyThemePreference(themeValue) {
	applicationState.themePreference = themeValue;
	document.documentElement.setAttribute('data-theme', themeValue);
	saveThemePreferenceToLocalStorage(themeValue);
	const themeButton = document.getElementById('theme-switcher-button');
	if (themeButton !== null) {
		const labelMap = {
			system: 'Modus: System',
			light: 'Modus: Hell',
			dark: 'Modus: Dunkel'
		};
		themeButton.textContent = labelMap[themeValue] || 'Modus';
	}
}

function createCreateDocumentCardElement() {
	const listItem = document.createElement('div');
	listItem.className = 'document-card document-card-create';
	listItem.setAttribute('role', 'listitem');

	const createButton = document.createElement('button');
	createButton.type = 'button';
	createButton.className = 'document-card-trigger';
	createButton.setAttribute('data-action', 'create-new-document');

	const plusBadge = document.createElement('span');
	plusBadge.className = 'create-plus-symbol';
	plusBadge.setAttribute('aria-hidden', 'true');
	plusBadge.textContent = '+';

	const titleSpan = document.createElement('span');
	titleSpan.className = 'document-card-title';
	titleSpan.textContent = 'Neues Drehbuch';

	const subtitleSpan = document.createElement('span');
	subtitleSpan.className = 'document-card-meta';
	subtitleSpan.textContent = 'Leeres Skript starten';

	createButton.appendChild(plusBadge);
	createButton.appendChild(titleSpan);
	createButton.appendChild(subtitleSpan);
	listItem.appendChild(createButton);
	return listItem;
}

function createExistingDocumentCardElement(documentRecord) {
	const metrics = calculateDocumentMetrics(documentRecord);
	const cardElement = document.createElement('div');
	cardElement.className = 'document-card';
	cardElement.setAttribute('role', 'listitem');

	const openTriggerButton = document.createElement('button');
	openTriggerButton.type = 'button';
	openTriggerButton.className = 'document-card-trigger';
	openTriggerButton.setAttribute('data-action', 'open-document');
	openTriggerButton.setAttribute('data-document-identifier', documentRecord.identifier);

	const sheetIcon = document.createElement('div');
	sheetIcon.className = 'document-sheet-icon';
	sheetIcon.setAttribute('aria-hidden', 'true');
	for (let lineCounter = 0; lineCounter < 4; lineCounter += 1) {
		const lineSpan = document.createElement('span');
		lineSpan.className = lineCounter === 3 ? 'document-sheet-line document-sheet-line-short' : 'document-sheet-line';
		sheetIcon.appendChild(lineSpan);
	}

	const titleElement = document.createElement('span');
	titleElement.className = 'document-card-title';
	titleElement.textContent = documentRecord.title || 'Unbetiteltes Drehbuch';

	const metaContainer = document.createElement('div');
	metaContainer.className = 'document-card-meta';

	const modifiedSpan = document.createElement('span');
	modifiedSpan.textContent = 'Bearbeitet: ' + formatIsoTimestampForDisplay(documentRecord.modificationTimestamp);

	const createdSpan = document.createElement('span');
	createdSpan.textContent = 'Erstellt: ' + formatIsoTimestampForDisplay(documentRecord.creationTimestamp);

	const statsSpan = document.createElement('span');
	statsSpan.textContent = metrics.sceneCount + ' Szenen · ca. ' + metrics.estimatedPageCount + ' S.';

	metaContainer.appendChild(modifiedSpan);
	metaContainer.appendChild(createdSpan);
	metaContainer.appendChild(statsSpan);

	openTriggerButton.appendChild(sheetIcon);
	openTriggerButton.appendChild(titleElement);
	openTriggerButton.appendChild(metaContainer);

	const footerBar = document.createElement('div');
	footerBar.className = 'document-card-footer';

	const duplicateButton = document.createElement('button');
	duplicateButton.type = 'button';
	duplicateButton.className = 'button-secondary';
	duplicateButton.setAttribute('data-action', 'duplicate-document');
	duplicateButton.setAttribute('data-document-identifier', documentRecord.identifier);
	duplicateButton.textContent = 'Duplizieren';

	const deleteButton = document.createElement('button');
	deleteButton.type = 'button';
	deleteButton.className = 'button-danger';
	deleteButton.setAttribute('data-action', 'delete-document');
	deleteButton.setAttribute('data-document-identifier', documentRecord.identifier);
	deleteButton.textContent = 'Löschen';

	footerBar.appendChild(duplicateButton);
	footerBar.appendChild(deleteButton);

	cardElement.appendChild(openTriggerButton);
	cardElement.appendChild(footerBar);
	return cardElement;
}

function renderDashboardGrid() {
	const gridContainer = document.getElementById('document-grid-container');
	if (gridContainer === null) {
		return;
	}
	gridContainer.replaceChildren();
	gridContainer.appendChild(createCreateDocumentCardElement());

	const visibleDocuments = filterAndSortDocuments(
		applicationState.documents,
		applicationState.searchQuery,
		applicationState.sortField,
		applicationState.sortDirection
	);

	for (const documentRecord of visibleDocuments) {
		gridContainer.appendChild(createExistingDocumentCardElement(documentRecord));
	}
}

function updateCharacterAutocompleteDatalist(activeDocumentRecord) {
	const datalistElement = document.getElementById('character-names-datalist');
	if (datalistElement === null || activeDocumentRecord === null) {
		return;
	}
	datalistElement.replaceChildren();
	const characterNames = extractUniqueCharacterNames(activeDocumentRecord);
	for (const characterName of characterNames) {
		const optionElement = document.createElement('option');
		optionElement.value = characterName;
		datalistElement.appendChild(optionElement);
	}
}

function renderEditorMetricsAndPreview(activeDocumentRecord) {
	if (activeDocumentRecord === null) {
		return;
	}
	const metricsContainer = document.getElementById('editor-metrics-summary');
	if (metricsContainer !== null) {
		metricsContainer.replaceChildren();
		const metricsData = calculateDocumentMetrics(activeDocumentRecord);
		const labels = [
			metricsData.sceneCount + ' Szenen',
			metricsData.blockCount + ' Blöcke',
			metricsData.wordCount + ' Wörter',
			'ca. ' + metricsData.estimatedPageCount + ' Seiten (' + metricsData.estimatedRuntimeFormatted + ')'
		];
		for (const pillText of labels) {
			const pillSpan = document.createElement('span');
			pillSpan.className = 'metric-pill';
			pillSpan.textContent = pillText;
			metricsContainer.appendChild(pillSpan);
		}
	}

	updateCharacterAutocompleteDatalist(activeDocumentRecord);

	const latexContainer = document.getElementById('latex-source-preview-container');
	if (latexContainer !== null) {
		latexContainer.textContent = compileDocumentToLatexSource(activeDocumentRecord);
	}

	const manuscriptContainer = document.getElementById('manuscript-preview-container');
	if (manuscriptContainer !== null) {
		manuscriptContainer.replaceChildren();
		if (activeDocumentRecord.includeFadeIn) {
			const fadeInNode = document.createElement('div');
			fadeInNode.className = 'manuscript-slugline';
			fadeInNode.textContent = 'FADE IN:';
			manuscriptContainer.appendChild(fadeInNode);
		}

		for (const blockItem of activeDocumentRecord.blocks) {
			if (blockItem.type === 'scene_heading') {
				const slugNode = document.createElement('div');
				slugNode.className = 'manuscript-slugline';
				const prefixText = blockItem.environment === 'EXT' ? 'EXT. ' : 'INT. ';
				const locationText = String(blockItem.location || 'SCHAUPLATZ').toUpperCase();
				const timeText = String(blockItem.timeOfDay || '').trim().toUpperCase();
				slugNode.textContent = timeText.length > 0 ? prefixText + locationText + ' - ' + timeText : prefixText + locationText;
				manuscriptContainer.appendChild(slugNode);
			} else if (blockItem.type === 'action') {
				const actionNode = document.createElement('p');
				actionNode.className = 'manuscript-action';
				actionNode.textContent = blockItem.content || '';
				manuscriptContainer.appendChild(actionNode);
			} else if (blockItem.type === 'dialogue') {
				const dialogueGroup = document.createElement('div');
				dialogueGroup.className = 'manuscript-dialogue-group';
				const speakerNode = document.createElement('div');
				speakerNode.className = 'manuscript-speaker';
				const speakerLabel = String(blockItem.speaker || 'FIGUR').toUpperCase();
				speakerNode.textContent = blockItem.modifier ? speakerLabel + ' (' + blockItem.modifier + ')' : speakerLabel;
				dialogueGroup.appendChild(speakerNode);

				const segmentsList = Array.isArray(blockItem.segments) ? blockItem.segments : [];
				for (const segmentItem of segmentsList) {
					const segmentLine = document.createElement('div');
					if (segmentItem.segmentType === 'parenthetical') {
						segmentLine.className = 'manuscript-parenthetical';
						segmentLine.textContent = '(' + (segmentItem.text || '') + ')';
					} else {
						segmentLine.textContent = segmentItem.text || '';
					}
					dialogueGroup.appendChild(segmentLine);
				}
				manuscriptContainer.appendChild(dialogueGroup);
			} else if (blockItem.type === 'transition') {
				const transitionNode = document.createElement('div');
				transitionNode.className = 'manuscript-transition';
				transitionNode.textContent = blockItem.transitionType || 'CUT TO:';
				manuscriptContainer.appendChild(transitionNode);
			}
		}

		if (activeDocumentRecord.includeFadeOut) {
			const fadeOutNode = document.createElement('div');
			fadeOutNode.className = 'manuscript-transition';
			fadeOutNode.textContent = 'FADE OUT.';
			manuscriptContainer.appendChild(fadeOutNode);
		}
	}
}

function createSceneHeadingFieldsElement(blockItem) {
	const gridWrapper = document.createElement('div');
	gridWrapper.className = 'scene-heading-fields-grid';

	const environmentGroup = document.createElement('div');
	environmentGroup.className = 'control-field-group';
	const environmentLabel = document.createElement('label');
	environmentLabel.className = 'field-label';
	environmentLabel.textContent = 'Innen / Außen';
	const environmentSelect = document.createElement('select');
	environmentSelect.className = 'select-input';
	environmentSelect.setAttribute('data-block-field', 'environment');
	const optionInterior = new Option('INT. (Innenaufnahme)', 'INT');
	const optionExterior = new Option('EXT. (Außenaufnahme)', 'EXT');
	environmentSelect.appendChild(optionInterior);
	environmentSelect.appendChild(optionExterior);
	environmentSelect.value = blockItem.environment === 'EXT' ? 'EXT' : 'INT';
	environmentGroup.appendChild(environmentLabel);
	environmentGroup.appendChild(environmentSelect);

	const locationGroup = document.createElement('div');
	locationGroup.className = 'control-field-group';
	const locationLabel = document.createElement('label');
	locationLabel.className = 'field-label';
	locationLabel.textContent = 'Schauplatz / Ort';
	const locationInput = document.createElement('input');
	locationInput.type = 'text';
	locationInput.className = 'text-input uppercase-input';
	locationInput.placeholder = 'z. B. LABOR oder KÜCHE';
	locationInput.value = blockItem.location || '';
	locationInput.setAttribute('data-block-field', 'location');
	locationGroup.appendChild(locationLabel);
	locationGroup.appendChild(locationInput);

	const timeGroup = document.createElement('div');
	timeGroup.className = 'control-field-group';
	const timeLabel = document.createElement('label');
	timeLabel.className = 'field-label';
	timeLabel.textContent = 'Tageszeit';
	const timeInput = document.createElement('input');
	timeInput.type = 'text';
	timeInput.className = 'text-input uppercase-input';
	timeInput.setAttribute('list', 'time-of-day-datalist');
	timeInput.placeholder = 'DAY / NIGHT';
	timeInput.value = blockItem.timeOfDay || '';
	timeInput.setAttribute('data-block-field', 'timeOfDay');
	timeGroup.appendChild(timeLabel);
	timeGroup.appendChild(timeInput);

	gridWrapper.appendChild(environmentGroup);
	gridWrapper.appendChild(locationGroup);
	gridWrapper.appendChild(timeGroup);
	return gridWrapper;
}

function createActionFieldsElement(blockItem) {
	const wrapper = document.createElement('div');
	wrapper.className = 'control-field-group';
	const labelElement = document.createElement('label');
	labelElement.className = 'field-label';
	labelElement.textContent = 'Handlungsbeschreibung (Was sieht und hört man?)';
	const textareaElement = document.createElement('textarea');
	textareaElement.className = 'block-textarea';
	textareaElement.rows = 3;
	textareaElement.placeholder = 'Beschreibe die visuelle Handlung in der Gegenwart...';
	textareaElement.value = blockItem.content || '';
	textareaElement.setAttribute('data-block-field', 'content');
	wrapper.appendChild(labelElement);
	wrapper.appendChild(textareaElement);
	return wrapper;
}

function createDialogueFieldsElement(blockItem) {
	const container = document.createElement('div');
	container.className = 'control-field-group';

	const speakerGrid = document.createElement('div');
	speakerGrid.className = 'dialogue-speaker-grid';

	const speakerField = document.createElement('div');
	speakerField.className = 'control-field-group';
	const speakerLabel = document.createElement('label');
	speakerLabel.className = 'field-label';
	speakerLabel.textContent = 'Sprechende Figur';
	const speakerInput = document.createElement('input');
	speakerInput.type = 'text';
	speakerInput.className = 'text-input uppercase-input';
	speakerInput.setAttribute('list', 'character-names-datalist');
	speakerInput.placeholder = 'NAME DER FIGUR';
	speakerInput.value = blockItem.speaker || '';
	speakerInput.setAttribute('data-block-field', 'speaker');
	speakerField.appendChild(speakerLabel);
	speakerField.appendChild(speakerInput);

	const modifierField = document.createElement('div');
	modifierField.className = 'control-field-group';
	const modifierLabel = document.createElement('label');
	modifierLabel.className = 'field-label';
	modifierLabel.textContent = 'Stimm-Zusatz (Optional)';
	const modifierSelect = document.createElement('select');
	modifierSelect.className = 'select-input';
	modifierSelect.setAttribute('data-block-field', 'modifier');
	const modifierOptions = [
		['', 'Normal (Im Bild zu sehen)'],
		['V.O.', 'V.O. (Voice Over / Erzählerstimme)'],
		['O.S.', 'O.S. (Off-Screen / Außerhalb des Bildes)'],
		['CONT\'D', 'CONT\'D (Spricht direkt weiter)'],
		['FILTERED', 'FILTERED (Durch Telefon / Funkgerät)']
	];
	for (const [optionValue, optionLabel] of modifierOptions) {
		modifierSelect.appendChild(new Option(optionLabel, optionValue));
	}
	modifierSelect.value = blockItem.modifier || '';
	modifierField.appendChild(modifierLabel);
	modifierField.appendChild(modifierSelect);

	speakerGrid.appendChild(speakerField);
	speakerGrid.appendChild(modifierField);
	container.appendChild(speakerGrid);

	const segmentsWrapper = document.createElement('div');
	segmentsWrapper.className = 'dialogue-segments-container';

	const segmentsList = Array.isArray(blockItem.segments) ? blockItem.segments : [];
	for (const segmentItem of segmentsList) {
		const segmentRow = document.createElement('div');
		segmentRow.className = 'dialogue-segment-row';
		segmentRow.setAttribute('data-segment-identifier', segmentItem.identifier);

		const segmentTag = document.createElement('span');
		segmentTag.className = 'dialogue-segment-type-tag';
		segmentTag.textContent = segmentItem.segmentType === 'parenthetical'
			? 'Regie (\\paren)'
			: 'Gesprochener Text';

		const segmentInput = document.createElement('textarea');
		segmentInput.className = 'block-textarea';
		segmentInput.rows = segmentItem.segmentType === 'parenthetical' ? 1 : 2;
		segmentInput.placeholder = segmentItem.segmentType === 'parenthetical'
			? 'z. B. flüsternd, zögert kurz (Klammern werden automatisch gesetzt)'
			: 'Was sagt die Figur?';
		segmentInput.value = segmentItem.text || '';
		segmentInput.setAttribute('data-segment-field', 'text');
		segmentInput.setAttribute('data-segment-identifier', segmentItem.identifier);

		const removeSegmentButton = document.createElement('button');
		removeSegmentButton.type = 'button';
		removeSegmentButton.className = 'button-danger';
		removeSegmentButton.setAttribute('data-action', 'delete-dialogue-segment');
		removeSegmentButton.setAttribute('data-segment-identifier', segmentItem.identifier);
		removeSegmentButton.setAttribute('aria-label', 'Dialogzeile entfernen');
		removeSegmentButton.textContent = '✕';

		segmentRow.appendChild(segmentTag);
		segmentRow.appendChild(segmentInput);
		if (segmentsList.length > 1) {
			segmentRow.appendChild(removeSegmentButton);
		}
		segmentsWrapper.appendChild(segmentRow);
	}

	const segmentActionsRow = document.createElement('div');
	segmentActionsRow.className = 'dialogue-segment-actions';

	const addSpeechButton = document.createElement('button');
	addSpeechButton.type = 'button';
	addSpeechButton.className = 'button-secondary';
	addSpeechButton.setAttribute('data-action', 'add-speech-segment');
	addSpeechButton.textContent = '+ Weiterer Sprechtext';

	const addParentheticalButton = document.createElement('button');
	addParentheticalButton.type = 'button';
	addParentheticalButton.className = 'button-secondary';
	addParentheticalButton.setAttribute('data-action', 'add-parenthetical-segment');
	addParentheticalButton.textContent = '+ Regieanweisung in Klammern (\\paren)';

	segmentActionsRow.appendChild(addSpeechButton);
	segmentActionsRow.appendChild(addParentheticalButton);
	segmentsWrapper.appendChild(segmentActionsRow);

	container.appendChild(segmentsWrapper);
	return container;
}

function createTransitionFieldsElement(blockItem) {
	const wrapper = document.createElement('div');
	wrapper.className = 'control-field-group';
	const labelElement = document.createElement('label');
	labelElement.className = 'field-label';
	labelElement.textContent = 'Schnitt-Übergang auswählen';
	const selectElement = document.createElement('select');
	selectElement.className = 'select-input';
	selectElement.setAttribute('data-block-field', 'transitionType');
	const transitionTypes = [
		'CUT TO:',
		'DISSOLVE TO:',
		'SMASH CUT TO:',
		'MATCH CUT TO:',
		'FADE TO BLACK.',
		'INTERCUT:'
	];
	for (const transitionValue of transitionTypes) {
		selectElement.appendChild(new Option(transitionValue, transitionValue));
	}
	selectElement.value = blockItem.transitionType || 'CUT TO:';
	wrapper.appendChild(labelElement);
	wrapper.appendChild(selectElement);
	return wrapper;
}

function createBlockCardElement(blockItem, blockIndex, totalBlockCount) {
	const blockCard = document.createElement('article');
	blockCard.className = 'screenplay-block-card';
	blockCard.setAttribute('role', 'listitem');
	blockCard.setAttribute('data-block-identifier', blockItem.identifier);
	blockCard.setAttribute('data-block-type', blockItem.type);

	const headerBar = document.createElement('div');
	headerBar.className = 'block-header-bar';

	const selectorGroup = document.createElement('div');
	selectorGroup.className = 'block-type-selector-group';

	const indexBadge = document.createElement('span');
	indexBadge.className = 'block-index-badge';
	indexBadge.textContent = '#' + String(blockIndex + 1);

	const typeSelect = document.createElement('select');
	typeSelect.className = 'select-input';
	typeSelect.setAttribute('data-action', 'change-block-type');
	typeSelect.setAttribute('aria-label', 'Baustein-Typ auswählen');
	const blockTypeOptions = [
		['scene_heading', '🎬 Szene / Schauplatz (INT. / EXT.)'],
		['action', '📝 Handlung (Action-Beschreibung)'],
		['dialogue', '💬 Dialog (Figur & Regieanweisung)'],
		['transition', '✂️ Schnitt-Übergang (Transition)']
	];
	for (const [typeKey, typeLabel] of blockTypeOptions) {
		typeSelect.appendChild(new Option(typeLabel, typeKey));
	}
	typeSelect.value = blockItem.type;

	selectorGroup.appendChild(indexBadge);
	selectorGroup.appendChild(typeSelect);

	const controlsGroup = document.createElement('div');
	controlsGroup.className = 'block-controls-group';

	const moveUpButton = document.createElement('button');
	moveUpButton.type = 'button';
	moveUpButton.className = 'button-secondary';
	moveUpButton.setAttribute('data-action', 'move-block-up');
	moveUpButton.disabled = blockIndex === 0;
	moveUpButton.textContent = '↑ Hoch';

	const moveDownButton = document.createElement('button');
	moveDownButton.type = 'button';
	moveDownButton.className = 'button-secondary';
	moveDownButton.setAttribute('data-action', 'move-block-down');
	moveDownButton.disabled = blockIndex === totalBlockCount - 1;
	moveDownButton.textContent = '↓ Runter';

	const insertBelowButton = document.createElement('button');
	insertBelowButton.type = 'button';
	insertBelowButton.className = 'button-secondary';
	insertBelowButton.setAttribute('data-action', 'insert-block-below');
	insertBelowButton.textContent = '+ Darunter einfügen';

	const deleteBlockButton = document.createElement('button');
	deleteBlockButton.type = 'button';
	deleteBlockButton.className = 'button-danger';
	deleteBlockButton.setAttribute('data-action', 'delete-block');
	deleteBlockButton.textContent = 'Löschen';

	controlsGroup.appendChild(moveUpButton);
	controlsGroup.appendChild(moveDownButton);
	controlsGroup.appendChild(insertBelowButton);
	controlsGroup.appendChild(deleteBlockButton);

	headerBar.appendChild(selectorGroup);
	headerBar.appendChild(controlsGroup);
	blockCard.appendChild(headerBar);

	if (blockItem.type === 'scene_heading') {
		blockCard.appendChild(createSceneHeadingFieldsElement(blockItem));
	} else if (blockItem.type === 'action') {
		blockCard.appendChild(createActionFieldsElement(blockItem));
	} else if (blockItem.type === 'dialogue') {
		blockCard.appendChild(createDialogueFieldsElement(blockItem));
	} else if (blockItem.type === 'transition') {
		blockCard.appendChild(createTransitionFieldsElement(blockItem));
	}

	return blockCard;
}

function renderEditorBlocksList(activeDocumentRecord) {
	const blocksContainer = document.getElementById('blocks-list-container');
	if (blocksContainer === null || activeDocumentRecord === null) {
		return;
	}
	blocksContainer.replaceChildren();
	const totalBlocks = activeDocumentRecord.blocks.length;
	for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex += 1) {
		const blockItem = activeDocumentRecord.blocks[blockIndex];
		blocksContainer.appendChild(createBlockCardElement(blockItem, blockIndex, totalBlocks));
	}
}

function renderActiveEditorView() {
	const activeDocumentRecord = getActiveDocumentRecord();
	if (activeDocumentRecord === null) {
		return;
	}

	document.getElementById('editor-document-title-input').value = activeDocumentRecord.title || '';
	document.getElementById('editor-document-author-input').value = activeDocumentRecord.author || '';
	document.getElementById('editor-document-address-input').value = activeDocumentRecord.address || '';
	document.getElementById('editor-include-title-page-checkbox').checked = Boolean(activeDocumentRecord.includeTitlePage);
	document.getElementById('editor-include-fade-in-checkbox').checked = Boolean(activeDocumentRecord.includeFadeIn);
	document.getElementById('editor-include-fade-out-checkbox').checked = Boolean(activeDocumentRecord.includeFadeOut);
	document.getElementById('editor-include-the-end-checkbox').checked = Boolean(activeDocumentRecord.includeTheEnd);

	renderEditorBlocksList(activeDocumentRecord);
	renderEditorMetricsAndPreview(activeDocumentRecord);
	updateSaveStatusBadge('Gespeichert: ' + formatIsoTimestampForDisplay(activeDocumentRecord.modificationTimestamp));
}

function switchWorkspaceView(targetViewName) {
	const dashboardSection = document.getElementById('dashboard-view-section');
	const editorSection = document.getElementById('editor-view-section');
	const backButton = document.getElementById('navigation-back-button');
	const editorToolbar = document.getElementById('editor-toolbar-actions');

	if (targetViewName === 'editor') {
		dashboardSection.classList.add('view-hidden');
		editorSection.classList.remove('view-hidden');
		backButton.classList.remove('button-hidden');
		editorToolbar.classList.remove('button-hidden');
		renderActiveEditorView();
	} else {
		applicationState.activeDocumentIdentifier = null;
		editorSection.classList.add('view-hidden');
		dashboardSection.classList.remove('view-hidden');
		backButton.classList.add('button-hidden');
		editorToolbar.classList.add('button-hidden');
		updateSaveStatusBadge('Alle Dokumente lokal synchronisiert');
		renderDashboardGrid();
	}
}

function convertBlockToNewType(existingBlock, targetType) {
	const newBlock = createDefaultBlockByType(targetType);
	newBlock.identifier = existingBlock.identifier;
	if (existingBlock.type === 'action' && targetType === 'dialogue' && existingBlock.content) {
		newBlock.segments[0].text = existingBlock.content;
	} else if (existingBlock.type === 'dialogue' && targetType === 'action') {
		const combinedSpeech = (existingBlock.segments || []).map(function extractText(segmentItem) {
			return segmentItem.text;
		}).join(' ');
		newBlock.content = combinedSpeech;
	}
	return newBlock;
}

function bindDashboardEvents() {
	const searchInput = document.getElementById('dashboard-search-input');
	const sortFieldSelect = document.getElementById('dashboard-sort-field-select');
	const sortDirectionSelect = document.getElementById('dashboard-sort-direction-select');
	const gridContainer = document.getElementById('document-grid-container');
	const exportBackupButton = document.getElementById('export-backup-button');
	const importBackupInput = document.getElementById('import-backup-file-input');

	searchInput.addEventListener('input', function handleSearchInput(eventObject) {
		executeWithErrorBoundary(function updateSearchState() {
			applicationState.searchQuery = eventObject.target.value;
			renderDashboardGrid();
		});
	});

	sortFieldSelect.addEventListener('change', function handleSortFieldChange(eventObject) {
		executeWithErrorBoundary(function updateSortFieldState() {
			applicationState.sortField = eventObject.target.value;
			renderDashboardGrid();
		});
	});

	sortDirectionSelect.addEventListener('change', function handleSortDirectionChange(eventObject) {
		executeWithErrorBoundary(function updateSortDirectionState() {
			applicationState.sortDirection = eventObject.target.value;
			renderDashboardGrid();
		});
	});

	gridContainer.addEventListener('click', function handleGridClick(eventObject) {
		executeWithErrorBoundary(function processGridAction() {
			const actionButton = eventObject.target.closest('[data-action]');
			if (actionButton === null) {
				return;
			}
			const actionName = actionButton.getAttribute('data-action');
			const targetIdentifier = actionButton.getAttribute('data-document-identifier');

			if (actionName === 'create-new-document') {
				const createdDocument = createEmptyDocumentRecord();
				applicationState.documents.push(createdDocument);
				applicationState.activeDocumentIdentifier = createdDocument.identifier;
				persistStateAndTouchActiveDocument(createdDocument);
				switchWorkspaceView('editor');
				return;
			}

			if (actionName === 'open-document' && targetIdentifier) {
				applicationState.activeDocumentIdentifier = targetIdentifier;
				switchWorkspaceView('editor');
				return;
			}

			if (actionName === 'duplicate-document' && targetIdentifier) {
				const originalDocument = applicationState.documents.find(function findOriginal(documentItem) {
					return documentItem.identifier === targetIdentifier;
				});
				if (originalDocument) {
					const currentTimestamp = getCurrentIsoTimestamp();
					const duplicatedDocument = JSON.parse(JSON.stringify(originalDocument));
					duplicatedDocument.identifier = generateUniqueIdentifier();
					duplicatedDocument.title = (originalDocument.title || 'Drehbuch') + ' (Kopie)';
					duplicatedDocument.creationTimestamp = currentTimestamp;
					duplicatedDocument.modificationTimestamp = currentTimestamp;
					applicationState.documents.push(duplicatedDocument);
					saveDocumentCollectionToLocalStorage(applicationState.documents);
					renderDashboardGrid();
					displayNotificationToast('Drehbuch wurde dupliziert.');
				}
				return;
			}

			if (actionName === 'delete-document' && targetIdentifier) {
				applicationState.documents = applicationState.documents.filter(function keepRemaining(documentItem) {
					return documentItem.identifier !== targetIdentifier;
				});
				saveDocumentCollectionToLocalStorage(applicationState.documents);
				renderDashboardGrid();
				displayNotificationToast('Drehbuch wurde gelöscht.');
			}
		});
	});

	exportBackupButton.addEventListener('click', function handleBackupExport() {
		executeWithErrorBoundary(function exportAllDocuments() {
			const serializedBackup = JSON.stringify(applicationState.documents, null, '\t');
			triggerFileDownload('scriptbridge-drehbuch-backup.json', serializedBackup, 'application/json');
			displayNotificationToast('JSON-Backup erfolgreich heruntergeladen.');
		});
	});

	importBackupInput.addEventListener('change', function handleBackupImport(eventObject) {
		const selectedFile = eventObject.target.files && eventObject.target.files[0];
		if (!selectedFile) {
			return;
		}
		const fileReader = new FileReader();
		fileReader.onload = function processLoadedFile(loadEvent) {
			executeWithErrorBoundary(function restoreDocumentsFromBackup() {
				const importedDocuments = JSON.parse(String(loadEvent.target.result));
				if (!Array.isArray(importedDocuments)) {
					throw new Error('Die Backup-Datei enthaelt keine gueltige Dokumentenliste.');
				}
				for (const importedItem of importedDocuments) {
					validateDocumentRecord(importedItem);
				}
				applicationState.documents = importedDocuments;
				saveDocumentCollectionToLocalStorage(applicationState.documents);
				renderDashboardGrid();
				displayNotificationToast('Backup erfolgreich wiederhergestellt.');
			});
		};
		fileReader.readAsText(selectedFile);
	});
}

function bindEditorEvents() {
	const backButton = document.getElementById('navigation-back-button');
	const titleInput = document.getElementById('editor-document-title-input');
	const authorInput = document.getElementById('editor-document-author-input');
	const addressInput = document.getElementById('editor-document-address-input');
	const titlePageCheckbox = document.getElementById('editor-include-title-page-checkbox');
	const fadeInCheckbox = document.getElementById('editor-include-fade-in-checkbox');
	const fadeOutCheckbox = document.getElementById('editor-include-fade-out-checkbox');
	const theEndCheckbox = document.getElementById('editor-include-the-end-checkbox');
	const blocksContainer = document.getElementById('blocks-list-container');

	backButton.addEventListener('click', function handleBackNavigation() {
		executeWithErrorBoundary(function returnToDashboard() {
			switchWorkspaceView('dashboard');
		});
	});

	function handleMetadataModification() {
		executeWithErrorBoundary(function saveMetadataFields() {
			const activeDocumentRecord = getActiveDocumentRecord();
			if (activeDocumentRecord === null) {
				return;
			}
			activeDocumentRecord.title = titleInput.value;
			activeDocumentRecord.author = authorInput.value;
			activeDocumentRecord.address = addressInput.value;
			activeDocumentRecord.includeTitlePage = titlePageCheckbox.checked;
			activeDocumentRecord.includeFadeIn = fadeInCheckbox.checked;
			activeDocumentRecord.includeFadeOut = fadeOutCheckbox.checked;
			activeDocumentRecord.includeTheEnd = theEndCheckbox.checked;
			persistStateAndTouchActiveDocument(activeDocumentRecord);
			renderEditorMetricsAndPreview(activeDocumentRecord);
		});
	}

	titleInput.addEventListener('input', handleMetadataModification);
	authorInput.addEventListener('input', handleMetadataModification);
	addressInput.addEventListener('input', handleMetadataModification);
	titlePageCheckbox.addEventListener('change', handleMetadataModification);
	fadeInCheckbox.addEventListener('change', handleMetadataModification);
	fadeOutCheckbox.addEventListener('change', handleMetadataModification);
	theEndCheckbox.addEventListener('change', handleMetadataModification);

	blocksContainer.addEventListener('input', function handleBlockFieldInput(eventObject) {
		executeWithErrorBoundary(function updateBlockFieldValue() {
			const activeDocumentRecord = getActiveDocumentRecord();
			if (activeDocumentRecord === null) {
				return;
			}
			const blockCard = eventObject.target.closest('[data-block-identifier]');
			if (blockCard === null) {
				return;
			}
			const blockIdentifier = blockCard.getAttribute('data-block-identifier');
			const targetBlock = activeDocumentRecord.blocks.find(function findMatchingBlock(blockItem) {
				return blockItem.identifier === blockIdentifier;
			});
			if (!targetBlock) {
				return;
			}

			const fieldName = eventObject.target.getAttribute('data-block-field');
			if (fieldName) {
				targetBlock[fieldName] = eventObject.target.value;
				persistStateAndTouchActiveDocument(activeDocumentRecord);
				renderEditorMetricsAndPreview(activeDocumentRecord);
				return;
			}

			const segmentFieldName = eventObject.target.getAttribute('data-segment-field');
			const segmentIdentifier = eventObject.target.getAttribute('data-segment-identifier');
			if (segmentFieldName && segmentIdentifier && Array.isArray(targetBlock.segments)) {
				const targetSegment = targetBlock.segments.find(function findSegment(segmentItem) {
					return segmentItem.identifier === segmentIdentifier;
				});
				if (targetSegment) {
					targetSegment[segmentFieldName] = eventObject.target.value;
					persistStateAndTouchActiveDocument(activeDocumentRecord);
					renderEditorMetricsAndPreview(activeDocumentRecord);
				}
			}
		});
	});

	blocksContainer.addEventListener('change', function handleBlockSelectionChange(eventObject) {
		executeWithErrorBoundary(function processBlockChange() {
			const activeDocumentRecord = getActiveDocumentRecord();
			if (activeDocumentRecord === null) {
				return;
			}
			const blockCard = eventObject.target.closest('[data-block-identifier]');
			if (blockCard === null) {
				return;
			}
			const blockIdentifier = blockCard.getAttribute('data-block-identifier');
			const blockIndex = activeDocumentRecord.blocks.findIndex(function findIndex(blockItem) {
				return blockItem.identifier === blockIdentifier;
			});
			if (blockIndex === -1) {
				return;
			}

			if (eventObject.target.getAttribute('data-action') === 'change-block-type') {
				const selectedType = eventObject.target.value;
				activeDocumentRecord.blocks[blockIndex] = convertBlockToNewType(activeDocumentRecord.blocks[blockIndex], selectedType);
				persistStateAndTouchActiveDocument(activeDocumentRecord);
				renderEditorBlocksList(activeDocumentRecord);
				renderEditorMetricsAndPreview(activeDocumentRecord);
			}
		});
	});

	blocksContainer.addEventListener('click', function handleBlockButtonActions(eventObject) {
		executeWithErrorBoundary(function executeBlockAction() {
			const actionButton = eventObject.target.closest('[data-action]');
			if (actionButton === null) {
				return;
			}
			const actionName = actionButton.getAttribute('data-action');
			if (actionName === 'change-block-type') {
				return;
			}

			const activeDocumentRecord = getActiveDocumentRecord();
			if (activeDocumentRecord === null) {
				return;
			}
			const blockCard = actionButton.closest('[data-block-identifier]');
			if (blockCard === null) {
				return;
			}
			const blockIdentifier = blockCard.getAttribute('data-block-identifier');
			const blockIndex = activeDocumentRecord.blocks.findIndex(function findBlockIndex(blockItem) {
				return blockItem.identifier === blockIdentifier;
			});
			if (blockIndex === -1) {
				return;
			}
			const currentBlock = activeDocumentRecord.blocks[blockIndex];

			if (actionName === 'move-block-up') {
				activeDocumentRecord.blocks = reorderArrayElements(activeDocumentRecord.blocks, blockIndex, blockIndex - 1);
			} else if (actionName === 'move-block-down') {
				activeDocumentRecord.blocks = reorderArrayElements(activeDocumentRecord.blocks, blockIndex, blockIndex + 1);
			} else if (actionName === 'insert-block-below') {
				const logicalNextType = currentBlock.type === 'scene_heading' ? 'action' : 'dialogue';
				const newBlock = createDefaultBlockByType(logicalNextType);
				activeDocumentRecord.blocks.splice(blockIndex + 1, 0, newBlock);
			} else if (actionName === 'delete-block') {
				activeDocumentRecord.blocks.splice(blockIndex, 1);
				if (activeDocumentRecord.blocks.length === 0) {
					activeDocumentRecord.blocks.push(createDefaultBlockByType('scene_heading'));
				}
			} else if (actionName === 'add-speech-segment' && Array.isArray(currentBlock.segments)) {
				currentBlock.segments.push({
					identifier: generateUniqueIdentifier(),
					segmentType: 'speech',
					text: ''
				});
			} else if (actionName === 'add-parenthetical-segment' && Array.isArray(currentBlock.segments)) {
				currentBlock.segments.push({
					identifier: generateUniqueIdentifier(),
					segmentType: 'parenthetical',
					text: ''
				});
			} else if (actionName === 'delete-dialogue-segment' && Array.isArray(currentBlock.segments)) {
				const segmentIdentifier = actionButton.getAttribute('data-segment-identifier');
				currentBlock.segments = currentBlock.segments.filter(function keepSegment(segmentItem) {
					return segmentItem.identifier !== segmentIdentifier;
				});
			}

			persistStateAndTouchActiveDocument(activeDocumentRecord);
			renderEditorBlocksList(activeDocumentRecord);
			renderEditorMetricsAndPreview(activeDocumentRecord);
		});
	});

	const addButtons = document.querySelectorAll('[data-add-block-type]');
	for (const buttonElement of addButtons) {
		buttonElement.addEventListener('click', function handleAddBlockAtEnd() {
			executeWithErrorBoundary(function appendBlock() {
				const activeDocumentRecord = getActiveDocumentRecord();
				if (activeDocumentRecord === null) {
					return;
				}
				const targetBlockType = buttonElement.getAttribute('data-add-block-type');
				activeDocumentRecord.blocks.push(createDefaultBlockByType(targetBlockType));
				persistStateAndTouchActiveDocument(activeDocumentRecord);
				renderEditorBlocksList(activeDocumentRecord);
				renderEditorMetricsAndPreview(activeDocumentRecord);
			});
		});
	}
}

function bindToolbarAndModalEvents() {
	const overleafButton = document.getElementById('open-in-overleaf-button');
	const togglePreviewButton = document.getElementById('toggle-preview-drawer-button');
	const previewDrawer = document.getElementById('preview-drawer-panel');
	const editorGrid = document.querySelector('.editor-layout-grid');
	const tabManuscript = document.getElementById('tab-button-manuscript');
	const tabLatex = document.getElementById('tab-button-latex');
	const manuscriptPanel = document.getElementById('manuscript-preview-container');
	const latexPanel = document.getElementById('latex-source-preview-container');
	const copyLatexButton = document.getElementById('copy-latex-code-button');
	const downloadLatexButton = document.getElementById('download-latex-file-button');
	const copyPromptButton = document.getElementById('copy-artificial-intelligence-prompt-button');
	const openSmartImportButton = document.getElementById('open-smart-import-button');
	const smartImportDialog = document.getElementById('smart-import-modal-dialog');
	const closeSmartImportButton = document.getElementById('close-smart-import-modal-button');
	const cancelSmartImportButton = document.getElementById('cancel-smart-import-button');
	const confirmSmartImportButton = document.getElementById('confirm-smart-import-button');
	const smartImportTextarea = document.getElementById('smart-import-textarea');
	const themeSwitcherButton = document.getElementById('theme-switcher-button');

	overleafButton.addEventListener('click', function handleOpenInOverleaf() {
		executeWithErrorBoundary(function sendToOverleaf() {
			const activeDocumentRecord = getActiveDocumentRecord();
			if (activeDocumentRecord === null) {
				return;
			}
			const compiledLatex = compileDocumentToLatexSource(activeDocumentRecord);
			submitLatexToOverleafForm(activeDocumentRecord.title, compiledLatex);
			displayNotificationToast('Drehbuch wird in neuem Tab an Overleaf übergeben...');
		});
	});

	togglePreviewButton.addEventListener('click', function handleTogglePreview() {
		applicationState.isPreviewDrawerOpen = !applicationState.isPreviewDrawerOpen;
		togglePreviewButton.setAttribute('aria-expanded', String(applicationState.isPreviewDrawerOpen));
		if (applicationState.isPreviewDrawerOpen) {
			previewDrawer.classList.remove('drawer-hidden');
			editorGrid.classList.add('preview-open');
		} else {
			previewDrawer.classList.add('drawer-hidden');
			editorGrid.classList.remove('preview-open');
		}
	});

	tabManuscript.addEventListener('click', function handleSelectManuscriptTab() {
		tabManuscript.classList.add('tab-active');
		tabManuscript.setAttribute('aria-selected', 'true');
		tabLatex.classList.remove('tab-active');
		tabLatex.setAttribute('aria-selected', 'false');
		manuscriptPanel.classList.remove('view-hidden');
		latexPanel.classList.add('view-hidden');
	});

	tabLatex.addEventListener('click', function handleSelectLatexTab() {
		tabLatex.classList.add('tab-active');
		tabLatex.setAttribute('aria-selected', 'true');
		tabManuscript.classList.remove('tab-active');
		tabManuscript.setAttribute('aria-selected', 'false');
		latexPanel.classList.remove('view-hidden');
		manuscriptPanel.classList.add('view-hidden');
	});

	copyLatexButton.addEventListener('click', function handleCopyLatex() {
		executeWithErrorBoundary(function copyLatexToClipboard() {
			const activeDocumentRecord = getActiveDocumentRecord();
			if (activeDocumentRecord === null) {
				return;
			}
			const compiledLatex = compileDocumentToLatexSource(activeDocumentRecord);
			navigator.clipboard.writeText(compiledLatex);
			displayNotificationToast('LaTeX-Code in die Zwischenablage kopiert.');
		});
	});

	downloadLatexButton.addEventListener('click', function handleDownloadLatex() {
		executeWithErrorBoundary(function downloadTexFile() {
			const activeDocumentRecord = getActiveDocumentRecord();
			if (activeDocumentRecord === null) {
				return;
			}
			const compiledLatex = compileDocumentToLatexSource(activeDocumentRecord);
			triggerFileDownload((activeDocumentRecord.title || 'drehbuch') + '.tex', compiledLatex, 'text/x-tex');
			displayNotificationToast('.tex-Datei heruntergeladen.');
		});
	});

	copyPromptButton.addEventListener('click', function handleCopyPrompt() {
		executeWithErrorBoundary(function copyPromptToClipboard() {
			const promptText = buildArtificialIntelligenceSystemPrompt();
			navigator.clipboard.writeText(promptText);
			displayNotificationToast('KI-Prompt-Vorlage kopiert! Einfach in ChatGPT oder Claude einfügen.');
		});
	});

	openSmartImportButton.addEventListener('click', function handleOpenSmartImport() {
		smartImportTextarea.value = '';
		smartImportDialog.showModal();
	});

	function closeSmartImportModal() {
		smartImportDialog.close();
	}

	closeSmartImportButton.addEventListener('click', closeSmartImportModal);
	cancelSmartImportButton.addEventListener('click', closeSmartImportModal);

	confirmSmartImportButton.addEventListener('click', function handleConfirmSmartImport() {
		executeWithErrorBoundary(function convertAndAppendBlocks() {
			const activeDocumentRecord = getActiveDocumentRecord();
			if (activeDocumentRecord === null) {
				return;
			}
			const importedBlocks = parseArtificialIntelligenceTextIntoBlocks(
				smartImportTextarea.value,
				generateUniqueIdentifier
			);
			activeDocumentRecord.blocks.push(...importedBlocks);
			persistStateAndTouchActiveDocument(activeDocumentRecord);
			renderEditorBlocksList(activeDocumentRecord);
			renderEditorMetricsAndPreview(activeDocumentRecord);
			closeSmartImportModal();
			displayNotificationToast(String(importedBlocks.length) + ' Blöcke aus dem KI-Text erkannt und eingefügt.');
		});
	});

	themeSwitcherButton.addEventListener('click', function handleCycleTheme() {
		const cycleOrder = ['system', 'light', 'dark'];
		const currentIndex = cycleOrder.indexOf(applicationState.themePreference);
		const nextTheme = cycleOrder[(currentIndex + 1) % cycleOrder.length];
		applyThemePreference(nextTheme);
	});
}

function initializeApplication() {
	executeWithErrorBoundary(function bootstrapApplicationState() {
		applicationState.documents = loadDocumentCollectionFromLocalStorage();
		const savedTheme = loadThemePreferenceFromLocalStorage();
		applyThemePreference(savedTheme);
		bindDashboardEvents();
		bindEditorEvents();
		bindToolbarAndModalEvents();
		switchWorkspaceView('dashboard');
	});
}

initializeApplication();