import {
	collectCharacterNamesFromDocument,
	countSceneHeadingsInDocument,
	filterAndSortDocumentList,
	moveArrayElementByIndex,
	validateDocumentStructure
} from './domain-logic.js';

import {
	generateLatexDocumentSource,
	getStandardPromptForArtificialIntelligence,
	parseRawScriptTextIntoBlocks
} from './latex-generator.js';

import {
	buildBlankDocumentRecord,
	buildEmptyBlockByType,
	createCurrentIsoTimestamp,
	createUniqueIdentifier,
	downloadTextAsFile,
	formatTimestampForHumanDisplay,
	postLatexToOverleaf,
	readDocumentsFromLocalStorage,
	readThemeFromLocalStorage,
	writeDocumentsToLocalStorage,
	writeThemeToLocalStorage
} from './storage-service.js';

const workspaceState = {
	documents: [],
	activeDocumentIdentifier: null,
	searchQuery: '',
	sortCriterion: 'modificationTimestamp',
	sortDirection: 'descending',
	openCardMenuIdentifier: null,
	themeMode: 'system'
};

function showNotificationToast(messageText) {
	const containerElement = document.getElementById('toast-container');
	if (containerElement === null) {
		return;
	}
	const toastNode = document.createElement('div');
	toastNode.className = 'toast-message';
	toastNode.textContent = messageText;
	containerElement.appendChild(toastNode);
	window.setTimeout(function removeToastNode() {
		if (toastNode.parentNode === containerElement) {
			containerElement.removeChild(toastNode);
		}
	}, 2800);
}

function runSafely(actionCallback) {
	try {
		actionCallback();
	} catch (caughtError) {
		const message = caughtError instanceof Error ? caughtError.message : 'Unerwarteter Fehler';
		showNotificationToast(message);
	}
}

function getCurrentlyOpenDocument() {
	if (workspaceState.activeDocumentIdentifier === null) {
		return null;
	}
	return workspaceState.documents.find(function matchByIdentifier(documentItem) {
		return documentItem.identifier === workspaceState.activeDocumentIdentifier;
	}) || null;
}

function saveAndTouchActiveDocument(activeDocument) {
	if (activeDocument !== null) {
		activeDocument.modificationTimestamp = createCurrentIsoTimestamp();
		validateDocumentStructure(activeDocument);
	}
	writeDocumentsToLocalStorage(workspaceState.documents);
	const saveIndicator = document.getElementById('save-timestamp-indicator');
	if (saveIndicator !== null && activeDocument !== null) {
		saveIndicator.textContent = '✓ Gespeichert (' + formatTimestampForHumanDisplay(activeDocument.modificationTimestamp) + ')';
	}
}

function applyThemeMode(themeMode) {
	workspaceState.themeMode = themeMode;
	document.documentElement.setAttribute('data-theme', themeMode);
	writeThemeToLocalStorage(themeMode);
}

function buildCreateNewSheetElement() {
	const wrapperItem = document.createElement('div');
	wrapperItem.className = 'sheet-card';
	wrapperItem.setAttribute('role', 'listitem');

	const buttonElement = document.createElement('button');
	buttonElement.type = 'button';
	buttonElement.className = 'sheet-card-button';
	buttonElement.setAttribute('data-dashboard-action', 'create-document');

	const paperVisual = document.createElement('div');
	paperVisual.className = 'sheet-paper-visual sheet-paper-create';
	const plusCircle = document.createElement('span');
	plusCircle.className = 'plus-icon-circle';
	plusCircle.setAttribute('aria-hidden', 'true');
	plusCircle.textContent = '+';
	paperVisual.appendChild(plusCircle);

	const captionBox = document.createElement('div');
	captionBox.className = 'sheet-caption';
	const titleText = document.createElement('span');
	titleText.className = 'sheet-title';
	titleText.textContent = 'Neues Drehbuch';
	const subText = document.createElement('span');
	subText.className = 'sheet-timestamp';
	subText.textContent = 'Leeres Blatt öffnen';
	captionBox.appendChild(titleText);
	captionBox.appendChild(subText);

	buttonElement.appendChild(paperVisual);
	buttonElement.appendChild(captionBox);
	wrapperItem.appendChild(buttonElement);
	return wrapperItem;
}

