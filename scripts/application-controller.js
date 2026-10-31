import {
	createIconSpanElement,
	getIconSvgMarkup,
	getOnboardingIllustrationMarkup
} from './icon-library.js';

import {
	collectKnownCharacters,
	countScenesInDocument,
	filterAndSortDocuments,
	moveArrayItem,
	validateScreenplayDocument
} from './domain-logic.js';

import {
	buildPromptTemplateForArtificialIntelligence,
	compileScreenplayDocumentToLatex,
	parseUniversalScriptInput
} from './latex-processor.js';

import {
	createBlankScreenplayDocument,
	createCurrentIsoTimestamp,
	createEmptyBlockRecord,
	formatIsoTimestampReadable,
	generateUniqueIdentifier,
	loadDocumentsFromStorage,
	loadOnboardingHiddenFlag,
	loadThemeFromStorage,
	saveDocumentsToStorage,
	saveOnboardingHiddenFlag,
	saveThemeToStorage,
	submitScreenplayToOverleaf,
	triggerBrowserFileDownload
} from './storage-gateway.js';

const applicationState = {
	documents: [],
	activeDocumentIdentifier: null,
	searchQuery: '',
	sortCriterion: 'modificationTimestamp',
	sortDirection: 'descending',
	openCardMenuIdentifier: null,
	isOnboardingHidden: false,
	themeMode: 'system'
};

function showToastNotification(messageText) {
	const toastRegion = document.getElementById('toast-notifications-region');
	if (toastRegion === null) {
		return;
	}
	const toastPill = document.createElement('div');
	toastPill.className = 'toast-notification-pill';
	toastPill.textContent = messageText;
	toastRegion.appendChild(toastPill);
	window.setTimeout(function removeToast() {
		if (toastPill.parentNode === toastRegion) {
			toastRegion.removeChild(toastPill);
		}
	}, 2800);
}

function executeSafely(operationCallback) {
	try {
		operationCallback();
	} catch (caughtError) {
		const errorText = caughtError instanceof Error ? caughtError.message : 'Unbekannter Fehler';
		showToastNotification(errorText);
	}
}

function hydrateStaticIconsAndIllustrations() {
	const iconSlots = document.querySelectorAll('[data-icon-name]');
	for (const slotElement of iconSlots) {
		const iconName = slotElement.getAttribute('data-icon-name');
		slotElement.innerHTML = getIconSvgMarkup(iconName);
	}

	const illustrationSlots = document.querySelectorAll('[data-illustration-slot]');
	for (const illustrationElement of illustrationSlots) {
		const illustrationKey = illustrationElement.getAttribute('data-illustration-slot');
		illustrationElement.innerHTML = getOnboardingIllustrationMarkup(illustrationKey);
	}

	const customImages = document.querySelectorAll('.onboarding-custom-image');
	for (const imageElement of customImages) {
		const sourceAttribute = imageElement.getAttribute('src');
		if (sourceAttribute && sourceAttribute.trim().length > 0) {
			imageElement.addEventListener('load', function onImageLoaded() {
				imageElement.classList.remove('is-hidden');
				const siblingFallback = imageElement.parentElement.querySelector('.onboarding-vector-fallback');
				if (siblingFallback) {
					siblingFallback.classList.add('is-hidden');
				}
			});
		}
	}
}

function adjustTextareaHeightAutomatically(textareaElement) {
	if (!textareaElement) {
		return;
	}
	textareaElement.style.height = 'auto';
	textareaElement.style.height = String(textareaElement.scrollHeight) + 'px';
}

function adjustAllVisibleTextareas() {
	const allTextareas = document.querySelectorAll('.auto-expanding-textarea');
	for (const textareaNode of allTextareas) {
		adjustTextareaHeightAutomatically(textareaNode);
	}
}

function getActiveDocument() {
	if (applicationState.activeDocumentIdentifier === null) {
		return null;
	}
	return applicationState.documents.find(function findMatchingDocument(documentItem) {
		return documentItem.identifier === applicationState.activeDocumentIdentifier;
	}) || null;
}

function synchronizePrintPreviewNodes(activeDocument) {
	if (activeDocument === null) {
		return;
	}
	const printCover = document.getElementById('printable-cover-page');
	const printTitle = document.getElementById('print-cover-title');
	const printAuthor = document.getElementById('print-cover-author');
	const printAddress = document.getElementById('print-cover-address');
	const fadeInMarker = document.getElementById('fade-in-print-marker');
	const fadeOutMarker = document.getElementById('fade-out-print-marker');
	const theEndMarker = document.getElementById('the-end-print-marker');

	if (activeDocument.includeTitlePage) {
		printCover.classList.add('cover-enabled');
	} else {
		printCover.classList.remove('cover-enabled');
	}
	printTitle.textContent = activeDocument.title || 'Untitled Screenplay';
	printAuthor.textContent = activeDocument.author || '';
	printAddress.textContent = activeDocument.address || '';

	fadeInMarker.classList.toggle('is-hidden', !activeDocument.includeFadeIn);
	fadeOutMarker.classList.toggle('is-hidden', !activeDocument.includeFadeOut);
	theEndMarker.classList.toggle('is-hidden', !activeDocument.includeTheEnd);
}

function saveAndTouchActiveDocument(activeDocument) {
	if (activeDocument !== null) {
		activeDocument.modificationTimestamp = createCurrentIsoTimestamp();
		validateScreenplayDocument(activeDocument);
		synchronizePrintPreviewNodes(activeDocument);
	}
	saveDocumentsToStorage(applicationState.documents);
	const statusBadge = document.getElementById('save-status-text');
	if (statusBadge !== null && activeDocument !== null) {
		statusBadge.textContent = 'Gespeichert: ' + formatIsoTimestampReadable(activeDocument.modificationTimestamp);
	}
}

function applyThemePreference(themeMode) {
	applicationState.themeMode = themeMode;
	document.documentElement.setAttribute('data-theme', themeMode);
	saveThemeToStorage(themeMode);
}

