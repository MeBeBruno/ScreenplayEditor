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
	reorderBlocksByIdentifier,
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
	saveDocumentsToStorage,
	saveOnboardingHiddenFlag,
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
	draggedBlockIdentifier: null,
	dropTargetBlockIdentifier: null,
	dropPlacementPosition: null
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

function revealCustomScreenshotImage(imageElement) {
	imageElement.classList.remove('is-hidden');
	const siblingFallback = imageElement.parentElement.querySelector('.onboarding-vector-fallback');
	if (siblingFallback !== null) {
		siblingFallback.classList.add('is-hidden');
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
			if (imageElement.complete && imageElement.naturalWidth > 0) {
				revealCustomScreenshotImage(imageElement);
			} else {
				imageElement.addEventListener('load', function onImageLoaded() {
					revealCustomScreenshotImage(imageElement);
				});
			}
		}
	}
}

function adjustTextareaHeightAutomatically(textareaElement) {
	if (!textareaElement) {
		return;
	}
	textareaElement.style.height = 'auto';
	const rootFontSizePixels = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
	const heightInRem = textareaElement.scrollHeight / rootFontSizePixels;
	textareaElement.style.height = String(heightInRem) + 'rem';
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
		statusBadge.textContent = 'Gespeichert • ' + formatIsoTimestampReadable(activeDocument.modificationTimestamp);
	}
}

function openOnboardingGuideModal() {
	const guideModalDialog = document.getElementById('onboarding-guide-modal');
	if (guideModalDialog !== null && !guideModalDialog.open) {
		guideModalDialog.showModal();
	}
}

function closeOnboardingGuideModalAndRemember() {
	applicationState.isOnboardingHidden = true;
	saveOnboardingHiddenFlag(true);
	const guideModalDialog = document.getElementById('onboarding-guide-modal');
	if (guideModalDialog !== null && guideModalDialog.open) {
		guideModalDialog.close();
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
	subtitleSpan.textContent = 'Frisches Blatt aufschlagen';
	labelGroup.appendChild(titleSpan);
	labelGroup.appendChild(subtitleSpan);

	buttonElement.appendChild(thumbnailSurface);
	buttonElement.appendChild(labelGroup);
	itemWrapper.appendChild(buttonElement);
	return itemWrapper;
}

function createExistingDocumentGridCard(documentRecord, cardIndex) {
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

	const pastelBand = document.createElement('span');
	pastelBand.className = 'sheet-pastel-band pastel-band-' + String(cardIndex % 4);
	pastelBand.setAttribute('aria-hidden', 'true');
	thumbnailSurface.appendChild(pastelBand);

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
		? 'Erstellt am ' + formatIsoTimestampReadable(documentRecord.creationTimestamp)
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
	menuTriggerButton.setAttribute('aria-label', 'Optionen für ' + (documentRecord.title || 'Drehbuch'));
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
		duplicateText.textContent = 'Kopie anlegen';
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
		deleteText.textContent = 'Drehbuch löschen';
		deleteAction.appendChild(deleteText);

		dropdownMenu.appendChild(duplicateAction);
		dropdownMenu.appendChild(downloadTexAction);
		dropdownMenu.appendChild(deleteAction);
		itemWrapper.appendChild(dropdownMenu);
	}

	return itemWrapper;
}

