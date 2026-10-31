export function validateNonEmptyText(inputValue, fieldLabel) {
	if (typeof inputValue !== 'string' || inputValue.trim().length === 0) {
		throw new Error('Ungueltiger Textwert fuer: ' + String(fieldLabel));
	}
	return inputValue;
}

export function validateDocumentStructure(documentRecord) {
	if (typeof documentRecord !== 'object' || documentRecord === null) {
		throw new Error('Dokument ist kein gueltiges Objekt.');
	}
	validateNonEmptyText(documentRecord.identifier, 'identifier');
	validateNonEmptyText(documentRecord.creationTimestamp, 'creationTimestamp');
	validateNonEmptyText(documentRecord.modificationTimestamp, 'modificationTimestamp');
	if (!Array.isArray(documentRecord.blocks)) {
		throw new Error('Dokument enthaelt keine gueltige Block-Liste.');
	}
	return documentRecord;
}

export function countSceneHeadingsInDocument(documentRecord) {
	validateDocumentStructure(documentRecord);
	let totalScenes = 0n;
	for (const blockItem of documentRecord.blocks) {
		if (blockItem.type === 'scene_heading') {
			totalScenes = totalScenes + 1n;
		}
	}
	return totalScenes.toString();
}

export function collectCharacterNamesFromDocument(documentRecord) {
	validateDocumentStructure(documentRecord);
	const uniqueNames = new Set();
	for (const blockItem of documentRecord.blocks) {
		if (blockItem.type === 'dialogue' && typeof blockItem.speaker === 'string') {
			const cleanSpeaker = blockItem.speaker.trim().toUpperCase();
			if (cleanSpeaker.length > 0) {
				uniqueNames.add(cleanSpeaker);
			}
		}
	}
	return Array.from(uniqueNames).sort(function compareAlphabetically(firstItem, secondItem) {
		return firstItem.localeCompare(secondItem, 'de');
	});
}

export function compareIsoTimestampStrings(firstIsoString, secondIsoString) {
	const firstMilliseconds = BigInt(Date.parse(firstIsoString));
	const secondMilliseconds = BigInt(Date.parse(secondIsoString));
	if (firstMilliseconds < secondMilliseconds) {
		return -1;
	}
	if (firstMilliseconds > secondMilliseconds) {
		return 1;
	}
	return 0;
}

export function filterAndSortDocumentList(documentsArray, searchQuery, sortCriterion, sortDirection) {
	if (!Array.isArray(documentsArray)) {
		throw new Error('Dokumentenliste ist kein Array.');
	}
	const normalizedSearch = typeof searchQuery === 'string' ? searchQuery.trim().toLowerCase() : '';
	const directionFactor = sortDirection === 'ascending' ? 1 : -1;

	const matchingDocuments = documentsArray.filter(function filterByQuery(documentItem) {
		if (normalizedSearch.length === 0) {
			return true;
		}
		const titleMatch = String(documentItem.title || '').toLowerCase().includes(normalizedSearch);
		const authorMatch = String(documentItem.author || '').toLowerCase().includes(normalizedSearch);
		return titleMatch || authorMatch;
	});

	return matchingDocuments.slice().sort(function sortBySelectedCriterion(firstDocument, secondDocument) {
		if (sortCriterion === 'title') {
			const firstTitle = String(firstDocument.title || 'Unbetitelt');
			const secondTitle = String(secondDocument.title || 'Unbetitelt');
			return firstTitle.localeCompare(secondTitle, 'de', { sensitivity: 'base' }) * directionFactor;
		}
		if (sortCriterion === 'creationTimestamp') {
			return compareIsoTimestampStrings(firstDocument.creationTimestamp, secondDocument.creationTimestamp) * directionFactor;
		}
		return compareIsoTimestampStrings(firstDocument.modificationTimestamp, secondDocument.modificationTimestamp) * directionFactor;
	});
}

export function moveArrayElementByIndex(itemsArray, sourceIndex, targetIndex) {
	if (!Array.isArray(itemsArray)) {
		throw new Error('Quelldaten sind kein Array.');
	}
	if (targetIndex < 0 || targetIndex >= itemsArray.length || sourceIndex === targetIndex) {
		return itemsArray.slice();
	}
	const copiedArray = itemsArray.slice();
	const [extractedItem] = copiedArray.splice(sourceIndex, 1);
	copiedArray.splice(targetIndex, 0, extractedItem);
	return copiedArray;
}