function updateOnboardingVisibility(isHiddenBoolean) {
	applicationState.isOnboardingHidden = isHiddenBoolean;
	saveOnboardingHiddenFlag(isHiddenBoolean);
	const onboardingBanner = document.getElementById('onboarding-guide-banner');
	const showGuideButton = document.getElementById('show-onboarding-guide-button');
	if (onboardingBanner !== null) {
		onboardingBanner.classList.toggle('is-hidden', isHiddenBoolean);
	}
	if (showGuideButton !== null) {
		showGuideButton.classList.toggle('is-hidden', !isHiddenBoolean);
	}
}

function createNewDocumentGridCard() {
	const itemWrapper = document.createElement('div');
	itemWrapper.className = 'document-grid-item';
	itemWrapper.setAttribute('role', 'listitem');

	const buttonElement = document.createElement('button');
	buttonElement.type = 'button';
	buttonElement.className = 'document-sheet-trigger';
	buttonElement.setAttribute('data-dashboard-action', 'create-new');

	const thumbnailSurface = document.createElement('div');
	thumbnailSurface.className = 'sheet-thumbnail-surface sheet-thumbnail-create';
	const plusCircle = document.createElement('span');
	plusCircle.className = 'create-plus-circle';
	plusCircle.appendChild(createIconSpanElement('plus'));
	thumbnailSurface.appendChild(plusCircle);

	const labelGroup = document.createElement('div');
	labelGroup.className = 'sheet-label-group';
	const titleSpan = document.createElement('span');
	titleSpan.className = 'sheet-document-title';
	titleSpan.textContent = 'Neues Drehbuch';
	const subtitleSpan = document.createElement('span');
	subtitleSpan.className = 'sheet-document-date';
	subtitleSpan.textContent = 'Leeres Skript anlegen';
	labelGroup.appendChild(titleSpan);
	labelGroup.appendChild(subtitleSpan);

	buttonElement.appendChild(thumbnailSurface);
	buttonElement.appendChild(labelGroup);
	itemWrapper.appendChild(buttonElement);
	return itemWrapper;
}

function createExistingDocumentGridCard(documentRecord) {
	const sceneCountText = countScenesInDocument(documentRecord);
	const itemWrapper = document.createElement('div');
	itemWrapper.className = 'document-grid-item';
	itemWrapper.setAttribute('role', 'listitem');

	const openButton = document.createElement('button');
	openButton.type = 'button';
	openButton.className = 'document-sheet-trigger';
	openButton.setAttribute('data-dashboard-action', 'open-existing');
	openButton.setAttribute('data-document-identifier', documentRecord.identifier);

	const thumbnailSurface = document.createElement('div');
	thumbnailSurface.className = 'sheet-thumbnail-surface';

	const linesPreview = document.createElement('div');
	linesPreview.className = 'thumbnail-script-lines';
	linesPreview.setAttribute('aria-hidden', 'true');
	const slugBar = document.createElement('span');
	slugBar.className = 'script-line-bar script-line-slug';
	const actionBarFirst = document.createElement('span');
	actionBarFirst.className = 'script-line-bar';
	const actionBarSecond = document.createElement('span');
	actionBarSecond.className = 'script-line-bar';
	const dialogueBar = document.createElement('span');
	dialogueBar.className = 'script-line-bar script-line-centered';
	linesPreview.appendChild(slugBar);
	linesPreview.appendChild(actionBarFirst);
	linesPreview.appendChild(actionBarSecond);
	linesPreview.appendChild(dialogueBar);

	const sceneMeta = document.createElement('span');
	sceneMeta.className = 'thumbnail-footer-meta';
	sceneMeta.textContent = sceneCountText + (sceneCountText === '1' ? ' Szene' : ' Szenen');

	thumbnailSurface.appendChild(linesPreview);
	thumbnailSurface.appendChild(sceneMeta);

	const labelGroup = document.createElement('div');
	labelGroup.className = 'sheet-label-group';
	const titleSpan = document.createElement('span');
	titleSpan.className = 'sheet-document-title';
	titleSpan.textContent = documentRecord.title || 'Unbetiteltes Drehbuch';

	const dateSpan = document.createElement('span');
	dateSpan.className = 'sheet-document-date';
	dateSpan.textContent = applicationState.sortCriterion === 'creationTimestamp'
		? 'Erstellt: ' + formatIsoTimestampReadable(documentRecord.creationTimestamp)
		: formatIsoTimestampReadable(documentRecord.modificationTimestamp);

	labelGroup.appendChild(titleSpan);
	labelGroup.appendChild(dateSpan);

	openButton.appendChild(thumbnailSurface);
	openButton.appendChild(labelGroup);

	const menuTriggerButton = document.createElement('button');
	menuTriggerButton.type = 'button';
	menuTriggerButton.className = 'card-context-menu-button';
	menuTriggerButton.setAttribute('data-dashboard-action', 'toggle-card-menu');
	menuTriggerButton.setAttribute('data-document-identifier', documentRecord.identifier);
	menuTriggerButton.setAttribute('aria-label', 'Aktionen für ' + (documentRecord.title || 'Drehbuch'));
	const isMenuOpen = applicationState.openCardMenuIdentifier === documentRecord.identifier;
	menuTriggerButton.setAttribute('aria-expanded', String(isMenuOpen));
	menuTriggerButton.appendChild(createIconSpanElement('moreHorizontal'));

	itemWrapper.appendChild(openButton);
	itemWrapper.appendChild(menuTriggerButton);

	if (isMenuOpen) {
		const dropdownMenu = document.createElement('div');
		dropdownMenu.className = 'floating-dropdown-menu';
		dropdownMenu.setAttribute('role', 'menu');

		const duplicateAction = document.createElement('button');
		duplicateAction.type = 'button';
		duplicateAction.className = 'dropdown-action-item';
		duplicateAction.setAttribute('data-dashboard-action', 'duplicate-document');
		duplicateAction.setAttribute('data-document-identifier', documentRecord.identifier);
		duplicateAction.appendChild(createIconSpanElement('copy'));
		const duplicateText = document.createElement('span');
		duplicateText.textContent = 'Duplizieren';
		duplicateAction.appendChild(duplicateText);

		const downloadTexAction = document.createElement('button');
		downloadTexAction.type = 'button';
		downloadTexAction.className = 'dropdown-action-item';
		downloadTexAction.setAttribute('data-dashboard-action', 'export-single-tex');
		downloadTexAction.setAttribute('data-document-identifier', documentRecord.identifier);
		downloadTexAction.appendChild(createIconSpanElement('download'));
		const downloadTexText = document.createElement('span');
		downloadTexText.textContent = 'Als .tex speichern';
		downloadTexAction.appendChild(downloadTexText);

		const deleteAction = document.createElement('button');
		deleteAction.type = 'button';
		deleteAction.className = 'dropdown-action-item dropdown-action-danger';
		deleteAction.setAttribute('data-dashboard-action', 'delete-document');
		deleteAction.setAttribute('data-document-identifier', documentRecord.identifier);
		deleteAction.appendChild(createIconSpanElement('trash'));
		const deleteText = document.createElement('span');
		deleteText.textContent = 'Löschen';
		deleteAction.appendChild(deleteText);

		dropdownMenu.appendChild(duplicateAction);
		dropdownMenu.appendChild(downloadTexAction);
		dropdownMenu.appendChild(deleteAction);
		itemWrapper.appendChild(dropdownMenu);
	}

	return itemWrapper;
}