function buildDocumentSheetElement(documentRecord) {
	const sceneCount = countSceneHeadingsInDocument(documentRecord);
	const cardWrapper = document.createElement('div');
	cardWrapper.className = 'sheet-card';
	cardWrapper.setAttribute('role', 'listitem');

	const openButton = document.createElement('button');
	openButton.type = 'button';
	openButton.className = 'sheet-card-button';
	openButton.setAttribute('data-dashboard-action', 'open-document');
	openButton.setAttribute('data-document-identifier', documentRecord.identifier);

	const paperVisual = document.createElement('div');
	paperVisual.className = 'sheet-paper-visual';

	const linesBox = document.createElement('div');
	linesBox.className = 'sheet-mini-lines';
	linesBox.setAttribute('aria-hidden', 'true');
	const slugLine = document.createElement('span');
	slugLine.className = 'mini-line mini-line-slug';
	const actionLineOne = document.createElement('span');
	actionLineOne.className = 'mini-line';
	const actionLineTwo = document.createElement('span');
	actionLineTwo.className = 'mini-line';
	const dialogueLine = document.createElement('span');
	dialogueLine.className = 'mini-line mini-line-dialogue';
	linesBox.appendChild(slugLine);
	linesBox.appendChild(actionLineOne);
	linesBox.appendChild(actionLineTwo);
	linesBox.appendChild(dialogueLine);

	const sceneBadge = document.createElement('span');
	sceneBadge.className = 'sheet-scene-badge';
	sceneBadge.textContent = sceneCount + (sceneCount === '1' ? ' Szene' : ' Szenen');

	paperVisual.appendChild(linesBox);
	paperVisual.appendChild(sceneBadge);

	const captionBox = document.createElement('div');
	captionBox.className = 'sheet-caption';
	const titleSpan = document.createElement('span');
	titleSpan.className = 'sheet-title';
	titleSpan.textContent = documentRecord.title || 'Unbetiteltes Drehbuch';

	const modifiedSpan = document.createElement('span');
	modifiedSpan.className = 'sheet-timestamp';
	const dateToDisplay = workspaceState.sortCriterion === 'creationTimestamp'
		? 'Erstellt: ' + formatTimestampForHumanDisplay(documentRecord.creationTimestamp)
		: formatTimestampForHumanDisplay(documentRecord.modificationTimestamp);
	modifiedSpan.textContent = dateToDisplay;

	captionBox.appendChild(titleSpan);
	captionBox.appendChild(modifiedSpan);

	openButton.appendChild(paperVisual);
	openButton.appendChild(captionBox);

	const menuTriggerButton = document.createElement('button');
	menuTriggerButton.type = 'button';
	menuTriggerButton.className = 'sheet-menu-trigger';
	menuTriggerButton.setAttribute('data-dashboard-action', 'toggle-card-menu');
	menuTriggerButton.setAttribute('data-document-identifier', documentRecord.identifier);
	menuTriggerButton.setAttribute('aria-label', 'Optionen für ' + (documentRecord.title || 'Drehbuch'));
	const isMenuOpen = workspaceState.openCardMenuIdentifier === documentRecord.identifier;
	menuTriggerButton.setAttribute('aria-expanded', String(isMenuOpen));
	menuTriggerButton.textContent = '⋯';

	cardWrapper.appendChild(openButton);
	cardWrapper.appendChild(menuTriggerButton);

	if (isMenuOpen) {
		const dropdownMenu = document.createElement('div');
		dropdownMenu.className = 'dropdown-menu';
		dropdownMenu.setAttribute('role', 'menu');

		const duplicateItem = document.createElement('button');
		duplicateItem.type = 'button';
		duplicateItem.className = 'dropdown-item';
		duplicateItem.setAttribute('data-dashboard-action', 'duplicate-document');
		duplicateItem.setAttribute('data-document-identifier', documentRecord.identifier);
		duplicateItem.textContent = 'Duplizieren';

		const deleteItem = document.createElement('button');
		deleteItem.type = 'button';
		deleteItem.className = 'dropdown-item dropdown-item-danger';
		deleteItem.setAttribute('data-dashboard-action', 'delete-document');
		deleteItem.setAttribute('data-document-identifier', documentRecord.identifier);
		deleteItem.textContent = 'Löschen';

		dropdownMenu.appendChild(duplicateItem);
		dropdownMenu.appendChild(deleteItem);
		cardWrapper.appendChild(dropdownMenu);
	}

	return cardWrapper;
}

function renderDashboardGrid() {
	const gridElement = document.getElementById('documents-grid');
	if (gridElement === null) {
		return;
	}
	gridElement.replaceChildren();
	gridElement.appendChild(buildCreateNewSheetElement());

	const sortedDocuments = filterAndSortDocumentList(
		workspaceState.documents,
		workspaceState.searchQuery,
		workspaceState.sortCriterion,
		workspaceState.sortDirection
	);

	for (const documentItem of sortedDocuments) {
		gridElement.appendChild(buildDocumentSheetElement(documentItem));
	}
}

function refreshCharacterAutocompleteList(activeDocument) {
	const datalistNode = document.getElementById('existing-characters-datalist');
	if (datalistNode === null || activeDocument === null) {
		return;
	}
	datalistNode.replaceChildren();
	const characterNames = collectCharacterNamesFromDocument(activeDocument);
	for (const characterName of characterNames) {
		const optionNode = document.createElement('option');
		optionNode.value = characterName;
		datalistNode.appendChild(optionNode);
	}
}

function buildSceneBlockContent(blockItem) {
	const barRow = document.createElement('div');
	barRow.className = 'scene-bar-row';

	const environmentSelect = document.createElement('select');
	environmentSelect.className = 'scene-env-select';
	environmentSelect.setAttribute('data-field-name', 'environment');
	environmentSelect.setAttribute('aria-label', 'Innen oder Außen');
	environmentSelect.appendChild(new Option('INT.', 'INT'));
	environmentSelect.appendChild(new Option('EXT.', 'EXT'));
	environmentSelect.value = blockItem.environment === 'EXT' ? 'EXT' : 'INT';

	const locationInput = document.createElement('input');
	locationInput.type = 'text';
	locationInput.className = 'scene-location-input';
	locationInput.placeholder = 'SCHAUPLATZ (Z. B. LABOR)';
	locationInput.value = blockItem.location || '';
	locationInput.setAttribute('data-field-name', 'location');
	locationInput.setAttribute('aria-label', 'Schauplatz');

	const dashSpan = document.createElement('span');
	dashSpan.className = 'scene-separator';
	dashSpan.textContent = '—';

	const timeInput = document.createElement('input');
	timeInput.type = 'text';
	timeInput.className = 'scene-time-input';
	timeInput.setAttribute('list', 'standard-times-datalist');
	timeInput.placeholder = 'DAY';
	timeInput.value = blockItem.timeOfDay || '';
	timeInput.setAttribute('data-field-name', 'timeOfDay');
	timeInput.setAttribute('aria-label', 'Tageszeit');

	barRow.appendChild(environmentSelect);
	barRow.appendChild(locationInput);
	barRow.appendChild(dashSpan);
	barRow.appendChild(timeInput);
	return barRow;
}

