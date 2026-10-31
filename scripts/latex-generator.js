import { validateDocumentStructure } from './domain-logic.js';

export function escapeLatexCharacters(rawText) {
	if (typeof rawText !== 'string') {
		return '';
	}
	const replacementDictionary = {
		'\\': '\\textbackslash{}',
		'{': '\\{',
		'}': '\\}',
		'$': '\\$',
		'&': '\\&',
		'#': '\\#',
		'^': '\\textasciicircum{}',
		'_': '\\_',
		'~': '\\textasciitilde{}',
		'%': '\\%'
	};
	return rawText.replace(/[\\{}$&#^_%~]/g, function mapSpecialCharacter(characterSymbol) {
		return replacementDictionary[characterSymbol] || characterSymbol;
	});
}

export function formatSceneHeadingForLatex(blockItem) {
	const slugCommand = blockItem.environment === 'EXT' ? '\\extslug' : '\\intslug';
	const locationName = escapeLatexCharacters(String(blockItem.location || 'SCHAUPLATZ').trim().toUpperCase());
	const timeValue = String(blockItem.timeOfDay || '').trim().toUpperCase();

	if (timeValue.length > 0) {
		return slugCommand + '[' + escapeLatexCharacters(timeValue) + ']{' + locationName + '}';
	}
	return slugCommand + '{' + locationName + '}';
}

export function formatActionForLatex(blockItem) {
	const trimmedAction = String(blockItem.content || '').trim();
	if (trimmedAction.length === 0) {
		return '';
	}
	return escapeLatexCharacters(trimmedAction);
}

export function formatDialogueForLatex(blockItem) {
	const speakerName = escapeLatexCharacters(String(blockItem.speaker || 'FIGUR').trim().toUpperCase());
	const voiceModifier = String(blockItem.modifier || '').trim();
	const beginTag = voiceModifier.length > 0
		? '\\begin{dialogue}[' + escapeLatexCharacters(voiceModifier) + ']{' + speakerName + '}'
		: '\\begin{dialogue}{' + speakerName + '}';

	const rawSegments = Array.isArray(blockItem.segments) ? blockItem.segments : [];
	const formattedLines = rawSegments
		.map(function convertSegment(segmentItem) {
			const cleanSegmentText = escapeLatexCharacters(String(segmentItem.text || '').trim());
			if (cleanSegmentText.length === 0) {
				return '';
			}
			if (segmentItem.segmentType === 'parenthetical') {
				const strippedText = cleanSegmentText.replace(/^\(+|\)+$/g, '').trim();
				return '\\paren{' + strippedText + '}';
			}
			return cleanSegmentText;
		})
		.filter(function keepNonEmpty(lineItem) {
			return lineItem.length > 0;
		});

	if (formattedLines.length === 0) {
		formattedLines.push('...');
	}

	return [beginTag, formattedLines.join('\n'), '\\end{dialogue}'].join('\n');
}

export function formatTransitionForLatex(blockItem) {
	const transitionLabel = escapeLatexCharacters(String(blockItem.transitionType || 'CUT TO:').trim().toUpperCase());
	return '\\begin{flushright}\n' + transitionLabel + '\n\\end{flushright}';
}

export function generateLatexDocumentSource(documentRecord) {
	validateDocumentStructure(documentRecord);

	const titleString = escapeLatexCharacters(documentRecord.title || 'Unbetiteltes Drehbuch');
	const authorString = escapeLatexCharacters(documentRecord.author || 'Unbekannt');
	const addressString = escapeLatexCharacters(documentRecord.address || '');

	const outputLines = [
		'\\documentclass{screenplay}',
		'\\usepackage[utf8]{inputenc}',
		'\\usepackage[T1]{fontenc}',
		'',
		'\\title{' + titleString + '}',
		'\\author{' + authorString + '}'
	];

	if (addressString.trim().length > 0) {
		outputLines.push('\\address{' + addressString + '}');
	}

	outputLines.push('');
	outputLines.push('\\begin{document}');

	if (documentRecord.includeTitlePage) {
		outputLines.push('\\maketitle');
		outputLines.push('');
	}

	if (documentRecord.includeFadeIn) {
		outputLines.push('\\fadein');
		outputLines.push('');
	}

	for (const blockItem of documentRecord.blocks) {
		let compiledSnippet = '';
		if (blockItem.type === 'scene_heading') {
			compiledSnippet = formatSceneHeadingForLatex(blockItem);
		} else if (blockItem.type === 'action') {
			compiledSnippet = formatActionForLatex(blockItem);
		} else if (blockItem.type === 'dialogue') {
			compiledSnippet = formatDialogueForLatex(blockItem);
		} else if (blockItem.type === 'transition') {
			compiledSnippet = formatTransitionForLatex(blockItem);
		}
		if (compiledSnippet.length > 0) {
			outputLines.push(compiledSnippet);
			outputLines.push('');
		}
	}

	if (documentRecord.includeFadeOut) {
		outputLines.push('\\fadeout');
		outputLines.push('');
	}

	if (documentRecord.includeTheEnd) {
		outputLines.push('\\theend');
		outputLines.push('');
	}

	outputLines.push('\\end{document}');
	return outputLines.join('\n');
}

