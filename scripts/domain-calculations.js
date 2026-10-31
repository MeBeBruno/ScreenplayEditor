export function validateNonEmptyString(inputValue, parameterName) {
	if (typeof inputValue !== 'string' || inputValue.trim().length === 0) {
		throw new Error('Ungueltiger Textwert fuer Parameter: ' + String(parameterName));
	}
	return inputValue;
}

export function validateArrayInstance(inputArray, parameterName) {
	if (!Array.isArray(inputArray)) {
		throw new Error('Erwartetes Array fehlt fuer Parameter: ' + String(parameterName));
	}
	return inputArray;
}

export function validateDocumentRecord(documentRecord) {
	if (typeof documentRecord !== 'object' || documentRecord === null) {
		throw new Error('Dokument-Datensatz ist kein gueltiges Objekt.');
	}
	validateNonEmptyString(documentRecord.identifier, 'documentRecord.identifier');
	validateNonEmptyString(documentRecord.creationTimestamp, 'documentRecord.creationTimestamp');
	validateNonEmptyString(documentRecord.modificationTimestamp, 'documentRecord.modificationTimestamp');
	validateArrayInstance(documentRecord.blocks, 'documentRecord.blocks');
	return documentRecord;
}

export function countWordsInText(rawText) {
	if (typeof rawText !== 'string') {
		return 0n;
	}
	const trimmedText = rawText.trim();
	if (trimmedText.length === 0) {
		return 0n;
	}
	const wordTokens = trimmedText.split(/\s+/);
	return BigInt(wordTokens.length);
}

export function calculateBlockWordCount(blockItem) {
	if (typeof blockItem !== 'object' || blockItem === null) {
		throw new Error('Block-Element ist ungueltig.');
	}
	if (blockItem.type === 'scene_heading') {
		return countWordsInText(blockItem.location) + countWordsInText(blockItem.timeOfDay);
	}
	if (blockItem.type === 'action') {
		return countWordsInText(blockItem.content);
	}
	if (blockItem.type === 'transition') {
		return countWordsInText(blockItem.transitionType);
	}
	if (blockItem.type === 'dialogue') {
		const segmentsList = Array.isArray(blockItem.segments) ? blockItem.segments : [];
		return segmentsList.reduce(function accumulateSegmentWords(runningTotal, segmentItem) {
			return runningTotal + countWordsInText(segmentItem.text);
		}, countWordsInText(blockItem.speaker));
	}
	return 0n;
}

export function calculateBlockLineWeightInThousandths(blockItem) {
	if (typeof blockItem !== 'object' || blockItem === null) {
		throw new Error('Block-Element fuer Zeilenberechnung ist ungueltig.');
	}
	const blockWords = calculateBlockWordCount(blockItem);
	if (blockItem.type === 'scene_heading') {
		return 2000n;
	}
	if (blockItem.type === 'transition') {
		return 2000n;
	}
	if (blockItem.type === 'action') {
		const estimatedLines = (blockWords + 9n) / 10n;
		const effectiveLines = estimatedLines > 0n ? estimatedLines : 1n;
		return (effectiveLines + 1n) * 1000n;
	}
	if (blockItem.type === 'dialogue') {
		const segmentsList = Array.isArray(blockItem.segments) ? blockItem.segments : [];
		const segmentLinesThousandths = segmentsList.reduce(function accumulateDialogueLines(runningTotal, segmentItem) {
			if (segmentItem.segmentType === 'parenthetical') {
				return runningTotal + 1000n;
			}
			const spokenWords = countWordsInText(segmentItem.text);
			const spokenLines = (spokenWords + 6n) / 7n;
			const nonZeroSpokenLines = spokenLines > 0n ? spokenLines : 1n;
			return runningTotal + (nonZeroSpokenLines * 1000n);
		}, 2000n);
		return segmentLinesThousandths;
	}
	return 1000n;
}