function buildActionBlockContent(blockItem) {
	const actionTextarea = document.createElement('textarea');
	actionTextarea.className = 'action-textarea';
	actionTextarea.rows = 2;
	actionTextarea.placeholder = 'Handlung beschreiben...';
	actionTextarea.value = blockItem.content || '';
	actionTextarea.setAttribute('data-field-name', 'content');
	actionTextarea.setAttribute('aria-label', 'Handlung');
	return actionTextarea;
}

function buildDialogueBlockContent(blockItem) {
	const columnBox = document.createElement('div');
	columnBox.className = 'dialogue-column';

	const speakerRow = document.createElement('div');
	speakerRow.className = 'dialogue-speaker-row';

	const speakerInput = document.createElement('input');
	speakerInput.type = 'text';
	speakerInput.className = 'dialogue-speaker-input';
	speakerInput.setAttribute('list', 'existing-characters-datalist');
	speakerInput.placeholder = 'FIGURENNAME';
	speakerInput.value = blockItem.speaker || '';
	speakerInput.setAttribute('data-field-name', 'speaker');
	speakerInput.setAttribute('aria-label', 'Sprechende Figur');

	const modifierSelect = document.createElement('select');
	modifierSelect.className = 'dialogue-modifier-select';
	modifierSelect.setAttribute('data-field-name', 'modifier');
	modifierSelect.setAttribute('aria-label', 'Stimm-Zusatz');
	const modifierChoices = [
		['', ''],
		['V.O.', '(V.O.)'],
		['O.S.', '(O.S.)'],
		['CONT\'D', '(CONT\'D)'],
		['FILTERED', '(FILTERED)']
	];
	for (const [valueCode, displayLabel] of modifierChoices) {
		modifierSelect.appendChild(new Option(displayLabel || '+ Zusatz', valueCode));
	}
	modifierSelect.value = blockItem.modifier || '';

	speakerRow.appendChild(speakerInput);
	speakerRow.appendChild(modifierSelect);
	columnBox.appendChild(speakerRow);

	const segmentsArray = Array.isArray(blockItem.segments) ? blockItem.segments : [];
	for (const segmentItem of segmentsArray) {
		const segmentRow = document.createElement('div');
		segmentRow.className = 'dialogue-segment-item';

		if (segmentItem.segmentType === 'parenthetical') {
			const parenBox = document.createElement('div');
			parenBox.className = 'dialogue-parenthetical-wrapper';
			const openParen = document.createElement('span');
			openParen.className = 'parenthesis-char';
			openParen.textContent = '(';
			const parenInput = document.createElement('textarea');
			parenInput.className = 'dialogue-line-textarea';
			parenInput.rows = 1;
			parenInput.placeholder = 'Regieanweisung, z. B. flüsternd';
			parenInput.value = segmentItem.text || '';
			parenInput.setAttribute('data-segment-identifier', segmentItem.identifier);
			const closeParen = document.createElement('span');
			closeParen.className = 'parenthesis-char';
			closeParen.textContent = ')';
			parenBox.appendChild(openParen);
			parenBox.appendChild(parenInput);
			parenBox.appendChild(closeParen);
			segmentRow.appendChild(parenBox);
		} else {
			const speechInput = document.createElement('textarea');
			speechInput.className = 'dialogue-line-textarea';
			speechInput.rows = 2;
			speechInput.placeholder = 'Gesprochener Text...';
			speechInput.value = segmentItem.text || '';
			speechInput.setAttribute('data-segment-identifier', segmentItem.identifier);
			segmentRow.appendChild(speechInput);
		}

		if (segmentsArray.length > 1) {
			const removeSegmentBtn = document.createElement('button');
			removeSegmentBtn.type = 'button';
			removeSegmentBtn.className = 'segment-remove-button';
			removeSegmentBtn.setAttribute('data-block-action', 'remove-segment');
			removeSegmentBtn.setAttribute('data-segment-identifier', segmentItem.identifier);
			removeSegmentBtn.setAttribute('aria-label', 'Zeile entfernen');
			removeSegmentBtn.textContent = '✕';
			segmentRow.appendChild(removeSegmentBtn);
		}

		columnBox.appendChild(segmentRow);
	}

	const subToolbar = document.createElement('div');
	subToolbar.className = 'dialogue-context-Subtoolbar';

	const addParentheticalButton = document.createElement('button');
	addParentheticalButton.type = 'button';
	addParentheticalButton.className = 'subtle-text-button';
	addParentheticalButton.setAttribute('data-block-action', 'add-parenthetical');
	addParentheticalButton.textContent = '+ Regieanweisung (Klammer)';

	const addSpeechButton = document.createElement('button');
	addSpeechButton.type = 'button';
	addSpeechButton.className = 'subtle-text-button';
	addSpeechButton.setAttribute('data-block-action', 'add-speech');
	addSpeechButton.textContent = '+ Sprechabsatz';

	subToolbar.appendChild(addParentheticalButton);
	subToolbar.appendChild(addSpeechButton);
	columnBox.appendChild(subToolbar);

	return columnBox;
}