export function parseRawScriptTextIntoBlocks(rawScriptString, identifierGenerator) {
	if (typeof rawScriptString !== 'string' || rawScriptString.trim().length === 0) {
		throw new Error('Bitte gib zuerst einen Drehbuchtext ein.');
	}
	const linesArray = rawScriptString.replace(/\r\n/g, '\n').split('\n');
	const resultingBlocks = [];
	let currentDialogueBlock = null;
	let actionLinesBuffer = [];

	function flushBufferedAction() {
		if (actionLinesBuffer.length > 0) {
			resultingBlocks.push({
				identifier: identifierGenerator(),
				type: 'action',
				content: actionLinesBuffer.join(' ')
			});
			actionLinesBuffer = [];
		}
	}

	function flushBufferedDialogue() {
		if (currentDialogueBlock !== null) {
			if (currentDialogueBlock.segments.length === 0) {
				currentDialogueBlock.segments.push({
					identifier: identifierGenerator(),
					segmentType: 'speech',
					text: ''
				});
			}
			resultingBlocks.push(currentDialogueBlock);
			currentDialogueBlock = null;
		}
	}

	for (const rawLine of linesArray) {
		const trimmedLine = rawLine.trim();
		if (trimmedLine.length === 0) {
			flushBufferedAction();
			flushBufferedDialogue();
			continue;
		}

		const scenePatternMatch = trimmedLine.match(/^(INT\.|EXT\.|INNEN\.|AUSSEN\.|INT|EXT)\s+([^-\n]+?)(?:\s+-\s+(.+))?$/i);
		if (scenePatternMatch !== null) {
			flushBufferedAction();
			flushBufferedDialogue();
			const rawPrefix = scenePatternMatch[1].toUpperCase();
			const environmentType = (rawPrefix.startsWith('EXT') || rawPrefix.startsWith('AUSSEN')) ? 'EXT' : 'INT';
			resultingBlocks.push({
				identifier: identifierGenerator(),
				type: 'scene_heading',
				environment: environmentType,
				location: scenePatternMatch[2].trim().toUpperCase(),
				timeOfDay: scenePatternMatch[3] ? scenePatternMatch[3].trim().toUpperCase() : 'DAY'
			});
			continue;
		}

		const transitionPatternMatch = trimmedLine.match(/^(CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|FADE TO BLACK\.)$/i);
		if (transitionPatternMatch !== null) {
			flushBufferedAction();
			flushBufferedDialogue();
			resultingBlocks.push({
				identifier: identifierGenerator(),
				type: 'transition',
				transitionType: transitionPatternMatch[1].toUpperCase()
			});
			continue;
		}

		const speakerPatternMatch = trimmedLine.match(/^([A-ZÄÖÜ][A-ZÄÖÜ0-9\s.-]{1,28})(?:\s*\((V\.O\.|O\.S\.|CONT'D|FILTERED)\))?$/);
		if (speakerPatternMatch !== null && currentDialogueBlock === null && !trimmedLine.endsWith('.')) {
			flushBufferedAction();
			currentDialogueBlock = {
				identifier: identifierGenerator(),
				type: 'dialogue',
				speaker: speakerPatternMatch[1].trim(),
				modifier: speakerPatternMatch[2] ? speakerPatternMatch[2].trim() : '',
				segments: []
			};
			continue;
		}

		if (currentDialogueBlock !== null) {
			if (trimmedLine.startsWith('(') && trimmedLine.endsWith(')')) {
				currentDialogueBlock.segments.push({
					identifier: identifierGenerator(),
					segmentType: 'parenthetical',
					text: trimmedLine.slice(1, -1).trim()
				});
			} else {
				currentDialogueBlock.segments.push({
					identifier: identifierGenerator(),
					segmentType: 'speech',
					text: trimmedLine
				});
			}
			continue;
		}

		actionLinesBuffer.push(trimmedLine);
	}

	flushBufferedAction();
	flushBufferedDialogue();
	return resultingBlocks;
}

export function getStandardPromptForArtificialIntelligence() {
	return [
		'Schreibe die Szene im klassischen Drehbuchformat:',
		'1. Szenenkopf: INT. SCHAUPLATZ - DAY oder EXT. SCHAUPLATZ - NIGHT',
		'2. Handlung als normaler Absatztext zwischen Leerzeilen.',
		'3. Figurenname allein in einer Zeile in GROSSBUCHSTABEN, optional mit (V.O.) oder (O.S.).',
		'4. Regieanweisungen im Dialog in einer eigenen Zeile in Klammern: (leise)',
		'5. Darunter der gesprochene Text ohne Anfuehrungszeichen.'
	].join('\n');
}