function renderDashboardDocumentGrid() {
	const gridContainer = document.getElementById('documents-grid-list');
	if (gridContainer === null) {
		return;
	}
	gridContainer.replaceChildren();
	gridContainer.appendChild(createNewDocumentGridCard());

	const visibleDocuments = filterAndSortDocuments(
		applicationState.documents,
		applicationState.searchQuery,
		applicationState.sortCriterion,
		applicationState.sortDirection
	);

	for (const documentItem of visibleDocuments) {
		gridContainer.appendChild(createExistingDocumentGridCard(documentItem));
	}
}

function refreshCharacterDatalist(activeDocument) {
	const datalistElement = document.getElementById('known-characters-datalist');
	if (datalistElement === null || activeDocument === null) {
		return;
	}
	datalistElement.replaceChildren();
	const characterList = collectKnownCharacters(activeDocument);
	for (const characterName of characterList) {
		const optionElement = document.createElement('option');
		optionElement.value = characterName;
		datalistElement.appendChild(optionElement);
	}
}

function buildSceneHeadingDom(blockItem) {
	const slugContainer = document.createElement('div');
	slugContainer.className = 'slugline-bar-container';

	const prefixSelect = document.createElement('select');
	prefixSelect.className = 'slugline-prefix-select';
	prefixSelect.setAttribute('data-field-key', 'environment');
	prefixSelect.setAttribute('aria-label', 'Innen oder Außen');
	const environmentOptions = [
		['INT', 'INT.'],
		['EXT', 'EXT.'],
		['INTEXT', 'INT./EXT.'],
		['EXTINT', 'EXT./INT.']
	];
	for (const [envCode, envLabel] of environmentOptions) {
		prefixSelect.appendChild(new Option(envLabel, envCode));
	}
	prefixSelect.value = blockItem.environment || 'INT';

	const locationField = document.createElement('input');
	locationField.type = 'text';
	locationField.className = 'slugline-location-field';
	locationField.placeholder = 'SCHAUPLATZ (Z. B. SEMINAR ROOM)';
	locationField.value = blockItem.location || '';
	locationField.setAttribute('data-field-key', 'location');
	locationField.setAttribute('aria-label', 'Schauplatz');

	const dashSpan = document.createElement('span');
	dashSpan.className = 'slugline-dash';
	dashSpan.textContent = '—';

	const timeField = document.createElement('input');
	timeField.type = 'text';
	timeField.className = 'slugline-time-field';
	timeField.setAttribute('list', 'slugline-times-datalist');
	timeField.placeholder = 'DAY';
	timeField.value = blockItem.timeOfDay || '';
	timeField.setAttribute('data-field-key', 'timeOfDay');
	timeField.setAttribute('aria-label', 'Tageszeit');

	slugContainer.appendChild(prefixSelect);
	slugContainer.appendChild(locationField);
	slugContainer.appendChild(dashSpan);
	slugContainer.appendChild(timeField);
	return slugContainer;
}

function buildActionDom(blockItem) {
	const actionTextarea = document.createElement('textarea');
	actionTextarea.className = 'auto-expanding-textarea';
	actionTextarea.rows = 1;
	actionTextarea.placeholder = 'Handlung beschreiben...';
	actionTextarea.value = blockItem.content || '';
	actionTextarea.setAttribute('data-field-key', 'content');
	actionTextarea.setAttribute('aria-label', 'Handlung');
	return actionTextarea;
}