function buildTransitionBlockContent(blockItem) {
	const rowElement = document.createElement('div');
	rowElement.className = 'transition-row';

	const selectElement = document.createElement('select');
	selectElement.className = 'transition-select';
	selectElement.setAttribute('data-field-name', 'transitionType');
	selectElement.setAttribute('aria-label', 'Schnitt-Übergang');
	const transitionChoices = [
		'CUT TO:',
		'DISSOLVE TO:',
		'SMASH CUT TO:',
		'MATCH CUT TO:',
		'FADE TO BLACK.'
	];
	for (const transitionChoice of transitionChoices) {
		selectElement.appendChild(new Option(transitionChoice, transitionChoice));
	}
	selectElement.value = blockItem.transitionType || 'CUT TO:';
	rowElement.appendChild(selectElement);
	return rowElement;
}

function buildManuscriptBlockElement(blockItem, blockIndex, totalBlocks) {
	const blockArticle = document.createElement('article');
	blockArticle.className = 'script-block';
	blockArticle.setAttribute('role', 'listitem');
	blockArticle.setAttribute('data-block-identifier', blockItem.identifier);

	const hoverRail = document.createElement('div');
	hoverRail.className = 'block-hover-rail';

	const railLeft = document.createElement('div');
	railLeft.className = 'rail-left';

	const typeSelect = document.createElement('select');
	typeSelect.className = 'block-type-pill-select';
	typeSelect.setAttribute('data-block-action', 'change-type');
	typeSelect.setAttribute('aria-label', 'Abschnittstyp wechseln');
	const typeOptions = [
		['scene_heading', 'Szene (INT./EXT.)'],
		['action', 'Handlung'],
		['dialogue', 'Dialog'],
		['transition', 'Übergang']
	];
	for (const [typeKey, typeLabel] of typeOptions) {
		typeSelect.appendChild(new Option(typeLabel, typeKey));
	}
	typeSelect.value = blockItem.type;

	const moveUpBtn = document.createElement('button');
	moveUpBtn.type = 'button';
	moveUpBtn.className = 'rail-mini-button';
	moveUpBtn.setAttribute('data-block-action', 'move-up');
	moveUpBtn.disabled = blockIndex === 0;
	moveUpBtn.setAttribute('aria-label', 'Nach oben verschieben');
	moveUpBtn.textContent = '↑';

	const moveDownBtn = document.createElement('button');
	moveDownBtn.type = 'button';
	moveDownBtn.className = 'rail-mini-button';
	moveDownBtn.setAttribute('data-block-action', 'move-down');
	moveDownBtn.disabled = blockIndex === totalBlocks - 1;
	moveDownBtn.setAttribute('aria-label', 'Nach unten verschieben');
	moveDownBtn.textContent = '↓';

	const insertAfterBtn = document.createElement('button');
	insertAfterBtn.type = 'button';
	insertAfterBtn.className = 'rail-mini-button';
	insertAfterBtn.setAttribute('data-block-action', 'insert-below');
	insertAfterBtn.textContent = '+ Darunter';

	railLeft.appendChild(typeSelect);
	railLeft.appendChild(moveUpBtn);
	railLeft.appendChild(moveDownBtn);
	railLeft.appendChild(insertAfterBtn);

	const railRight = document.createElement('div');
	railRight.className = 'rail-right';

	const deleteBtn = document.createElement('button');
	deleteBtn.type = 'button';
	deleteBtn.className = 'rail-mini-button rail-delete-button';
	deleteBtn.setAttribute('data-block-action', 'delete-block');
	deleteBtn.setAttribute('aria-label', 'Abschnitt löschen');
	deleteBtn.textContent = 'Löschen';

	railRight.appendChild(deleteBtn);
	hoverRail.appendChild(railLeft);
	hoverRail.appendChild(railRight);
	blockArticle.appendChild(hoverRail);

	if (blockItem.type === 'scene_heading') {
		blockArticle.appendChild(buildSceneBlockContent(blockItem));
	} else if (blockItem.type === 'action') {
		blockArticle.appendChild(buildActionBlockContent(blockItem));
	} else if (blockItem.type === 'dialogue') {
		blockArticle.appendChild(buildDialogueBlockContent(blockItem));
	} else if (blockItem.type === 'transition') {
		blockArticle.appendChild(buildTransitionBlockContent(blockItem));
	}

	return blockArticle;
}

function renderManuscriptBlocks(activeDocument) {
	const containerNode = document.getElementById('manuscript-blocks-container');
	if (containerNode === null || activeDocument === null) {
		return;
	}
	containerNode.replaceChildren();
	const totalCount = activeDocument.blocks.length;
	for (let index = 0; index < totalCount; index += 1) {
		containerNode.appendChild(buildManuscriptBlockElement(activeDocument.blocks[index], index, totalCount));
	}
	refreshCharacterAutocompleteList(activeDocument);
}

