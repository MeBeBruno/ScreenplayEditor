import { validateDocumentRecord } from './domain-calculations.js';

export function escapeLatexSpecialCharacters(rawInputText) {
	if (typeof rawInputText !== 'string') {
		return '';
	}
	const characterReplacementMap = {
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

	return rawInputText.replace(/[\\{}$&#^_%~]/g, function replaceMatchedCharacter(matchedCharacter) {
		return characterReplacementMap[matchedCharacter] || matchedCharacter;
	});
}

export function compileSceneHeadingBlockToLatex(blockItem) {
	const commandName = blockItem.environment === 'EXT' ? '\\extslug' : '\\intslug';
	const escapedLocation = escapeLatexSpecialCharacters(String(blockItem.location || 'SCHAUPLATZ').trim().toUpperCase());
	const trimmedTimeOfDay = String(blockItem.timeOfDay || '').trim().toUpperCase();

	if (trimmedTimeOfDay.length > 0) {
		const escapedTimeOfDay = escapeLatexSpecialCharacters(trimmedTimeOfDay);
		return commandName + '[' + escapedTimeOfDay + ']{' + escapedLocation + '}';
	}
	return commandName + '{' + escapedLocation + '}';
}

export function compileActionBlockToLatex(blockItem) {
	const rawContent = String(blockItem.content || '').trim();
	if (rawContent.length === 0) {
		return '';
	}
	return escapeLatexSpecialCharacters(rawContent);
}

export function compileDialogueBlockToLatex(blockItem) {
	const speakerName = escapeLatexSpecialCharacters(String(blockItem.speaker || 'FIGUR').trim().toUpperCase());
	const modifierValue = String(blockItem.modifier || '').trim();
	const openingCommand = modifierValue.length > 0
		? '\\begin{dialogue}[' + escapeLatexSpecialCharacters(modifierValue) + ']{' + speakerName + '}'
		: '\\begin{dialogue}{' + speakerName + '}';

	const segmentsList = Array.isArray(blockItem.segments) ? blockItem.segments : [];
	const compiledSegments = segmentsList
		.map(function formatSingleSegment(segmentItem) {
			const cleanText = escapeLatexSpecialCharacters(String(segmentItem.text || '').trim());
			if (cleanText.length === 0) {
				return '';
			}
			if (segmentItem.segmentType === 'parenthetical') {
				const withoutOuterParentheses = cleanText.replace(/^\(+|\)+$/g, '').trim();
				return '\\paren{' + withoutOuterParentheses + '}';
			}
			return cleanText;
		})
		.filter(function removeEmptyLines(lineText) {
			return lineText.length > 0;
		});

	if (compiledSegments.length === 0) {
		compiledSegments.push('...');
	}

	return [
		openingCommand,
		compiledSegments.join('\n'),
		'\\end{dialogue}'
	].join('\n');
}

export function compileTransitionBlockToLatex(blockItem) {
	const transitionText = escapeLatexSpecialCharacters(String(blockItem.transitionType || 'CUT TO:').trim().toUpperCase());
	return '\\begin{flushright}\n' + transitionText + '\n\\end{flushright}';
}

export function compileSingleBlockToLatex(blockItem) {
	if (blockItem.type === 'scene_heading') {
		return compileSceneHeadingBlockToLatex(blockItem);
	}
	if (blockItem.type === 'action') {
		return compileActionBlockToLatex(blockItem);
	}
	if (blockItem.type === 'dialogue') {
		return compileDialogueBlockToLatex(blockItem);
	}
	if (blockItem.type === 'transition') {
		return compileTransitionBlockToLatex(blockItem);
	}
	return '';
}

export function compileDocumentToLatexSource(documentRecord) {
	validateDocumentRecord(documentRecord);

	const escapedTitle = escapeLatexSpecialCharacters(documentRecord.title || 'Unbetiteltes Drehbuch');
	const escapedAuthor = escapeLatexSpecialCharacters(documentRecord.author || 'Unbekannter Autor');
	const escapedAddress = escapeLatexSpecialCharacters(documentRecord.address || '');

	const latexLines = [
		'\\documentclass{screenplay}',
		'\\usepackage[utf8]{inputenc}',
		'\\usepackage[T1]{fontenc}',
		'',
		'\\title{' + escapedTitle + '}',
		'\\author{' + escapedAuthor + '}'
	];

	if (escapedAddress.trim().length > 0) {
		latexLines.push('\\address{' + escapedAddress + '}');
	}

	latexLines.push('');
	latexLines.push('\\begin{document}');

	if (documentRecord.includeTitlePage) {
		latexLines.push('\\maketitle');
		latexLines.push('');
	}

	if (documentRecord.includeFadeIn) {
		latexLines.push('\\fadein');
		latexLines.push('');
	}

	for (const blockItem of documentRecord.blocks) {
		const compiledBlock = compileSingleBlockToLatex(blockItem);
		if (compiledBlock.length > 0) {
			latexLines.push(compiledBlock);
			latexLines.push('');
		}
	}

	if (documentRecord.includeFadeOut) {
		latexLines.push('\\fadeout');
		latexLines.push('');
	}

	if (documentRecord.includeTheEnd) {
		latexLines.push('\\theend');
		latexLines.push('');
	}

	latexLines.push('\\end{document}');
	return latexLines.join('\n');
}

export function parseArtificialIntelligenceTextIntoBlocks(rawScriptText, identifierFactoryFunction) {
	if (typeof rawScriptText !== 'string' || rawScriptText.trim().length === 0) {
		throw new Error('Der eingefuegte Text darf nicht leer sein.');
	}
	if (typeof identifierFactoryFunction !== 'function') {
		throw new Error('Eine Generatorfunktion fuer eindeutige Kennungen ist erforderlich.');
	}

	const rawLines = rawScriptText.replace(/\r\n/g, '\n').split('\n');
	const parsedBlocks = [];
	let activeDialogueBlock = null;
	let actionParagraphBuffer = [];

	function flushActionBuffer() {
		if (actionParagraphBuffer.length > 0) {
			parsedBlocks.push({
				identifier: identifierFactoryFunction(),
				type: 'action',
				content: actionParagraphBuffer.join(' ')
			});
			actionParagraphBuffer = [];
		}
	}

	function flushDialogueBuffer() {
		if (activeDialogueBlock !== null) {
			if (activeDialogueBlock.segments.length === 0) {
				activeDialogueBlock.segments.push({
					identifier: identifierFactoryFunction(),
					segmentType: 'speech',
					text: ''
				});
			}
			parsedBlocks.push(activeDialogueBlock);
			activeDialogueBlock = null;
		}
	}

	for (const singleLine of rawLines) {
		const trimmedLine = singleLine.trim();

		if (trimmedLine.length === 0) {
			flushActionBuffer();
			flushDialogueBuffer();
			continue;
		}

		const sceneMatch = trimmedLine.match(/^(INT\.|EXT\.|INNEN\.|AUSSEN\.|INT|EXT)\s+([^-\n]+?)(?:\s+-\s+(.+))?$/i);
		if (sceneMatch !== null) {
			flushActionBuffer();
			flushDialogueBuffer();
			const rawPrefix = sceneMatch[1].toUpperCase();
			const environmentCode = (rawPrefix.startsWith('EXT') || rawPrefix.startsWith('AUSSEN')) ? 'EXT' : 'INT';
			parsedBlocks.push({
				identifier: identifierFactoryFunction(),
				type: 'scene_heading',
				environment: environmentCode,
				location: sceneMatch[2].trim().toUpperCase(),
				timeOfDay: sceneMatch[3] ? sceneMatch[3].trim().toUpperCase() : 'DAY'
			});
			continue;
		}

		const transitionMatch = trimmedLine.match(/^(CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|FADE TO BLACK\.)$/i);
		if (transitionMatch !== null) {
			flushActionBuffer();
			flushDialogueBuffer();
			parsedBlocks.push({
				identifier: identifierFactoryFunction(),
				type: 'transition',
				transitionType: transitionMatch[1].toUpperCase()
			});
			continue;
		}

		const speakerMatch = trimmedLine.match(/^([A-ZÄÖÜ][A-ZÄÖÜ0-9\s.-]{1,28})(?:\s*\((V\.O\.|O\.S\.|CONT'D|FILTERED)\))?$/);
		if (speakerMatch !== null && activeDialogueBlock === null && !trimmedLine.endsWith('.')) {
			flushActionBuffer();
			activeDialogueBlock = {
				identifier: identifierFactoryFunction(),
				type: 'dialogue',
				speaker: speakerMatch[1].trim(),
				modifier: speakerMatch[2] ? speakerMatch[2].trim() : '',
				segments: []
			};
			continue;
		}

		if (activeDialogueBlock !== null) {
			if (trimmedLine.startsWith('(') && trimmedLine.endsWith(')')) {
				activeDialogueBlock.segments.push({
					identifier: identifierFactoryFunction(),
					segmentType: 'parenthetical',
					text: trimmedLine.slice(1, -1).trim()
				});
			} else {
				activeDialogueBlock.segments.push({
					identifier: identifierFactoryFunction(),
					segmentType: 'speech',
					text: trimmedLine
				});
			}
			continue;
		}

		actionParagraphBuffer.push(trimmedLine);
	}

	flushActionBuffer();
	flushDialogueBuffer();
	return parsedBlocks;
}

export function buildArtificialIntelligenceSystemPrompt() {
	return [
		'Schreibe die folgende Drehbuch-Szene im klassischen Hollywood-Standardformat, damit ich sie direkt in mein LaTeX-Screenplay-Tool einfuegen kann:',
		'1. Jede Szene beginnt mit INT. SCHAUPLATZ - TAGESZEIT oder EXT. SCHAUPLATZ - TAGESZEIT.',
		'2. Handlungsbeschreibungen stehen als normale Absaetze zwischen Leerzeilen.',
		'3. Sprechende Figuren stehen allein in einer Zeile in GROSSBUCHSTABEN (optional mit (V.O.), (O.S.) oder (CONT\'D)).',
		'4. Regieanweisungen im Dialog stehen in einer eigenen Zeile in runden Klammern, z. B. (fluesternd).',
		'5. Direkt darunter folgt der gesprochene Dialogtext ohne Anfuehrungszeichen.'
	].join('\n');
}