function buildDialogueDom(blockItem) {
	const dialogueColumn = document.createElement('div');
	dialogueColumn.className = 'dialogue-centered-column';

	const speakerHeader = document.createElement('div');
	speakerHeader.className = 'dialogue-character-header';

	const speakerInput = document.createElement('input');
	speakerInput.type = 'text';
	speakerInput.className = 'dialogue-character-field';
	speakerInput.setAttribute('list', 'known-characters-datalist');
	speakerInput.placeholder = 'FIGURENNAME';
	speakerInput.value = blockItem.speaker || '';
	speakerInput.setAttribute('data-field-key', 'speaker');
	speakerInput.setAttribute('aria-label', 'Sprechende Figur');

	speakerHeader.appendChild(speakerInput);
	dialogueColumn.appendChild(speakerHeader);

	const segmentsList = Array.isArray(blockItem.segments) ? blockItem.segments : [];
	for (const segmentItem of segmentsList) {
		const segmentRow = document.createElement('div');
		segmentRow.className = 'dialogue-segment-row';

		if (segmentItem.segmentType === 'parenthetical') {
			const parenBox = document.createElement('div');
			parenBox.className = 'parenthetical-line-box';
			const leftParen = document.createElement('span');
			leftParen.className = 'paren-symbol';
			leftParen.textContent = '(';
			const parenTextarea = document.createElement('textarea');
			parenTextarea.className = 'auto-expanding-textarea';
			parenTextarea.rows = 1;
			parenTextarea.placeholder = 'Regieanweisung / continuing';
			parenTextarea.value = segmentItem.text || '';
			parenTextarea.setAttribute('data-segment-identifier', segmentItem.identifier);
			const rightParen = document.createElement('span');
			rightParen.className = 'paren-symbol';
			rightParen.textContent = ')';
			parenBox.appendChild(leftParen);
			parenBox.appendChild(parenTextarea);
			parenBox.appendChild(rightParen);
			segmentRow.appendChild(parenBox);
		} else {
			const speechTextarea = document.createElement('textarea');
			speechTextarea.className = 'auto-expanding-textarea';
			speechTextarea.rows = 1;
			speechTextarea.placeholder = 'Gesprochener Dialogtext...';
			speechTextarea.value = segmentItem.text || '';
			speechTextarea.setAttribute('data-segment-identifier', segmentItem.identifier);
			segmentRow.appendChild(speechTextarea);
		}

		if (segmentsList.length > 1) {
			const removeSegmentButton = document.createElement('button');
			removeSegmentButton.type = 'button';
			removeSegmentButton.className = 'segment-delete-icon-button';
			removeSegmentButton.setAttribute('data-block-command', 'delete-segment');
			removeSegmentButton.setAttribute('data-segment-identifier', segmentItem.identifier);
			removeSegmentButton.setAttribute('aria-label', 'Dialogzeile entfernen');
			removeSegmentButton.appendChild(createIconSpanElement('close'));
			segmentRow.appendChild(removeSegmentButton);
		}

		dialogueColumn.appendChild(segmentRow);
	}

	const inlineAdder = document.createElement('div');
	inlineAdder.className = 'dialogue-inline-adder';

	const addParentheticalButton = document.createElement('button');
	addParentheticalButton.type = 'button';
	addParentheticalButton.className = 'button-subtle-link';
	addParentheticalButton.setAttribute('data-block-command', 'add-parenthetical');
	addParentheticalButton.appendChild(createIconSpanElement('plus'));
	const parenLabel = document.createElement('span');
	parenLabel.textContent = 'Regieanweisung in Klammern';
	addParentheticalButton.appendChild(parenLabel);

	const addSpeechButton = document.createElement('button');
	addSpeechButton.type = 'button';
	addSpeechButton.className = 'button-subtle-link';
	addSpeechButton.setAttribute('data-block-command', 'add-speech');
	addSpeechButton.appendChild(createIconSpanElement('plus'));
	const speechLabel = document.createElement('span');
	speechLabel.textContent = 'Weiterer Sprechtext';
	addSpeechButton.appendChild(speechLabel);

	inlineAdder.appendChild(addParentheticalButton);
	inlineAdder.appendChild(addSpeechButton);
	dialogueColumn.appendChild(inlineAdder);

	return dialogueColumn;
}

function buildTransitionDom(blockItem) {
	const transitionRow = document.createElement('div');
	transitionRow.className = 'transition-right-row';

	const selectControl = document.createElement('select');
	selectControl.className = 'transition-choice-select';
	selectControl.setAttribute('data-field-key', 'transitionType');
	selectControl.setAttribute('aria-label', 'Übergang');
	const transitionOptions = [
		'CUT TO:',
		'DISSOLVE TO:',
		'SMASH CUT TO:',
		'MATCH CUT TO:',
		'FADE TO BLACK.'
	];
	for (const optionText of transitionOptions) {
		selectControl.appendChild(new Option(optionText, optionText));
	}
	selectControl.value = blockItem.transitionType || 'CUT TO:';
	transitionRow.appendChild(selectControl);
	return transitionRow;
}

function createManuscriptBlockNode(blockItem, blockIndex, totalBlockCount) {
	const articleNode = document.createElement('article');
	articleNode.className = 'manuscript-block-node';
	articleNode.setAttribute('role', 'listitem');
	articleNode.setAttribute('data-block-identifier', blockItem.identifier);

	const contextToolbar = document.createElement('div');
	contextToolbar.className = 'block-context-toolbar';

	const leftCluster = document.createElement('div');
	leftCluster.className = 'toolbar-left-cluster';

	const typeSelect = document.createElement('select');
	typeSelect.className = 'block-type-select-pill';
	typeSelect.setAttribute('data-block-command', 'change-type');
	typeSelect.setAttribute('aria-label', 'Baustein-Typ ändern');
	const blockTypes = [
		['scene_heading', 'Szene (INT./EXT.)'],
		['action', 'Handlung'],
		['dialogue', 'Dialog'],
		['transition', 'Übergang']
	];
	for (const [typeKey, typeLabel] of blockTypes) {
		typeSelect.appendChild(new Option(typeLabel, typeKey));
	}
	typeSelect.value = blockItem.type;

	const moveUpButton = document.createElement('button');
	moveUpButton.type = 'button';
	moveUpButton.className = 'block-tool-button';
	moveUpButton.setAttribute('data-block-command', 'move-up');
	moveUpButton.disabled = blockIndex === 0;
	moveUpButton.setAttribute('aria-label', 'Nach oben schieben');
	moveUpButton.appendChild(createIconSpanElement('arrowUp'));

	const moveDownButton = document.createElement('button');
	moveDownButton.type = 'button';
	moveDownButton.className = 'block-tool-button';
	moveDownButton.setAttribute('data-block-command', 'move-down');
	moveDownButton.disabled = blockIndex === totalBlockCount - 1;
	moveDownButton.setAttribute('aria-label', 'Nach unten schieben');
	moveDownButton.appendChild(createIconSpanElement('arrowDown'));

	const insertBelowButton = document.createElement('button');
	insertBelowButton.type = 'button';
	insertBelowButton.className = 'block-tool-button';
	insertBelowButton.setAttribute('data-block-command', 'insert-below');
	insertBelowButton.appendChild(createIconSpanElement('plus'));
	const insertLabel = document.createElement('span');
	insertLabel.textContent = 'Darunter';
	insertBelowButton.appendChild(insertLabel);

	leftCluster.appendChild(typeSelect);
	leftCluster.appendChild(moveUpButton);
	leftCluster.appendChild(moveDownButton);
	leftCluster.appendChild(insertBelowButton);

	const rightCluster = document.createElement('div');
	rightCluster.className = 'toolbar-right-cluster';

	const deleteBlockButton = document.createElement('button');
	deleteBlockButton.type = 'button';
	deleteBlockButton.className = 'block-tool-button block-tool-danger';
	deleteBlockButton.setAttribute('data-block-command', 'delete-block');
	deleteBlockButton.setAttribute('aria-label', 'Abschnitt löschen');
	deleteBlockButton.appendChild(createIconSpanElement('trash'));

	rightCluster.appendChild(deleteBlockButton);
	contextToolbar.appendChild(leftCluster);
	contextToolbar.appendChild(rightCluster);
	articleNode.appendChild(contextToolbar);

	if (blockItem.type === 'scene_heading') {
		articleNode.appendChild(buildSceneHeadingDom(blockItem));
	} else if (blockItem.type === 'action') {
		articleNode.appendChild(buildActionDom(blockItem));
	} else if (blockItem.type === 'dialogue') {
		articleNode.appendChild(buildDialogueDom(blockItem));
	} else if (blockItem.type === 'transition') {
		articleNode.appendChild(buildTransitionDom(blockItem));
	}

	return articleNode;
}