function populateEditorFromActiveDocument() {
	const activeDocument = getCurrentlyOpenDocument();
	if (activeDocument === null) {
		return;
	}
	document.getElementById('document-title-input').value = activeDocument.title || '';
	document.getElementById('document-author-input').value = activeDocument.author || '';
	document.getElementById('document-address-input').value = activeDocument.address || '';
	document.getElementById('option-title-page-checkbox').checked = Boolean(activeDocument.includeTitlePage);
	document.getElementById('option-fade-in-checkbox').checked = Boolean(activeDocument.includeFadeIn);
	document.getElementById('option-fade-out-checkbox').checked = Boolean(activeDocument.includeFadeOut);
	document.getElementById('option-the-end-checkbox').checked = Boolean(activeDocument.includeTheEnd);

	const saveIndicator = document.getElementById('save-timestamp-indicator');
	saveIndicator.textContent = '✓ Gespeichert (' + formatTimestampForHumanDisplay(activeDocument.modificationTimestamp) + ')';

	renderManuscriptBlocks(activeDocument);
}

function switchActiveScreen(screenName) {
	const dashboardSection = document.getElementById('dashboard-section');
	const editorSection = document.getElementById('editor-section');
	const backButton = document.getElementById('back-to-dashboard-button');
	const brandTitle = document.getElementById('brand-title-element');
	const saveIndicator = document.getElementById('save-timestamp-indicator');
	const editorActions = document.getElementById('editor-actions-container');

	if (screenName === 'editor') {
		dashboardSection.classList.add('is-hidden');
		editorSection.classList.remove('is-hidden');
		backButton.classList.remove('is-hidden');
		brandTitle.classList.add('is-hidden');
		saveIndicator.classList.remove('is-hidden');
		editorActions.classList.remove('is-hidden');
		populateEditorFromActiveDocument();
	} else {
		workspaceState.activeDocumentIdentifier = null;
		editorSection.classList.add('is-hidden');
		dashboardSection.classList.remove('is-hidden');
		backButton.classList.add('is-hidden');
		brandTitle.classList.remove('is-hidden');
		saveIndicator.classList.add('is-hidden');
		editorActions.classList.add('is-hidden');
		renderDashboardGrid();
	}
}

function transformBlockTypePreservingText(sourceBlock, targetType) {
	const convertedBlock = buildEmptyBlockByType(targetType);
	convertedBlock.identifier = sourceBlock.identifier;
	if (sourceBlock.type === 'action' && targetType === 'dialogue' && sourceBlock.content) {
		convertedBlock.segments[0].text = sourceBlock.content;
	} else if (sourceBlock.type === 'dialogue' && targetType === 'action') {
		convertedBlock.content = (sourceBlock.segments || []).map(function joinSegmentText(segmentItem) {
			return segmentItem.text;
		}).join(' ');
	}
	return convertedBlock;
}