export function calculateDocumentMetrics(documentRecord) {
	validateDocumentRecord(documentRecord);
	const linesPerStandardPageThousandths = 54000n;
	let totalWords = 0n;
	let totalLineWeightThousandths = 0n;
	let sceneCount = 0n;

	for (const blockItem of documentRecord.blocks) {
		totalWords = totalWords + calculateBlockWordCount(blockItem);
		totalLineWeightThousandths = totalLineWeightThousandths + calculateBlockLineWeightInThousandths(blockItem);
		if (blockItem.type === 'scene_heading') {
			sceneCount = sceneCount + 1n;
		}
	}

	const estimatedPagesWhole = totalLineWeightThousandths > 0n
		? ((totalLineWeightThousandths + linesPerStandardPageThousandths - 1n) / linesPerStandardPageThousandths)
		: 1n;

	const estimatedDurationSeconds = (totalLineWeightThousandths * 60n) / linesPerStandardPageThousandths;
	const estimatedMinutes = estimatedDurationSeconds / 60n;
	const remainingSeconds = estimatedDurationSeconds % 60n;

	return {
		sceneCount: sceneCount.toString(),
		blockCount: BigInt(documentRecord.blocks.length).toString(),
		wordCount: totalWords.toString(),
		estimatedPageCount: estimatedPagesWhole.toString(),
		estimatedRuntimeFormatted: estimatedMinutes.toString() + ' Min. ' + remainingSeconds.toString() + ' Sek.'
	};
}

export function extractUniqueCharacterNames(documentRecord) {
	validateDocumentRecord(documentRecord);
	const characterSet = new Set();
	for (const blockItem of documentRecord.blocks) {
		if (blockItem.type === 'dialogue' && typeof blockItem.speaker === 'string') {
			const normalizedName = blockItem.speaker.trim().toUpperCase();
			if (normalizedName.length > 0) {
				characterSet.add(normalizedName);
			}
		}
	}
	return Array.from(characterSet).sort(function compareStringsAlphabetically(firstName, secondName) {
		return firstName.localeCompare(secondName, 'de');
	});
}

export function compareIsoTimestamps(firstIsoTimestamp, secondIsoTimestamp) {
	const firstEpochMilliseconds = BigInt(Date.parse(firstIsoTimestamp));
	const secondEpochMilliseconds = BigInt(Date.parse(secondIsoTimestamp));
	if (firstEpochMilliseconds < secondEpochMilliseconds) {
		return -1;
	}
	if (firstEpochMilliseconds > secondEpochMilliseconds) {
		return 1;
	}
	return 0;
}

export function filterAndSortDocuments(documentCollection, searchQueryText, sortField, sortDirection) {
	validateArrayInstance(documentCollection, 'documentCollection');
	const normalizedQuery = typeof searchQueryText === 'string' ? searchQueryText.trim().toLowerCase() : '';
	const directionMultiplier = sortDirection === 'ascending' ? 1 : -1;

	const filteredList = documentCollection.filter(function matchSearchQuery(documentRecord) {
		if (normalizedQuery.length === 0) {
			return true;
		}
		const titleText = String(documentRecord.title || '').toLowerCase();
		const authorText = String(documentRecord.author || '').toLowerCase();
		return titleText.includes(normalizedQuery) || authorText.includes(normalizedQuery);
	});

	return filteredList.slice().sort(function compareDocuments(firstDocument, secondDocument) {
		if (sortField === 'title') {
			const firstTitle = String(firstDocument.title || 'Unbetiteltes Drehbuch');
			const secondTitle = String(secondDocument.title || 'Unbetiteltes Drehbuch');
			return firstTitle.localeCompare(secondTitle, 'de', { sensitivity: 'base' }) * directionMultiplier;
		}
		if (sortField === 'creationTimestamp') {
			return compareIsoTimestamps(firstDocument.creationTimestamp, secondDocument.creationTimestamp) * directionMultiplier;
		}
		return compareIsoTimestamps(firstDocument.modificationTimestamp, secondDocument.modificationTimestamp) * directionMultiplier;
	});
}

export function reorderArrayElements(sourceArray, fromIndex, toIndex) {
	validateArrayInstance(sourceArray, 'sourceArray');
	if (toIndex < 0 || toIndex >= sourceArray.length || fromIndex === toIndex) {
		return sourceArray.slice();
	}
	const clonedArray = sourceArray.slice();
	const [movedElement] = clonedArray.splice(fromIndex, 1);
	clonedArray.splice(toIndex, 0, movedElement);
	return clonedArray;
}