function createEmptySearchNoticeCard() {
	const noticeWrapper = document.createElement('div');
	noticeWrapper.className = 'empty-search-state-card';

	const headingElement = document.createElement('p');
	headingElement.className = 'sheet-document-title';
	headingElement.textContent = 'Kein passendes Drehbuch gefunden';

	const resetButton = document.createElement('button');
	resetButton.type = 'button';
	resetButton.className = 'button-subtle-link';
	resetButton.setAttribute('data-dashboard-action', 'clear-search');
	resetButton.textContent = 'Suche zurücksetzen';

	noticeWrapper.appendChild(headingElement);
	noticeWrapper.appendChild(resetButton);
	return noticeWrapper;
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

	if (visibleDocuments.length === 0 && applicationState.searchQuery.trim().length > 0) {
		gridContainer.appendChild(createEmptySearchNoticeCard());
		return;
	}

	for (let index = 0; index < visibleDocuments.length; index += 1) {
		gridContainer.appendChild(createExistingDocumentGridCard(visibleDocuments[index], index));
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
	for (const [environmentCode, environmentLabel] of environmentOptions) {
		prefixSelect.appendChild(new Option(environmentLabel, environmentCode));
	}
	prefixSelect.value = blockItem.environment || 'INT';

	const locationField = document.createElement('input');
	locationField.type = 'text';
	locationField.className = 'slugline-location-field';
	locationField.placeholder = 'ORT DER SZENE (Z. B. HOTELHALLE)';
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
	actionTextarea.placeholder = 'Was passiert in dieser Szene?';
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
	speakerInput.placeholder = 'NAME DER FIGUR';
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
			const parentheticalContainer = document.createElement('div');
			parentheticalContainer.className = 'parenthetical-line-box';
			const openingParenthesisSpan = document.createElement('span');
			openingParenthesisSpan.className = 'paren-symbol';
			openingParenthesisSpan.textContent = '(';
			const parentheticalTextarea = document.createElement('textarea');
			parentheticalTextarea.className = 'auto-expanding-textarea';
			parentheticalTextarea.rows = 1;
			parentheticalTextarea.placeholder = 'Tonfall oder kleine Geste';
			parentheticalTextarea.value = segmentItem.text || '';
			parentheticalTextarea.setAttribute('data-segment-identifier', segmentItem.identifier);
			const closingParenthesisSpan = document.createElement('span');
			closingParenthesisSpan.className = 'paren-symbol';
			closingParenthesisSpan.textContent = ')';
			parentheticalContainer.appendChild(openingParenthesisSpan);
			parentheticalContainer.appendChild(parentheticalTextarea);
			parentheticalContainer.appendChild(closingParenthesisSpan);
			segmentRow.appendChild(parentheticalContainer);
		} else {
			const speechTextarea = document.createElement('textarea');
			speechTextarea.className = 'auto-expanding-textarea';
			speechTextarea.rows = 1;
			speechTextarea.placeholder = 'Was sagt die Figur?';
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
			removeSegmentButton.setAttribute('aria-label', 'Zeile entfernen');
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
	const parentheticalLabel = document.createElement('span');
	parentheticalLabel.textContent = 'Tonfall / Regie';
	addParentheticalButton.appendChild(parentheticalLabel);

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
	selectControl.setAttribute('aria-label', 'Szenenübergang');
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

	const dragHandleButton = document.createElement('button');
	dragHandleButton.type = 'button';
	dragHandleButton.className = 'block-drag-handle';
	dragHandleButton.setAttribute('data-block-command', 'drag-handle');
	dragHandleButton.disabled = totalBlockCount <= 1;
	dragHandleButton.setAttribute('aria-label', 'Abschnitt ziehen zum Verschieben oder Pfeiltasten nutzen');
	dragHandleButton.setAttribute('title', 'Ziehen zum Verschieben');
	dragHandleButton.appendChild(createIconSpanElement('gripVertical'));

	const typeSelect = document.createElement('select');
	typeSelect.className = 'block-type-select-pill block-type-pill-' + String(blockItem.type);
	typeSelect.setAttribute('data-block-command', 'change-type');
	typeSelect.setAttribute('aria-label', 'Abschnitts-Art ändern');
	const blockTypes = [
		['scene_heading', 'Szene'],
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
	moveUpButton.setAttribute('aria-label', 'Nach oben verschieben');
	moveUpButton.appendChild(createIconSpanElement('arrowUp'));

	const moveDownButton = document.createElement('button');
	moveDownButton.type = 'button';
	moveDownButton.className = 'block-tool-button';
	moveDownButton.setAttribute('data-block-command', 'move-down');
	moveDownButton.disabled = blockIndex === totalBlockCount - 1;
	moveDownButton.setAttribute('aria-label', 'Nach unten verschieben');
	moveDownButton.appendChild(createIconSpanElement('arrowDown'));

	const insertBelowButton = document.createElement('button');
	insertBelowButton.type = 'button';
	insertBelowButton.className = 'block-tool-button';
	insertBelowButton.setAttribute('data-block-command', 'insert-below');
	insertBelowButton.appendChild(createIconSpanElement('plus'));
	const insertLabel = document.createElement('span');
	insertLabel.textContent = 'Darunter einfügen';
	insertBelowButton.appendChild(insertLabel);

	leftCluster.appendChild(dragHandleButton);
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
	deleteBlockButton.setAttribute('aria-label', 'Abschnitt entfernen');
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

function focusPrimaryInputInsideBlock(blockIdentifier, optionalSegmentIdentifier) {
	const streamContainer = document.getElementById('manuscript-blocks-list');
	if (streamContainer === null || !blockIdentifier) {
		return;
	}
	const blockNode = streamContainer.querySelector('[data-block-identifier=\'' + blockIdentifier + '\']');
	if (blockNode === null) {
		return;
	}
	if (optionalSegmentIdentifier) {
		const segmentField = blockNode.querySelector('[data-segment-identifier=\'' + optionalSegmentIdentifier + '\']');
		if (segmentField !== null) {
			segmentField.focus();
			return;
		}
	}
	const primaryInput = blockNode.querySelector(
		'.slugline-location-field, .auto-expanding-textarea, .dialogue-character-field, .transition-choice-select'
	);
	if (primaryInput !== null) {
		primaryInput.focus();
	}
}

function focusDragHandleInsideBlock(blockIdentifier) {
	const streamContainer = document.getElementById('manuscript-blocks-list');
	if (streamContainer === null || !blockIdentifier) {
		return;
	}
	const dragHandle = streamContainer.querySelector(
		'[data-block-identifier=\'' + blockIdentifier + '\'] .block-drag-handle'
	);
	if (dragHandle !== null) {
		dragHandle.focus();
	}
}

function clearBlockDragVisualClasses() {
	const streamContainer = document.getElementById('manuscript-blocks-list');
	if (streamContainer === null) {
		return;
	}
	const blockNodes = streamContainer.querySelectorAll('.manuscript-block-node');
	for (const blockNode of blockNodes) {
		blockNode.classList.remove('is-being-dragged', 'is-drop-target-before', 'is-drop-target-after');
		blockNode.removeAttribute('draggable');
	}
}

function resetDragStateAndVisuals() {
	applicationState.draggedBlockIdentifier = null;
	applicationState.dropTargetBlockIdentifier = null;
	applicationState.dropPlacementPosition = null;
	clearBlockDragVisualClasses();
}

function calculateVerticalDropPlacement(targetBlockNode, pointerClientY) {
	const boundingRectangle = targetBlockNode.getBoundingClientRect();
	const verticalMidpoint = boundingRectangle.top + (boundingRectangle.height / 2);
	return pointerClientY < verticalMidpoint ? 'before' : 'after';
}

function applyDropTargetHighlight(targetBlockNode, placementPosition) {
	const streamContainer = document.getElementById('manuscript-blocks-list');
	if (streamContainer === null) {
		return;
	}
	const allBlockNodes = streamContainer.querySelectorAll('.manuscript-block-node');
	for (const singleBlockNode of allBlockNodes) {
		singleBlockNode.classList.remove('is-drop-target-before', 'is-drop-target-after');
	}
	if (placementPosition === 'before') {
		targetBlockNode.classList.add('is-drop-target-before');
	} else {
		targetBlockNode.classList.add('is-drop-target-after');
	}
}

function renderManuscriptBlocksStream(activeDocument, focusBlockIdentifier, focusSegmentIdentifier) {
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
	window.requestAnimationFrame(function onFrameRendered() {
		adjustAllVisibleTextareas();
		if (focusBlockIdentifier) {
			focusPrimaryInputInsideBlock(focusBlockIdentifier, focusSegmentIdentifier);
		}
	});
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
	saveBadge.textContent = 'Gespeichert • ' + formatIsoTimestampReadable(activeDocument.modificationTimestamp);

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

function bindBlockDragAndDropEvents(blocksStream) {
	blocksStream.addEventListener('pointerdown', function onPointerDownOnStream(eventObject) {
		const dragHandle = eventObject.target.closest('.block-drag-handle');
		if (dragHandle === null || dragHandle.disabled) {
			return;
		}
		const blockNode = dragHandle.closest('[data-block-identifier]');
		if (blockNode !== null) {
			blockNode.setAttribute('draggable', 'true');
		}
	});

	blocksStream.addEventListener('pointerup', function onPointerUpOnStream() {
		if (applicationState.draggedBlockIdentifier === null) {
			clearBlockDragVisualClasses();
		}
	});

	blocksStream.addEventListener('dragstart', function onBlockDragStart(eventObject) {
		const blockNode = eventObject.target.closest('[data-block-identifier]');
		if (blockNode === null || blockNode.getAttribute('draggable') !== 'true') {
			eventObject.preventDefault();
			return;
		}
		const blockIdentifier = blockNode.getAttribute('data-block-identifier');
		applicationState.draggedBlockIdentifier = blockIdentifier;
		if (eventObject.dataTransfer) {
			eventObject.dataTransfer.effectAllowed = 'move';
			eventObject.dataTransfer.setData('text/plain', blockIdentifier);
		}
		window.requestAnimationFrame(function markDraggedNode() {
			blockNode.classList.add('is-being-dragged');
		});
	});

	blocksStream.addEventListener('dragover', function onBlockDragOver(eventObject) {
		if (applicationState.draggedBlockIdentifier === null) {
			return;
		}
		eventObject.preventDefault();
		if (eventObject.dataTransfer) {
			eventObject.dataTransfer.dropEffect = 'move';
		}
		const targetBlockNode = eventObject.target.closest('[data-block-identifier]');
		if (targetBlockNode === null) {
			return;
		}
		const targetIdentifier = targetBlockNode.getAttribute('data-block-identifier');
		if (targetIdentifier === applicationState.draggedBlockIdentifier) {
			applicationState.dropTargetBlockIdentifier = null;
			applicationState.dropPlacementPosition = null;
			targetBlockNode.classList.remove('is-drop-target-before', 'is-drop-target-after');
			return;
		}
		const placementPosition = calculateVerticalDropPlacement(targetBlockNode, eventObject.clientY);
		applicationState.dropTargetBlockIdentifier = targetIdentifier;
		applicationState.dropPlacementPosition = placementPosition;
		applyDropTargetHighlight(targetBlockNode, placementPosition);
	});

	blocksStream.addEventListener('drop', function onBlockDrop(eventObject) {
		if (applicationState.draggedBlockIdentifier === null) {
			return;
		}
		eventObject.preventDefault();
		executeSafely(function commitBlockDrop() {
			const activeDocument = getActiveDocument();
			const draggedIdentifier = applicationState.draggedBlockIdentifier;
			const targetIdentifier = applicationState.dropTargetBlockIdentifier;
			const placementPosition = applicationState.dropPlacementPosition;
			resetDragStateAndVisuals();

			if (activeDocument === null || !draggedIdentifier || !targetIdentifier || !placementPosition) {
				return;
			}
			activeDocument.blocks = reorderBlocksByIdentifier(
				activeDocument.blocks,
				draggedIdentifier,
				targetIdentifier,
				placementPosition
			);
			saveAndTouchActiveDocument(activeDocument);
			renderManuscriptBlocksStream(activeDocument);
			window.requestAnimationFrame(function restoreHandleFocus() {
				focusDragHandleInsideBlock(draggedIdentifier);
			});
		});
	});

	blocksStream.addEventListener('dragend', function onBlockDragEnd() {
		resetDragStateAndVisuals();
	});
}

function bindDashboardEvents() {
	const searchField = document.getElementById('dashboard-search-field');
	const sortSelect = document.getElementById('dashboard-sort-criterion');
	const sortDirectionButton = document.getElementById('dashboard-sort-direction-button');
	const sortIconSlot = document.getElementById('sort-direction-icon-slot');
	const sortLabelText = document.getElementById('sort-direction-label-text');
	const gridList = document.getElementById('documents-grid-list');
	const dismissOnboardingButton = document.getElementById('dismiss-onboarding-guide-button');
	const closeOnboardingButton = document.getElementById('close-onboarding-guide-button');
	const showOnboardingButton = document.getElementById('show-onboarding-guide-button');
	const guideModalDialog = document.getElementById('onboarding-guide-modal');
	const backupMenuToggle = document.getElementById('toggle-backup-dropdown-button');
	const backupDropdown = document.getElementById('backup-dropdown-menu');
	const exportBackupButton = document.getElementById('export-all-backup-button');
	const importBackupInput = document.getElementById('import-all-backup-input');

	dismissOnboardingButton.addEventListener('click', closeOnboardingGuideModalAndRemember);
	closeOnboardingButton.addEventListener('click', closeOnboardingGuideModalAndRemember);

	showOnboardingButton.addEventListener('click', function onShowGuide() {
		openOnboardingGuideModal();
	});

	guideModalDialog.addEventListener('click', function onGuideBackdropClick(eventObject) {
		if (eventObject.target === guideModalDialog) {
			closeOnboardingGuideModalAndRemember();
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
			triggerBrowserFileDownload('scriptbridge-sammlung.json', payload, 'application/json');
			backupDropdown.classList.add('is-hidden');
			showToastNotification('Sammlung als Backup gespeichert.');
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
					throw new Error('Ungültiges Backup-Format.');
				}
				for (const documentItem of importedList) {
					validateScreenplayDocument(documentItem);
				}
				applicationState.documents = importedList;
				saveDocumentsToStorage(applicationState.documents);
				backupDropdown.classList.add('is-hidden');
				renderDashboardDocumentGrid();
				showToastNotification('Sammlung erfolgreich geladen.');
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

			if (actionCommand === 'clear-search') {
				applicationState.searchQuery = '';
				searchField.value = '';
				renderDashboardDocumentGrid();
				return;
			}

			if (actionCommand === 'toggle-card-menu') {
				eventObject.stopPropagation();
				applicationState.openCardMenuIdentifier = applicationState.openCardMenuIdentifier === documentIdentifier ? null : documentIdentifier;
				renderDashboardDocumentGrid();
				return;
			}

			applicationState.openCardMenuIdentifier = null;

			if (actionCommand === 'create-new') {
				const newDocumentRecord = createBlankScreenplayDocument();
				applicationState.documents.push(newDocumentRecord);
				applicationState.activeDocumentIdentifier = newDocumentRecord.identifier;
				saveAndTouchActiveDocument(newDocumentRecord);
				switchActiveWorkspaceScreen('editor');
				return;
			}

			if (actionCommand === 'open-existing' && documentIdentifier) {
				applicationState.activeDocumentIdentifier = documentIdentifier;
				switchActiveWorkspaceScreen('editor');
				return;
			}

			if (actionCommand === 'duplicate-document' && documentIdentifier) {
				const originalDocumentRecord = applicationState.documents.find(function findDocument(item) {
					return item.identifier === documentIdentifier;
				});
				if (originalDocumentRecord) {
					const timestampNow = createCurrentIsoTimestamp();
					const duplicatedDocumentRecord = JSON.parse(JSON.stringify(originalDocumentRecord));
					duplicatedDocumentRecord.identifier = generateUniqueIdentifier();
					duplicatedDocumentRecord.title = (originalDocumentRecord.title || 'Drehbuch') + ' (Kopie)';
					duplicatedDocumentRecord.creationTimestamp = timestampNow;
					duplicatedDocumentRecord.modificationTimestamp = timestampNow;
					applicationState.documents.push(duplicatedDocumentRecord);
					saveDocumentsToStorage(applicationState.documents);
					renderDashboardDocumentGrid();
					showToastNotification('Kopie wurde angelegt.');
				}
				return;
			}

			if (actionCommand === 'export-single-tex' && documentIdentifier) {
				const targetDocumentRecord = applicationState.documents.find(function findDocument(item) {
					return item.identifier === documentIdentifier;
				});
				if (targetDocumentRecord) {
					const compiledTex = compileScreenplayDocumentToLatex(targetDocumentRecord);
					triggerBrowserFileDownload((targetDocumentRecord.title || 'screenplay') + '.tex', compiledTex, 'text/x-tex');
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

	titleField.addEventListener('keydown', function onTitleKeydown(eventObject) {
		if (eventObject.key === 'Enter') {
			eventObject.preventDefault();
			authorField.focus();
		}
	});

	authorField.addEventListener('keydown', function onAuthorKeydown(eventObject) {
		if (eventObject.key === 'Enter') {
			eventObject.preventDefault();
			const activeDocument = getActiveDocument();
			if (activeDocument && activeDocument.blocks.length > 0) {
				focusPrimaryInputInsideBlock(activeDocument.blocks[0].identifier);
			}
		}
	});

	bindBlockDragAndDropEvents(blocksStream);

	blocksStream.addEventListener('keydown', function onBlockStreamKeydown(eventObject) {
		const targetElement = eventObject.target;
		const blockNode = targetElement.closest('[data-block-identifier]');
		if (blockNode === null) {
			return;
		}

		if (targetElement.classList.contains('block-drag-handle') && (eventObject.key === 'ArrowUp' || eventObject.key === 'ArrowDown')) {
			eventObject.preventDefault();
			executeSafely(function moveBlockWithKeyboard() {
				const activeDocument = getActiveDocument();
				if (activeDocument === null) {
					return;
				}
				const blockIdentifier = blockNode.getAttribute('data-block-identifier');
				const currentBlockIndex = activeDocument.blocks.findIndex(function findBlockIndex(item) {
					return item.identifier === blockIdentifier;
				});
				if (currentBlockIndex === -1) {
					return;
				}
				const destinationIndex = eventObject.key === 'ArrowUp' ? currentBlockIndex - 1 : currentBlockIndex + 1;
				if (destinationIndex < 0 || destinationIndex >= activeDocument.blocks.length) {
					return;
				}
				activeDocument.blocks = moveArrayItem(activeDocument.blocks, currentBlockIndex, destinationIndex);
				saveAndTouchActiveDocument(activeDocument);
				renderManuscriptBlocksStream(activeDocument);
				window.requestAnimationFrame(function refocusHandle() {
					focusDragHandleInsideBlock(blockIdentifier);
				});
			});
			return;
		}

		if (eventObject.key !== 'Enter') {
			return;
		}
		if (targetElement.classList.contains('slugline-location-field')) {
			eventObject.preventDefault();
			const timeInput = blockNode.querySelector('.slugline-time-field');
			if (timeInput !== null) {
				timeInput.focus();
			}
			return;
		}
		if (targetElement.classList.contains('dialogue-character-field')) {
			eventObject.preventDefault();
			const firstSegmentTextarea = blockNode.querySelector('.auto-expanding-textarea');
			if (firstSegmentTextarea !== null) {
				firstSegmentTextarea.focus();
			}
			return;
		}
		if (targetElement.classList.contains('slugline-time-field')) {
			eventObject.preventDefault();
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			const blockIdentifier = blockNode.getAttribute('data-block-identifier');
			const currentBlockIndex = activeDocument.blocks.findIndex(function findBlockIndex(item) {
				return item.identifier === blockIdentifier;
			});
			if (currentBlockIndex !== -1 && currentBlockIndex + 1 < activeDocument.blocks.length) {
				focusPrimaryInputInsideBlock(activeDocument.blocks[currentBlockIndex + 1].identifier);
			} else if (currentBlockIndex !== -1) {
				const newActionBlock = createEmptyBlockRecord('action');
				activeDocument.blocks.push(newActionBlock);
				saveAndTouchActiveDocument(activeDocument);
				renderManuscriptBlocksStream(activeDocument, newActionBlock.identifier);
			}
		}
	});

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
				const targetSegment = targetBlock.segments.find(function findSegment(segmentItem) {
					return segmentItem.identifier === segmentIdentifier;
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
			const blockIndex = activeDocument.blocks.findIndex(function findBlockIndex(item) {
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
			renderManuscriptBlocksStream(activeDocument, blockIdentifier);
		});
	});

	blocksStream.addEventListener('click', function onBlockCommandClick(eventObject) {
		executeSafely(function executeCommand() {
			const commandButton = eventObject.target.closest('[data-block-command]');
			if (commandButton === null || commandButton.tagName === 'SELECT') {
				return;
			}
			const commandName = commandButton.getAttribute('data-block-command');
			if (commandName === 'drag-handle') {
				return;
			}
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			const blockNode = commandButton.closest('[data-block-identifier]');
			if (blockNode === null) {
				return;
			}
			const blockIdentifier = blockNode.getAttribute('data-block-identifier');
			const blockIndex = activeDocument.blocks.findIndex(function findBlockIndex(item) {
				return item.identifier === blockIdentifier;
			});
			if (blockIndex === -1) {
				return;
			}
			const currentBlock = activeDocument.blocks[blockIndex];
			let focusTargetBlockIdentifier = currentBlock.identifier;
			let focusTargetSegmentIdentifier = null;

			if (commandName === 'move-up') {
				activeDocument.blocks = moveArrayItem(activeDocument.blocks, blockIndex, blockIndex - 1);
			} else if (commandName === 'move-down') {
				activeDocument.blocks = moveArrayItem(activeDocument.blocks, blockIndex, blockIndex + 1);
			} else if (commandName === 'insert-below') {
				const nextLogicalType = currentBlock.type === 'scene_heading' ? 'action' : 'dialogue';
				const insertedBlock = createEmptyBlockRecord(nextLogicalType);
				activeDocument.blocks.splice(blockIndex + 1, 0, insertedBlock);
				focusTargetBlockIdentifier = insertedBlock.identifier;
			} else if (commandName === 'delete-block') {
				activeDocument.blocks.splice(blockIndex, 1);
				if (activeDocument.blocks.length === 0) {
					const replacementBlock = createEmptyBlockRecord('scene_heading');
					activeDocument.blocks.push(replacementBlock);
					focusTargetBlockIdentifier = replacementBlock.identifier;
				} else {
					const fallbackIndex = Math.max(0, blockIndex - 1);
					focusTargetBlockIdentifier = activeDocument.blocks[fallbackIndex].identifier;
				}
			} else if (commandName === 'add-parenthetical' && Array.isArray(currentBlock.segments)) {
				const newSegment = {
					identifier: generateUniqueIdentifier(),
					segmentType: 'parenthetical',
					text: ''
				};
				currentBlock.segments.push(newSegment);
				focusTargetSegmentIdentifier = newSegment.identifier;
			} else if (commandName === 'add-speech' && Array.isArray(currentBlock.segments)) {
				const newSegment = {
					identifier: generateUniqueIdentifier(),
					segmentType: 'speech',
					text: ''
				};
				currentBlock.segments.push(newSegment);
				focusTargetSegmentIdentifier = newSegment.identifier;
			} else if (commandName === 'delete-segment' && Array.isArray(currentBlock.segments)) {
				const segmentIdentifier = commandButton.getAttribute('data-segment-identifier');
				currentBlock.segments = currentBlock.segments.filter(function keepOther(segmentItem) {
					return segmentItem.identifier !== segmentIdentifier;
				});
			}

			saveAndTouchActiveDocument(activeDocument);
			renderManuscriptBlocksStream(activeDocument, focusTargetBlockIdentifier, focusTargetSegmentIdentifier);
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
				const createdBlock = createEmptyBlockRecord(blockType);
				activeDocument.blocks.push(createdBlock);
				saveAndTouchActiveDocument(activeDocument);
				renderManuscriptBlocksStream(activeDocument, createdBlock.identifier);
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

	overleafButton.addEventListener('click', function onSendToOverleaf() {
		executeSafely(function postToOverleaf() {
			const activeDocument = getActiveDocument();
			if (activeDocument === null) {
				return;
			}
			const latexCode = compileScreenplayDocumentToLatex(activeDocument);
			submitScreenplayToOverleaf(activeDocument.title, latexCode);
			showToastNotification('Drehbuch wird in Overleaf geöffnet...');
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
			showToastNotification('LaTeX-Code in die Zwischenablage kopiert.');
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
		importTextarea.focus();
	});

	function closeImportModal() {
		importModalDialog.close();
	}

	closeImportModalButton.addEventListener('click', closeImportModal);
	cancelImportModalButton.addEventListener('click', closeImportModal);

	importModalDialog.addEventListener('click', function onImportBackdropClick(eventObject) {
		if (eventObject.target === importModalDialog) {
			closeImportModal();
		}
	});

	copyPromptButton.addEventListener('click', function onCopyAiPrompt() {
		executeSafely(function copyPrompt() {
			navigator.clipboard.writeText(buildPromptTemplateForArtificialIntelligence());
			showToastNotification('KI-Vorlage kopiert.');
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
			showToastNotification(String(importResult.blocks.length) + ' Abschnitte eingefügt.');
		});
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
		applicationState.isOnboardingHidden = loadOnboardingHiddenFlag();
		bindDashboardEvents();
		bindEditorEvents();
		bindTopBarAndImportEvents();
		switchActiveWorkspaceScreen('dashboard');
		if (!applicationState.isOnboardingHidden) {
			openOnboardingGuideModal();
		}
	});
}

initializeApplication();