function setupDashboardInteractions() {
	const searchInput = document.getElementById('search-documents-input');
	const sortCriterionSelect = document.getElementById('sort-criterion-select');
	const sortDirectionButton = document.getElementById('sort-direction-button');
	const documentsGrid = document.getElementById('documents-grid');
	const backupMenuButton = document.getElementById('toggle-backup-menu-button');
	const backupDropdown = document.getElementById('backup-dropdown-menu');
	const exportBackupButton = document.getElementById('export-json-backup-button');
	const importBackupInput = document.getElementById('import-json-backup-input');

	searchInput.addEventListener('input', function onSearchInput(eventObject) {
		runSafely(function filterGrid() {
			workspaceState.searchQuery = eventObject.target.value;
			renderDashboardGrid();
		});
	});

	sortCriterionSelect.addEventListener('change', function onCriterionChange(eventObject) {
		runSafely(function changeCriterion() {
			workspaceState.sortCriterion = eventObject.target.value;
			renderDashboardGrid();
		});
	});

	sortDirectionButton.addEventListener('click', function onDirectionToggle() {
		runSafely(function flipSortDirection() {
			workspaceState.sortDirection = workspaceState.sortDirection === 'descending' ? 'ascending' : 'descending';
			sortDirectionButton.textContent = workspaceState.sortDirection === 'descending' ? '↓ Absteigend' : '↑ Aufsteigend';
			renderDashboardGrid();
		});
	});

	backupMenuButton.addEventListener('click', function onBackupMenuClick(eventObject) {
		eventObject.stopPropagation();
		const isHidden = backupDropdown.classList.toggle('is-hidden');
		backupMenuButton.setAttribute('aria-expanded', String(!isHidden));
	});

	exportBackupButton.addEventListener('click', function onBackupExport() {
		runSafely(function downloadBackupFile() {
			const jsonPayload = JSON.stringify(workspaceState.documents, null, '\t');
			downloadTextAsFile('drehbuecher-backup.json', jsonPayload, 'application/json');
			backupDropdown.classList.add('is-hidden');
			showNotificationToast('Backup gespeichert.');
		});
	});

	importBackupInput.addEventListener('change', function onBackupFilePicked(eventObject) {
		const pickedFile = eventObject.target.files && eventObject.target.files[0];
		if (!pickedFile) {
			return;
		}
		const reader = new FileReader();
		reader.onload = function onFileRead(loadEvent) {
			runSafely(function restoreBackup() {
				const parsedData = JSON.parse(String(loadEvent.target.result));
				if (!Array.isArray(parsedData)) {
					throw new Error('Ungueltige Backup-Datei.');
				}
				for (const item of parsedData) {
					validateDocumentStructure(item);
				}
				workspaceState.documents = parsedData;
				writeDocumentsToLocalStorage(workspaceState.documents);
				backupDropdown.classList.add('is-hidden');
				renderDashboardGrid();
				showNotificationToast('Backup wiederhergestellt.');
			});
		};
		reader.readAsText(pickedFile);
	});

	documentsGrid.addEventListener('click', function onGridClick(eventObject) {
		runSafely(function handleCardClick() {
			const triggerElement = eventObject.target.closest('[data-dashboard-action]');
			if (triggerElement === null) {
				return;
			}
			const actionType = triggerElement.getAttribute('data-dashboard-action');
			const targetIdentifier = triggerElement.getAttribute('data-document-identifier');

			if (actionType === 'toggle-card-menu') {
				eventObject.stopPropagation();
				workspaceState.openCardMenuIdentifier = workspaceState.openCardMenuIdentifier === targetIdentifier ? null : targetIdentifier;
				renderDashboardGrid();
				return;
			}

			workspaceState.openCardMenuIdentifier = null;

			if (actionType === 'create-document') {
				const newDocument = buildBlankDocumentRecord();
				workspaceState.documents.push(newDocument);
				workspaceState.activeDocumentIdentifier = newDocument.identifier;
				saveAndTouchActiveDocument(newDocument);
				switchActiveScreen('editor');
				return;
			}

			if (actionType === 'open-document' && targetIdentifier) {
				workspaceState.activeDocumentIdentifier = targetIdentifier;
				switchActiveScreen('editor');
				return;
			}

			if (actionType === 'duplicate-document' && targetIdentifier) {
				const sourceDocument = workspaceState.documents.find(function findDoc(item) {
					return item.identifier === targetIdentifier;
				});
				if (sourceDocument) {
					const nowIso = createCurrentIsoTimestamp();
					const clonedDocument = JSON.parse(JSON.stringify(sourceDocument));
					clonedDocument.identifier = createUniqueIdentifier();
					clonedDocument.title = (sourceDocument.title || 'Drehbuch') + ' (Kopie)';
					clonedDocument.creationTimestamp = nowIso;
					clonedDocument.modificationTimestamp = nowIso;
					workspaceState.documents.push(clonedDocument);
					writeDocumentsToLocalStorage(workspaceState.documents);
					renderDashboardGrid();
					showNotificationToast('Dokument dupliziert.');
				}
				return;
			}

			if (actionType === 'delete-document' && targetIdentifier) {
				workspaceState.documents = workspaceState.documents.filter(function retainOther(item) {
					return item.identifier !== targetIdentifier;
				});
				writeDocumentsToLocalStorage(workspaceState.documents);
				renderDashboardGrid();
				showNotificationToast('Dokument gelöscht.');
			}
		});
	});
}