function renderManuscriptBlocksStream(activeDocument) {
	const streamContainer = document.getElementById('manuscript-blocks-list');
	if (streamContainer === null || activeDocument === null) {
		return;
	}
	streamContainer.replaceChildren();
	const blockCount = activeDocument.blocks.length;
	for (let index = 0; index < blockCount; index += 1) {
		streamContainer.appendChild(createManuscriptBlockNode(activeDocument.blocks[index], index, blockCount));
	}
	refreshCharacterDatalist(activeDocument);
	synchronizePrintPreviewNodes(activeDocument);
	window.requestAnimationFrame(adjustAllVisibleTextareas);
}

function populateEditorFieldsFromActiveDocument() {
	const activeDocument = getActiveDocument();
	if (activeDocument === null) {
		return;
	}
	document.getElementById('editor-title-field').value = activeDocument.title || '';
	document.getElementById('editor-author-field').value = activeDocument.author || '';
	document.getElementById('editor-address-field').value = activeDocument.address || '';
	document.getElementById('setting-coverpage-checkbox').checked = Boolean(activeDocument.includeTitlePage);
	document.getElementById('setting-fadein-checkbox').checked = Boolean(activeDocument.includeFadeIn);
	document.getElementById('setting-fadeout-checkbox').checked = Boolean(activeDocument.includeFadeOut);
	document.getElementById('setting-theend-checkbox').checked = Boolean(activeDocument.includeTheEnd);

	const saveBadge = document.getElementById('save-status-text');
	saveBadge.textContent = 'Gespeichert: ' + formatIsoTimestampReadable(activeDocument.modificationTimestamp);

	renderManuscriptBlocksStream(activeDocument);
}

function switchActiveWorkspaceScreen(targetScreen) {
	const dashboardContainer = document.getElementById('dashboard-view-container');
	const editorContainer = document.getElementById('editor-view-container');
	const returnButton = document.getElementById('return-to-dashboard-button');
	const brandTitle = document.getElementById('brand-header-title');
	const saveBadge = document.getElementById('save-status-text');
	const editorToolbar = document.getElementById('editor-header-toolbar');

	if (targetScreen === 'editor') {
		dashboardContainer.classList.add('is-hidden');
		editorContainer.classList.remove('is-hidden');
		returnButton.classList.remove('is-hidden');
		brandTitle.classList.add('is-hidden');
		saveBadge.classList.remove('is-hidden');
		editorToolbar.classList.remove('is-hidden');
		populateEditorFieldsFromActiveDocument();
	} else {
		applicationState.activeDocumentIdentifier = null;
		editorContainer.classList.add('is-hidden');
		dashboardContainer.classList.remove('is-hidden');
		returnButton.classList.add('is-hidden');
		brandTitle.classList.remove('is-hidden');
		saveBadge.classList.add('is-hidden');
		editorToolbar.classList.add('is-hidden');
		renderDashboardDocumentGrid();
	}
}

function convertBlockPreservingContent(existingBlock, targetType) {
	const convertedBlock = createEmptyBlockRecord(targetType);
	convertedBlock.identifier = existingBlock.identifier;
	if (existingBlock.type === 'action' && targetType === 'dialogue' && existingBlock.content) {
		convertedBlock.segments[0].text = existingBlock.content;
	} else if (existingBlock.type === 'dialogue' && targetType === 'action') {
		convertedBlock.content = (existingBlock.segments || []).map(function extractText(segmentItem) {
			return segmentItem.text;
		}).join(' ');
	}
	return convertedBlock;
}

