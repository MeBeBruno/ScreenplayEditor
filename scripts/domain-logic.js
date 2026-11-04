export function validateNonEmptyText(inputValue, fieldName) {
	if (typeof inputValue !== 'string' || inputValue.trim().length === 0) {
		throw new Error('Ungültiger Textwert für Feld: ' + String(fieldName));
	}
	return inputValue;
}

export function validateScreenplayDocument(documentRecord) {
	if (typeof documentRecord !== 'object' || documentRecord === null) {
		throw new Error('Dokument-Datensatz ist kein Objekt.');
	}
	validateNonEmptyText(documentRecord.identifier, 'identifier');
	validateNonEmptyText(documentRecord.creationTimestamp, 'creationTimestamp');
	validateNonEmptyText(documentRecord.modificationTimestamp, 'modificationTimestamp');
	if (!Array.isArray(documentRecord.blocks)) {
		throw new Error('Dokument enthält keine gültige Blockliste.');
	}
	return documentRecord;
}

export function countScenesInDocument(documentRecord) {
	validateScreenplayDocument(documentRecord);
	let sceneCount = 0n;
	for (const blockItem of documentRecord.blocks) {
		if (blockItem.type === 'scene_heading') {
			sceneCount = sceneCount + 1n;
		}
	}
	return sceneCount.toString();
}

export function collectKnownCharacters(documentRecord) {
	validateScreenplayDocument(documentRecord);
	const characterSet = new Set();
	for (const blockItem of documentRecord.blocks) {
		if (blockItem.type === 'dialogue' && typeof blockItem.speaker === 'string') {
			const normalizedName = blockItem.speaker.trim();
			if (normalizedName.length > 0) {
				characterSet.add(normalizedName);
			}
		}
	}
	return Array.from(characterSet).sort(function compareNames(firstValue, secondValue) {
		return firstValue.localeCompare(secondValue, 'de');
	});
}

export function compareIsoDatesExact(firstIsoString, secondIsoString) {
	const firstTimestampMilliseconds = BigInt(Date.parse(firstIsoString));
	const secondTimestampMilliseconds = BigInt(Date.parse(secondIsoString));
	if (firstTimestampMilliseconds < secondTimestampMilliseconds) {
		return -1;
	}
	if (firstTimestampMilliseconds > secondTimestampMilliseconds) {
		return 1;
	}
	return 0;
}

export function filterAndSortDocuments(documentsArray, searchQuery, sortCriterion, sortDirection) {
	if (!Array.isArray(documentsArray)) {
		throw new Error('Dokumentenliste muss ein Array sein.');
	}
	const cleanSearch = typeof searchQuery === 'string' ? searchQuery.trim().toLowerCase() : '';
	const directionFactor = sortDirection === 'ascending' ? 1 : -1;

	const filteredDocuments = documentsArray.filter(function matchQuery(documentItem) {
		if (cleanSearch.length === 0) {
			return true;
		}
		const titleText = String(documentItem.title || '').toLowerCase();
		const authorText = String(documentItem.author || '').toLowerCase();
		return titleText.includes(cleanSearch) || authorText.includes(cleanSearch);
	});

	return filteredDocuments.slice().sort(function compareDocumentOrder(firstDocument, secondDocument) {
		if (sortCriterion === 'title') {
			const firstTitle = String(firstDocument.title || 'Unbetitelt');
			const secondTitle = String(secondDocument.title || 'Unbetitelt');
			return firstTitle.localeCompare(secondTitle, 'de', { sensitivity: 'base' }) * directionFactor;
		}
		if (sortCriterion === 'creationTimestamp') {
			return compareIsoDatesExact(firstDocument.creationTimestamp, secondDocument.creationTimestamp) * directionFactor;
		}
		return compareIsoDatesExact(firstDocument.modificationTimestamp, secondDocument.modificationTimestamp) * directionFactor;
	});
}

export function moveArrayItem(sourceArray, fromIndex, toIndex) {
	if (!Array.isArray(sourceArray)) {
		throw new Error('Quelle ist kein Array.');
	}
	if (toIndex < 0 || toIndex >= sourceArray.length || fromIndex === toIndex) {
		return sourceArray.slice();
	}
	const clonedList = sourceArray.slice();
	const [removedElement] = clonedList.splice(fromIndex, 1);
	clonedList.splice(toIndex, 0, removedElement);
	return clonedList;
}

export function reorderBlocksByIdentifier(blocksArray, draggedIdentifier, targetIdentifier, placementPosition) {
	if (!Array.isArray(blocksArray)) {
		throw new Error('Blockliste muss ein Array sein.');
	}
	if (!draggedIdentifier || !targetIdentifier || draggedIdentifier === targetIdentifier) {
		return blocksArray.slice();
	}
	const sourceIndex = blocksArray.findIndex(function matchDragged(blockItem) {
		return blockItem.identifier === draggedIdentifier;
	});
	const initialTargetIndex = blocksArray.findIndex(function matchTarget(blockItem) {
		return blockItem.identifier === targetIdentifier;
	});
	if (sourceIndex === -1 || initialTargetIndex === -1) {
		return blocksArray.slice();
	}
	const workingList = blocksArray.slice();
	const [draggedBlockRecord] = workingList.splice(sourceIndex, 1);
	const updatedTargetIndex = workingList.findIndex(function matchRemainingTarget(blockItem) {
		return blockItem.identifier === targetIdentifier;
	});
	const insertionIndex = placementPosition === 'after' ? updatedTargetIndex + 1 : updatedTargetIndex;
	workingList.splice(insertionIndex, 0, draggedBlockRecord);
	return workingList;
}