function setupEditorInteractions() {
	const backButton = document.getElementById('back-to-dashboard-button');
	const titleInput = document.getElementById('document-title-input');
	const authorInput = document.getElementById('document-author-input');
	const addressInput = document.getElementById('document-address-input');
	const toggleCoverButton = document.getElementById('toggle-cover-options-button');
	const coverDrawer = document.getElementById('cover-options-drawer');
	const titlePageCheckbox = document.getElementById('option-title-page-checkbox');
	const fadeInCheckbox = document.getElementById('option-fade-in-checkbox');
	const fadeOutCheckbox = document.getElementById('option-fade-out-checkbox');
	const theEndCheckbox = document.getElementById('option-the-end-checkbox');
	const blocksContainer = document.getElementById('manuscript-blocks-container');

	backButton.addEventListener('click', function onBackClick() {
		switchActiveScreen('dashboard');
	});

	toggleCoverButton.addEventListener('click', function onToggleCover() {
		const isHidden = coverDrawer.classList.toggle('is-hidden');
		toggleCoverButton.setAttribute('aria-expanded', String(!isHidden));
	});

	function persistHeaderFields() {
		runSafely(function updateMetadata() {
			const activeDocument = getCurrentlyOpenDocument();
			if (activeDocument === null) {
				return;
			}
			activeDocument.title = titleInput.value;
			activeDocument.author = authorInput.value;
			activeDocument.address = addressInput.value;
			activeDocument.includeTitlePage = titlePageCheckbox.checked;
			activeDocument.includeFadeIn = fadeInCheckbox.checked;
			activeDocument.includeFadeOut = fadeOutCheckbox.checked;
			activeDocument.includeTheEnd = theEndCheckbox.checked;
			saveAndTouchActiveDocument(activeDocument);
		});
	}

	titleInput.addEventListener('input', persistHeaderFields);
	authorInput.addEventListener('input', persistHeaderFields);
	addressInput.addEventListener('input', persistHeaderFields);
	titlePageCheckbox.addEventListener('change', persistHeaderFields);
	fadeInCheckbox.addEventListener('change', persistHeaderFields);
	fadeOutCheckbox.addEventListener('change', persistHeaderFields);
	theEndCheckbox.addEventListener('change', persistHeaderFields);

	blocksContainer.addEventListener('input', function onBlockTextInput(eventObject) {
		runSafely(function updateBlockValue() {
			const activeDocument = getCurrentlyOpenDocument();
			if (activeDocument === null) {
				return;
			}
			const blockElement = eventObject.target.closest('[data-block-identifier]');
			if (blockElement === null) {
				return;
			}
			const blockIdentifier = blockElement.getAttribute('data-block-identifier');
			const targetBlock = activeDocument.blocks.find(function findBlock(item) {
				return item.identifier === blockIdentifier;
			});
			if (!targetBlock) {
				return;
			}

			const fieldName = eventObject.target.getAttribute('data-field-name');
			if (fieldName) {
				targetBlock[fieldName] = eventObject.target.value;
				saveAndTouchActiveDocument(activeDocument);
				if (fieldName === 'speaker') {
					refreshCharacterAutocompleteList(activeDocument);
				}
				return;
			}

			const segmentIdentifier = eventObject.target.getAttribute('data-segment-identifier');
			if (segmentIdentifier && Array.isArray(targetBlock.segments)) {
				const targetSegment = targetBlock.segments.find(function findSegment(seg) {
					return seg.identifier === segmentIdentifier;
				});
				if (targetSegment) {
					targetSegment.text = eventObject.target.value;
					saveAndTouchActiveDocument(activeDocument);
				}
			}
		});
	});

	blocksContainer.addEventListener('change', function onBlockSelectChange(eventObject) {
		runSafely(function handleSelectChange() {
			const activeDocument = getCurrentlyOpenDocument();
			if (activeDocument === null) {
				return;
			}
			const blockElement = eventObject.target.closest('[data-block-identifier]');
			if (blockElement === null) {
				return;
			}
			const blockIdentifier = blockElement.getAttribute('data-block-identifier');
			const blockIndex = activeDocument.blocks.findIndex(function findIndex(item) {
				return item.identifier === blockIdentifier;
			});
			if (blockIndex === -1) {
				return;
			}

			if (eventObject.target.getAttribute('data-block-action') === 'change-type') {
				const newType = eventObject.target.value;
				activeDocument.blocks[blockIndex] = transformBlockTypePreservingText(activeDocument.blocks[blockIndex], newType);
				saveAndTouchActiveDocument(activeDocument);
				renderManuscriptBlocks(activeDocument);
			}
		});
	});

	blocksContainer.addEventListener('click', function onBlockActionClick(eventObject) {
		runSafely(function executeBlockAction() {
			const actionButton = eventObject.target.closest('[data-block-action]');
			if (actionButton === null || actionButton.tagName === 'SELECT') {
				return;
			}
			const actionName = actionButton.getAttribute('data-block-action');
			const activeDocument = getCurrentlyOpenDocument();
			if (activeDocument === null) {
				return;
			}
			const blockElement = actionButton.closest('[data-block-identifier]');
			if (blockElement === null) {
				return;
			}
			const blockIdentifier = blockElement.getAttribute('data-block-identifier');
			const blockIndex = activeDocument.blocks.findIndex(function findIdx(item) {
				return item.identifier === blockIdentifier;
			});
			if (blockIndex === -1) {
				return;
			}
			const currentBlock = activeDocument.blocks[blockIndex];

			if (actionName === 'move-up') {
				activeDocument.blocks = moveArrayElementByIndex(activeDocument.blocks, blockIndex, blockIndex - 1);
			} else if (actionName === 'move-down') {
				activeDocument.blocks = moveArrayElementByIndex(activeDocument.blocks, blockIndex, blockIndex + 1);
			} else if (actionName === 'insert-below') {
				const nextLogicalType = currentBlock.type === 'scene_heading' ? 'action' : 'dialogue';
				activeDocument.blocks.splice(blockIndex + 1, 0, buildEmptyBlockByType(nextLogicalType));
			} else if (actionName === 'delete-block') {
				activeDocument.blocks.splice(blockIndex, 1);
				if (activeDocument.blocks.length === 0) {
					activeDocument.blocks.push(buildEmptyBlockByType('scene_heading'));
				}
			} else if (actionName === 'add-parenthetical' && Array.isArray(currentBlock.segments)) {
				currentBlock.segments.push({
					identifier: createUniqueIdentifier(),
					segmentType: 'parenthetical',
					text: ''
				});
			} else if (actionName === 'add-speech' && Array.isArray(currentBlock.segments)) {
				currentBlock.segments.push({
					identifier: createUniqueIdentifier(),
					segmentType: 'speech',
					text: ''
				});
			} else if (actionName === 'remove-segment' && Array.isArray(currentBlock.segments)) {
				const segmentIdentifier = actionButton.getAttribute('data-segment-identifier');
				currentBlock.segments = currentBlock.segments.filter(function keepOtherSegments(seg) {
					return seg.identifier !== segmentIdentifier;
				});
			}

			saveAndTouchActiveDocument(activeDocument);
			renderManuscriptBlocks(activeDocument);
		});
	});

	const appendButtons = document.querySelectorAll('[data-append-type]');
	for (const appendBtn of appendButtons) {
		appendBtn.addEventListener('click', function onAppendClick() {
			runSafely(function appendNewBlock() {
				const activeDocument = getCurrentlyOpenDocument();
				if (activeDocument === null) {
					return;
				}
				const targetType = appendBtn.getAttribute('data-append-type');
				const createdBlock = buildEmptyBlockByType(targetType);
				activeDocument.blocks.push(createdBlock);
				saveAndTouchActiveDocument(activeDocument);
				renderManuscriptBlocks(activeDocument);
			});
		});
	}
}