function bindDashboardEvents() {
	const searchField = document.getElementById('dashboard-search-field');
	const sortSelect = document.getElementById('dashboard-sort-criterion');
	const sortDirectionButton = document.getElementById('dashboard-sort-direction-button');
	const sortIconSlot = document.getElementById('sort-direction-icon-slot');
	const sortLabelText = document.getElementById('sort-direction-label-text');
	const gridList = document.getElementById('documents-grid-list');
	const dismissOnboardingButton = document.getElementById('dismiss-onboarding-guide-button');
	const showOnboardingButton = document.getElementById('show-onboarding-guide-button');
	const backupMenuToggle = document.getElementById('toggle-backup-dropdown-button');
	const backupDropdown = document.getElementById('backup-dropdown-menu');
	const exportBackupButton = document.getElementById('export-all-backup-button');
	const importBackupInput = document.getElementById('import-all-backup-input');

	dismissOnboardingButton.addEventListener('click', function onDismissGuide() {
		updateOnboardingVisibility(true);
	});

	showOnboardingButton.addEventListener('click', function onShowGuide() {
		updateOnboardingVisibility(false);
		if (applicationState.activeDocumentIdentifier !== null) {
			switchActiveWorkspaceScreen('dashboard');
		}
	});

	searchField.addEventListener('input', function onSearchInput(eventObject) {
		executeSafely(function filterDocuments() {
			applicationState.searchQuery = eventObject.target.value;
			renderDashboardDocumentGrid();
		});
	});

	sortSelect.addEventListener('change', function onSortChange(eventObject) {
		executeSafely(function updateSortCriterion() {
			applicationState.sortCriterion = eventObject.target.value;
			renderDashboardDocumentGrid();
		});
	});

	sortDirectionButton.addEventListener('click', function onDirectionToggle() {
		executeSafely(function toggleDirection() {
			applicationState.sortDirection = applicationState.sortDirection === 'descending' ? 'ascending' : 'descending';
			const isDescending = applicationState.sortDirection === 'descending';
			sortIconSlot.innerHTML = getIconSvgMarkup(isDescending ? 'sortDescending' : 'sortAscending');
			sortLabelText.textContent = isDescending ? 'Absteigend' : 'Aufsteigend';
			renderDashboardDocumentGrid();
		});
	});

	backupMenuToggle.addEventListener('click', function onBackupToggle(eventObject) {
		eventObject.stopPropagation();
		const isHidden = backupDropdown.classList.toggle('is-hidden');
		backupMenuToggle.setAttribute('aria-expanded', String(!isHidden));
	});

	exportBackupButton.addEventListener('click', function onExportBackup() {
		executeSafely(function downloadAllJson() {
			const payload = JSON.stringify(applicationState.documents, null, '\t');
			triggerBrowserFileDownload('scriptbridge-backup.json', payload, 'application/json');
			backupDropdown.classList.add('is-hidden');
			showToastNotification('Kurs-Backup heruntergeladen.');
		});
	});

	importBackupInput.addEventListener('change', function onImportBackup(eventObject) {
		const chosenFile = eventObject.target.files && eventObject.target.files[0];
		if (!chosenFile) {
			return;
		}
		const reader = new FileReader();
		reader.onload = function onFileRead(loadEvent) {
			executeSafely(function restoreBackupList() {
				const importedList = JSON.parse(String(loadEvent.target.result));
				if (!Array.isArray(importedList)) {
					throw new Error('Ungueltiges Backup-Format.');
				}
				for (const item of importedList) {
					validateScreenplayDocument(item);
				}
				applicationState.documents = importedList;
				saveDocumentsToStorage(applicationState.documents);
				backupDropdown.classList.add('is-hidden');
				renderDashboardDocumentGrid();
				showToastNotification('Backup erfolgreich geladen.');
			});
		};
		reader.readAsText(chosenFile);
	});

	gridList.addEventListener('click', function onGridClick(eventObject) {
		executeSafely(function processCardAction() {
			const actionElement = eventObject.target.closest('[data-dashboard-action]');
			if (actionElement === null) {
				return;
			}
			const actionCommand = actionElement.getAttribute('data-dashboard-action');
			const documentIdentifier = actionElement.getAttribute('data-document-identifier');

			if (actionCommand === 'toggle-card-menu') {
				eventObject.stopPropagation();
				applicationState.openCardMenuIdentifier = applicationState.openCardMenuIdentifier === documentIdentifier ? null : documentIdentifier;
				renderDashboardDocumentGrid();
				return;
			}

			applicationState.openCardMenuIdentifier = null;

			if (actionCommand === 'create-new') {
				const newDoc = createBlankScreenplayDocument();
				applicationState.documents.push(newDoc);
				applicationState.activeDocumentIdentifier = newDoc.identifier;
				saveAndTouchActiveDocument(newDoc);
				switchActiveWorkspaceScreen('editor');
				return;
			}

			if (actionCommand === 'open-existing' && documentIdentifier) {
				applicationState.activeDocumentIdentifier = documentIdentifier;
				switchActiveWorkspaceScreen('editor');
				return;
			}

			if (actionCommand === 'duplicate-document' && documentIdentifier) {
				const originalDoc = applicationState.documents.find(function findDoc(item) {
					return item.identifier === documentIdentifier;
				});
				if (originalDoc) {
					const timestampNow = createCurrentIsoTimestamp();
					const copyDoc = JSON.parse(JSON.stringify(originalDoc));
					copyDoc.identifier = generateUniqueIdentifier();
					copyDoc.title = (originalDoc.title || 'Drehbuch') + ' (Kopie)';
					copyDoc.creationTimestamp = timestampNow;
					copyDoc.modificationTimestamp = timestampNow;
					applicationState.documents.push(copyDoc);
					saveDocumentsToStorage(applicationState.documents);
					renderDashboardDocumentGrid();
					showToastNotification('Drehbuch dupliziert.');
				}
				return;
			}

			if (actionCommand === 'export-single-tex' && documentIdentifier) {
				const targetDoc = applicationState.documents.find(function findDoc(item) {
					return item.identifier === documentIdentifier;
				});
				if (targetDoc) {
					const compiledTex = compileScreenplayDocumentToLatex(targetDoc);
					triggerBrowserFileDownload((targetDoc.title || 'screenplay') + '.tex', compiledTex, 'text/x-tex');
					renderDashboardDocumentGrid();
					showToastNotification('.tex-Datei gespeichert.');
				}
				return;
			}

			if (actionCommand === 'delete-document' && documentIdentifier) {
				applicationState.documents = applicationState.documents.filter(function keepOther(item) {
					return item.identifier !== documentIdentifier;
				});
				saveDocumentsToStorage(applicationState.documents);
				renderDashboardDocumentGrid();
				showToastNotification('Drehbuch gelöscht.');
			}
		});
	});
}

function bindEditorEvents() {
	const returnButton = document.getElementById('return-to-dashboard-button');
	const titleField = document.getElementById('editor-title-field');
	const authorField = document.getElementById('editor-author-field');
	const addressField = document.getElementById('editor-address-field');
	const toggleCoverSettingsButton = document.getElementById('toggle-cover-settings-button');
	const coverSettingsPanel = document.getElementById('cover-settings-panel');
	const coverpageCheckbox = document.getElementById('setting-coverpage-checkbox');
	const fadeinCheckbox = document.getElementById('setting-fadein-checkbox');
	const fadeoutCheckbox = document.getElementById('setting-fadeout-checkbox');
	const theendCheckbox = document.getElementById('setting-theend-checkbox');
	const blocksStream = document.getElementById('manuscript-blocks-list');

	returnButton.addEventListener('click', function onReturnClick() {
		switchActiveWorkspaceScreen('dashboard');
	});

	toggleCoverSettingsButton.addEventListener('click', function onToggleCoverSettings() {
		const isHidden = coverSettingsPanel.classList.toggle('is-hidden');
		toggleCoverSettingsButton.setAttribute('aria-expanded', String(!isHidden));
	});

	function persistHeaderMetadata() {
		executeSafely(function updateHeader() {
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			activeDocument.title = titleField.value;
			activeDocument.author = authorField.value;
			activeDocument.address = addressField.value;
			activeDocument.includeTitlePage = coverpageCheckbox.checked;
			activeDocument.includeFadeIn = fadeinCheckbox.checked;
			activeDocument.includeFadeOut = fadeoutCheckbox.checked;
			activeDocument.includeTheEnd = theendCheckbox.checked;
			saveAndTouchActiveDocument(activeDocument);
		});
	}

	titleField.addEventListener('input', persistHeaderMetadata);
	authorField.addEventListener('input', persistHeaderMetadata);
	addressField.addEventListener('input', persistHeaderMetadata);
	coverpageCheckbox.addEventListener('change', persistHeaderMetadata);
	fadeinCheckbox.addEventListener('change', persistHeaderMetadata);
	fadeoutCheckbox.addEventListener('change', persistHeaderMetadata);
	theendCheckbox.addEventListener('change', persistHeaderMetadata);

	blocksStream.addEventListener('input', function onBlockFieldInput(eventObject) {
		executeSafely(function updateBlockContent() {
			if (eventObject.target.classList.contains('auto-expanding-textarea')) {
				adjustTextareaHeightAutomatically(eventObject.target);
			}
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			const blockNode = eventObject.target.closest('[data-block-identifier]');
			if (blockNode === null) {
				return;
			}
			const blockIdentifier = blockNode.getAttribute('data-block-identifier');
			const targetBlock = activeDocument.blocks.find(function findBlock(item) {
				return item.identifier === blockIdentifier;
			});
			if (!targetBlock) {
				return;
			}

			const fieldKey = eventObject.target.getAttribute('data-field-key');
			if (fieldKey) {
				targetBlock[fieldKey] = eventObject.target.value;
				saveAndTouchActiveDocument(activeDocument);
				if (fieldKey === 'speaker') {
					refreshCharacterDatalist(activeDocument);
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

	blocksStream.addEventListener('change', function onBlockTypeChange(eventObject) {
		executeSafely(function changeBlockType() {
			if (eventObject.target.getAttribute('data-block-command') !== 'change-type') {
				return;
			}
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			const blockNode = eventObject.target.closest('[data-block-identifier]');
			if (blockNode === null) {
				return;
			}
			const blockIdentifier = blockNode.getAttribute('data-block-identifier');
			const blockIndex = activeDocument.blocks.findIndex(function findIdx(item) {
				return item.identifier === blockIdentifier;
			});
			if (blockIndex === -1) {
				return;
			}
			activeDocument.blocks[blockIndex] = convertBlockPreservingContent(
				activeDocument.blocks[blockIndex],
				eventObject.target.value
			);
			saveAndTouchActiveDocument(activeDocument);
			renderManuscriptBlocksStream(activeDocument);
		});
	});

	blocksStream.addEventListener('click', function onBlockCommandClick(eventObject) {
		executeSafely(function executeCommand() {
			const commandButton = eventObject.target.closest('[data-block-command]');
			if (commandButton === null || commandButton.tagName === 'SELECT') {
				return;
			}
			const commandName = commandButton.getAttribute('data-block-command');
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			const blockNode = commandButton.closest('[data-block-identifier]');
			if (blockNode === null) {
				return;
			}
			const blockIdentifier = blockNode.getAttribute('data-block-identifier');
			const blockIndex = activeDocument.blocks.findIndex(function findIdx(item) {
				return item.identifier === blockIdentifier;
			});
			if (blockIndex === -1) {
				return;
			}
			const currentBlock = activeDocument.blocks[blockIndex];

			if (commandName === 'move-up') {
				activeDocument.blocks = moveArrayItem(activeDocument.blocks, blockIndex, blockIndex - 1);
			} else if (commandName === 'move-down') {
				activeDocument.blocks = moveArrayItem(activeDocument.blocks, blockIndex, blockIndex + 1);
			} else if (commandName === 'insert-below') {
				const nextLogicalType = currentBlock.type === 'scene_heading' ? 'action' : 'dialogue';
				activeDocument.blocks.splice(blockIndex + 1, 0, createEmptyBlockRecord(nextLogicalType));
			} else if (commandName === 'delete-block') {
				activeDocument.blocks.splice(blockIndex, 1);
				if (activeDocument.blocks.length === 0) {
					activeDocument.blocks.push(createEmptyBlockRecord('scene_heading'));
				}
			} else if (commandName === 'add-parenthetical' && Array.isArray(currentBlock.segments)) {
				currentBlock.segments.push({
					identifier: generateUniqueIdentifier(),
					segmentType: 'parenthetical',
					text: ''
				});
			} else if (commandName === 'add-speech' && Array.isArray(currentBlock.segments)) {
				currentBlock.segments.push({
					identifier: generateUniqueIdentifier(),
					segmentType: 'speech',
					text: ''
				});
			} else if (commandName === 'delete-segment' && Array.isArray(currentBlock.segments)) {
				const segmentIdentifier = commandButton.getAttribute('data-segment-identifier');
				currentBlock.segments = currentBlock.segments.filter(function keepOther(seg) {
					return seg.identifier !== segmentIdentifier;
				});
			}

			saveAndTouchActiveDocument(activeDocument);
			renderManuscriptBlocksStream(activeDocument);
		});
	});

	const appendButtons = document.querySelectorAll('[data-append-block-type]');
	for (const appendButton of appendButtons) {
		appendButton.addEventListener('click', function onAppendBlock() {
			executeSafely(function appendToBottom() {
				const activeDocument = getActiveDocument();
				if (activeDocument === null) {
					return;
				}
				const blockType = appendButton.getAttribute('data-append-block-type');
				activeDocument.blocks.push(createEmptyBlockRecord(blockType));
				saveAndTouchActiveDocument(activeDocument);
				renderManuscriptBlocksStream(activeDocument);
			});
		});
	}
}

function bindTopBarAndImportEvents() {
	const overleafButton = document.getElementById('submit-to-overleaf-button');
	const directPrintButton = document.getElementById('direct-pdf-print-button');
	const exportDropdownButton = document.getElementById('toggle-export-dropdown-button');
	const exportDropdownMenu = document.getElementById('export-options-dropdown');
	const copyLatexButton = document.getElementById('copy-latex-clipboard-button');
	const downloadTexButton = document.getElementById('download-tex-document-button');
	const openImportModalButton = document.getElementById('open-import-modal-button');
	const importModalDialog = document.getElementById('import-script-modal');
	const closeImportModalButton = document.getElementById('close-import-modal-button');
	const cancelImportModalButton = document.getElementById('cancel-import-modal-button');
	const confirmImportModalButton = document.getElementById('confirm-import-modal-button');
	const copyPromptButton = document.getElementById('copy-ai-prompt-template-button');
	const importTextarea = document.getElementById('import-raw-source-textarea');
	const replaceBlocksCheckbox = document.getElementById('replace-existing-blocks-checkbox');
	const cycleThemeButton = document.getElementById('cycle-theme-mode-button');

	overleafButton.addEventListener('click', function onSendToOverleaf() {
		executeSafely(function postToOverleaf() {
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			const latexCode = compileScreenplayDocumentToLatex(activeDocument);
			submitScreenplayToOverleaf(activeDocument.title, latexCode);
			showToastNotification('Wird in Overleaf geöffnet...');
		});
	});

	directPrintButton.addEventListener('click', function onDirectPdfPrint() {
		executeSafely(function printDocumentAsPdf() {
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			synchronizePrintPreviewNodes(activeDocument);
			window.print();
		});
	});

	exportDropdownButton.addEventListener('click', function onToggleExportDropdown(eventObject) {
		eventObject.stopPropagation();
		const isHidden = exportDropdownMenu.classList.toggle('is-hidden');
		exportDropdownButton.setAttribute('aria-expanded', String(!isHidden));
	});

	copyLatexButton.addEventListener('click', function onCopyLatex() {
		executeSafely(function copyLatexSource() {
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			const latexCode = compileScreenplayDocumentToLatex(activeDocument);
			navigator.clipboard.writeText(latexCode);
			exportDropdownMenu.classList.add('is-hidden');
			showToastNotification('LaTeX-Code kopiert.');
		});
	});

	downloadTexButton.addEventListener('click', function onDownloadTex() {
		executeSafely(function downloadTexFile() {
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			const latexCode = compileScreenplayDocumentToLatex(activeDocument);
			triggerBrowserFileDownload((activeDocument.title || 'screenplay') + '.tex', latexCode, 'text/x-tex');
			exportDropdownMenu.classList.add('is-hidden');
			showToastNotification('.tex-Datei gespeichert.');
		});
	});

	openImportModalButton.addEventListener('click', function onOpenImportModal() {
		importTextarea.value = '';
		replaceBlocksCheckbox.checked = false;
		importModalDialog.showModal();
	});

	function closeImportModal() {
		importModalDialog.close();
	}

	closeImportModalButton.addEventListener('click', closeImportModal);
	cancelImportModalButton.addEventListener('click', closeImportModal);

	copyPromptButton.addEventListener('click', function onCopyAiPrompt() {
		executeSafely(function copyPrompt() {
			navigator.clipboard.writeText(buildPromptTemplateForArtificialIntelligence());
			showToastNotification('KI-Anweisung in die Zwischenablage kopiert.');
		});
	});

	confirmImportModalButton.addEventListener('click', function onConfirmImport() {
		executeSafely(function processUniversalImport() {
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			const importResult = parseUniversalScriptInput(importTextarea.value, generateUniqueIdentifier);

			if (importResult.metadataPatch.title) {
				activeDocument.title = importResult.metadataPatch.title;
			}
			if (importResult.metadataPatch.author) {
				activeDocument.author = importResult.metadataPatch.author;
			}
			if (importResult.metadataPatch.address) {
				activeDocument.address = importResult.metadataPatch.address;
			}
			if (typeof importResult.metadataPatch.includeTitlePage === 'boolean') {
				activeDocument.includeTitlePage = importResult.metadataPatch.includeTitlePage;
			}
			if (typeof importResult.metadataPatch.includeFadeIn === 'boolean') {
				activeDocument.includeFadeIn = importResult.metadataPatch.includeFadeIn;
			}
			if (typeof importResult.metadataPatch.includeFadeOut === 'boolean') {
				activeDocument.includeFadeOut = importResult.metadataPatch.includeFadeOut;
			}
			if (typeof importResult.metadataPatch.includeTheEnd === 'boolean') {
				activeDocument.includeTheEnd = importResult.metadataPatch.includeTheEnd;
			}

			if (replaceBlocksCheckbox.checked && importResult.blocks.length > 0) {
				activeDocument.blocks = importResult.blocks;
			} else {
				activeDocument.blocks.push(...importResult.blocks);
			}

			saveAndTouchActiveDocument(activeDocument);
			populateEditorFieldsFromActiveDocument();
			closeImportModal();
			showToastNotification(String(importResult.blocks.length) + ' Bausteine importiert.');
		});
	});

	cycleThemeButton.addEventListener('click', function onCycleTheme() {
		const themeCycle = ['system', 'light', 'dark'];
		const nextIndex = (themeCycle.indexOf(applicationState.themeMode) + 1) % themeCycle.length;
		const nextTheme = themeCycle[nextIndex];
		applyThemePreference(nextTheme);
		const labelMap = {
			system: 'Darstellung: System',
			light: 'Darstellung: Hell',
			dark: 'Darstellung: Dunkel'
		};
		showToastNotification(labelMap[nextTheme]);
	});

	document.addEventListener('click', function onGlobalDocumentClick() {
		exportDropdownMenu.classList.add('is-hidden');
		exportDropdownButton.setAttribute('aria-expanded', 'false');
		const backupDropdown = document.getElementById('backup-dropdown-menu');
		const backupButton = document.getElementById('toggle-backup-dropdown-button');
		if (backupDropdown && backupButton) {
			backupDropdown.classList.add('is-hidden');
			backupButton.setAttribute('aria-expanded', 'false');
		}
		if (applicationState.openCardMenuIdentifier !== null) {
			applicationState.openCardMenuIdentifier = null;
			renderDashboardDocumentGrid();
		}
	});
}

function initializeApplication() {
	executeSafely(function startApplication() {
		hydrateStaticIconsAndIllustrations();
		applicationState.documents = loadDocumentsFromStorage();
		applyThemePreference(loadThemeFromStorage());
		updateOnboardingVisibility(loadOnboardingHiddenFlag());
		bindDashboardEvents();
		bindEditorEvents();
		bindTopBarAndImportEvents();
		switchActiveWorkspaceScreen('dashboard');
	});
}

initializeApplication();