function setupHeaderAndModalInteractions() {
	const overleafButton = document.getElementById('export-overleaf-button');
	const exportMenuTrigger = document.getElementById('toggle-export-menu-button');
	const exportDropdown = document.getElementById('export-dropdown-menu');
	const copyLatexButton = document.getElementById('copy-latex-source-button');
	const downloadTexButton = document.getElementById('download-tex-file-button');
	const openAiModalButton = document.getElementById('open-ai-import-button');
	const aiModal = document.getElementById('ai-import-dialog');
	const closeAiModalButton = document.getElementById('close-ai-modal-button');
	const cancelAiModalButton = document.getElementById('cancel-ai-modal-button');
	const confirmAiImportButton = document.getElementById('confirm-ai-import-button');
	const copyAiPromptButton = document.getElementById('copy-ai-prompt-button');
	const aiRawTextarea = document.getElementById('ai-raw-text-input');
	const themeButton = document.getElementById('theme-toggle-button');

	overleafButton.addEventListener('click', function onOverleafExport() {
		runSafely(function sendDocumentToOverleaf() {
			const activeDocument = getCurrentlyOpenDocument();
			if (activeDocument === null) {
				return;
			}
			const latexCode = generateLatexDocumentSource(activeDocument);
			postLatexToOverleaf(activeDocument.title, latexCode);
			showNotificationToast('Wird in Overleaf geöffnet...');
		});
	});

	exportMenuTrigger.addEventListener('click', function onToggleExportMenu(eventObject) {
		eventObject.stopPropagation();
		const isHidden = exportDropdown.classList.toggle('is-hidden');
		exportMenuTrigger.setAttribute('aria-expanded', String(!isHidden));
	});

	copyLatexButton.addEventListener('click', function onCopyLatex() {
		runSafely(function copyLatexToClipboard() {
			const activeDocument = getCurrentlyOpenDocument();
			if (activeDocument === null) {
				return;
			}
			const latexCode = generateLatexDocumentSource(activeDocument);
			navigator.clipboard.writeText(latexCode);
			exportDropdown.classList.add('is-hidden');
			showNotificationToast('LaTeX-Code kopiert.');
		});
	});

	downloadTexButton.addEventListener('click', function onDownloadTex() {
		runSafely(function saveTexFile() {
			const activeDocument = getCurrentlyOpenDocument();
			if (activeDocument === null) {
				return;
			}
			const latexCode = generateLatexDocumentSource(activeDocument);
			downloadTextAsFile((activeDocument.title || 'drehbuch') + '.tex', latexCode, 'text/x-tex');
			exportDropdown.classList.add('is-hidden');
			showNotificationToast('.tex-Datei heruntergeladen.');
		});
	});

	openAiModalButton.addEventListener('click', function onOpenAiModal() {
		aiRawTextarea.value = '';
		aiModal.showModal();
	});

	function closeAiModal() {
		aiModal.close();
	}

	closeAiModalButton.addEventListener('click', closeAiModal);
	cancelAiModalButton.addEventListener('click', closeAiModal);

	copyAiPromptButton.addEventListener('click', function onCopyPrompt() {
		runSafely(function copyPromptText() {
			navigator.clipboard.writeText(getStandardPromptForArtificialIntelligence());
			showNotificationToast('KI-Anweisung in die Zwischenablage kopiert.');
		});
	});

	confirmAiImportButton.addEventListener('click', function onConfirmAiImport() {
		runSafely(function convertAndInsertAiText() {
			const activeDocument = getCurrentlyOpenDocument();
			if (activeDocument === null) {
				return;
			}
			const parsedBlocks = parseRawScriptTextIntoBlocks(aiRawTextarea.value, createUniqueIdentifier);
			activeDocument.blocks.push(...parsedBlocks);
			saveAndTouchActiveDocument(activeDocument);
			renderManuscriptBlocks(activeDocument);
			closeAiModal();
			showNotificationToast(String(parsedBlocks.length) + ' Abschnitte eingefügt.');
		});
	});

	themeButton.addEventListener('click', function onThemeCycle() {
		const order = ['system', 'light', 'dark'];
		const nextIndex = (order.indexOf(workspaceState.themeMode) + 1) % order.length;
		applyThemeMode(order[nextIndex]);
		const labels = {
			system: 'Erscheinungsbild: System',
			light: 'Erscheinungsbild: Hell',
			dark: 'Erscheinungsbild: Dunkel'
		};
		showNotificationToast(labels[order[nextIndex]]);
	});

	document.addEventListener('click', function onGlobalClickCloseMenus() {
		exportDropdown.classList.add('is-hidden');
		exportMenuTrigger.setAttribute('aria-expanded', 'false');
		const backupDropdown = document.getElementById('backup-dropdown-menu');
		const backupTrigger = document.getElementById('toggle-backup-menu-button');
		if (backupDropdown && backupTrigger) {
			backupDropdown.classList.add('is-hidden');
			backupTrigger.setAttribute('aria-expanded', 'false');
		}
		if (workspaceState.openCardMenuIdentifier !== null) {
			workspaceState.openCardMenuIdentifier = null;
			renderDashboardGrid();
		}
	});
}

function bootstrapApplication() {
	runSafely(function startApp() {
		workspaceState.documents = readDocumentsFromLocalStorage();
		applyThemeMode(readThemeFromLocalStorage());
		setupDashboardInteractions();
		setupEditorInteractions();
		setupHeaderAndModalInteractions();
		switchActiveScreen('dashboard');
	});
}

bootstrapApplication();