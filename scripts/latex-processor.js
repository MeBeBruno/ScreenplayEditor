import { validateScreenplayDocument } from './domain-logic.js';

const LEGACY_TRANSITION_TRANSLATION_MAP = {
	'CUT TO:': 'SCHNITT AUF:',
	'DISSOLVE TO:': 'ÜBERBLENDUNG AUF:',
	'SMASH CUT TO:': 'HARTER SCHNITT AUF:',
	'MATCH CUT TO:': 'MATCH CUT AUF:',
	'FADE TO BLACK.': 'SCHWARZBLENDE.'
};

export function normalizeTransitionLabel(rawTransitionValue) {
	const cleanedTransition = String(rawTransitionValue || '').trim().toUpperCase();
	if (cleanedTransition.length === 0) {
		return 'SCHNITT AUF:';
	}
	return LEGACY_TRANSITION_TRANSLATION_MAP[cleanedTransition] || cleanedTransition;
}

export function convertPlainTextToScreenplayLatex(rawText) {
	if (typeof rawText !== 'string') {
		return '';
	}
	const symbolMap = {
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
	const escapedString = rawText.replace(/[\\{}$&#^_%~]/g, function mapChar(characterSymbol) {
		return symbolMap[characterSymbol] || characterSymbol;
	});

	return escapedString
		.replace(/\s+--\s+/g, '~-- ')
		.replace(/\.{3}/g, '\\dots ');
}

export function convertLatexTokensToPlainText(latexFragment) {
	if (typeof latexFragment !== 'string') {
		return '';
	}
	return latexFragment
		.replace(/~--/g, ' --')
		.replace(/\\dots\s*/g, '...')
		.replace(/\\&/g, '&')
		.replace(/\\%/g, '%')
		.replace(/\\\$/g, '$')
		.replace(/\\#/g, '#')
		.replace(/\\_/g, '_')
		.replace(/\\\{/g, '{')
		.replace(/\\\}/g, '}')
		.replace(/\s+/g, ' ')
		.trim();
}

export function compileAddressToLatexLines(rawAddressText) {
	const cleanLines = String(rawAddressText || '')
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map(function trimAndEscapeLine(singleLine) {
			return convertPlainTextToScreenplayLatex(singleLine.trim());
		})
		.filter(function keepNonEmptyLine(singleLine) {
			return singleLine.length > 0;
		});

	if (cleanLines.length === 0) {
		return '';
	}
	return '\\address{\n' + cleanLines.join('\\\\\n') + '}';
}

export function compileSceneBlockToLatex(blockItem) {
	const commandMap = {
		INT: '\\intslug',
		EXT: '\\extslug',
		INTEXT: '\\intextslug',
		EXTINT: '\\extintslug'
	};
	const slugCommand = commandMap[blockItem.environment] || '\\intslug';
	const locationValue = convertPlainTextToScreenplayLatex(String(blockItem.location || 'Raum').trim());
	const timeValue = String(blockItem.timeOfDay || '').trim();

	if (timeValue.length > 0) {
		return slugCommand + '[' + convertPlainTextToScreenplayLatex(timeValue) + ']{' + locationValue + '}';
	}
	return slugCommand + '{' + locationValue + '}';
}

export function compileDialogueBlockToLatex(blockItem) {
	const speakerName = convertPlainTextToScreenplayLatex(String(blockItem.speaker || 'Figur').trim());
	const rawSegments = Array.isArray(blockItem.segments) ? blockItem.segments : [];

	let leadingModifier = '';
	let startSegmentIndex = 0;

	if (rawSegments.length > 0 && rawSegments[0].segmentType === 'parenthetical') {
		const firstParenText = String(rawSegments[0].text || '').trim().replace(/^\(+|\)+$/g, '');
		if (firstParenText.length > 0) {
			leadingModifier = convertPlainTextToScreenplayLatex(firstParenText);
			startSegmentIndex = 1;
		}
	}

	const beginDialogueLine = leadingModifier.length > 0
		? '\\begin{dialogue}[' + leadingModifier + ']{' + speakerName + '}'
		: '\\begin{dialogue}{' + speakerName + '}';

	const bodyLines = [];
	for (let index = startSegmentIndex; index < rawSegments.length; index += 1) {
		const segmentItem = rawSegments[index];
		const rawSegmentText = String(segmentItem.text || '').trim();
		if (rawSegmentText.length === 0) {
			continue;
		}
		if (segmentItem.segmentType === 'parenthetical') {
			const cleanParen = convertPlainTextToScreenplayLatex(rawSegmentText.replace(/^\(+|\)+$/g, '').trim());
			bodyLines.push('\t\\paren{' + cleanParen + '}');
		} else {
			bodyLines.push('\t' + convertPlainTextToScreenplayLatex(rawSegmentText));
		}
	}

	if (bodyLines.length === 0) {
		bodyLines.push('\t...');
	}

	return [beginDialogueLine, bodyLines.join('\n'), '\\end{dialogue}'].join('\n');
}

export function compileScreenplayDocumentToLatex(documentRecord) {
	validateScreenplayDocument(documentRecord);

	const outputLines = [
		'\\documentclass{screenplay}[2012/06/30]',
		'',
		'\\title{' + convertPlainTextToScreenplayLatex(documentRecord.title || 'Unbetiteltes Drehbuch') + '}',
		'',
		'\\author{' + convertPlainTextToScreenplayLatex(documentRecord.author || 'Anonym') + '}'
	];

	const compiledAddress = compileAddressToLatexLines(documentRecord.address);
	if (compiledAddress.length > 0) {
		outputLines.push('');
		outputLines.push(compiledAddress);
	}

	outputLines.push('');
	outputLines.push('\\begin{document}');
	outputLines.push('');

	if (documentRecord.includeTitlePage) {
		outputLines.push('\\coverpage');
	}

	if (documentRecord.includeFadeIn) {
		outputLines.push('\\fadein');
	}

	for (const blockItem of documentRecord.blocks) {
		if (blockItem.type === 'scene_heading') {
			outputLines.push(compileSceneBlockToLatex(blockItem));
			outputLines.push('');
		} else if (blockItem.type === 'action') {
			const cleanAction = String(blockItem.content || '').trim();
			if (cleanAction.length > 0) {
				outputLines.push(convertPlainTextToScreenplayLatex(cleanAction));
				outputLines.push('');
			}
		} else if (blockItem.type === 'dialogue') {
			outputLines.push(compileDialogueBlockToLatex(blockItem));
			outputLines.push('');
		} else if (blockItem.type === 'transition') {
			const transitionString = convertPlainTextToScreenplayLatex(normalizeTransitionLabel(blockItem.transitionType));
			outputLines.push('\\begin{flushright}\n' + transitionString + '\n\\end{flushright}');
			outputLines.push('');
		}
	}

	if (documentRecord.includeFadeOut) {
		outputLines.push('\\fadeout');
	}

	if (documentRecord.includeTheEnd) {
		outputLines.push('\\theend');
	}

	outputLines.push('\\end{document}');
	return outputLines.join('\n');
}

export function parseLatexScreenplaySource(latexSourceString, identifierGenerator) {
	const metadataPatch = {};

	const titleMatch = latexSourceString.match(/\\title\{([\s\S]*?)\}/);
	if (titleMatch !== null) {
		metadataPatch.title = convertLatexTokensToPlainText(titleMatch[1]);
	}

	const authorMatch = latexSourceString.match(/\\author\{([\s\S]*?)\}/);
	if (authorMatch !== null) {
		metadataPatch.author = convertLatexTokensToPlainText(authorMatch[1]);
	}

	const addressMatch = latexSourceString.match(/\\address\{([\s\S]*?)\}/);
	if (addressMatch !== null) {
		metadataPatch.address = addressMatch[1]
			.split(/\\\\/)
			.map(function cleanAddressLine(lineText) {
				return convertLatexTokensToPlainText(lineText);
			})
			.filter(function keepNonEmpty(lineText) {
				return lineText.length > 0;
			})
			.join('\n');
	}

	if (latexSourceString.includes('\\coverpage') || latexSourceString.includes('\\maketitle')) {
		metadataPatch.includeTitlePage = true;
	}
	if (latexSourceString.includes('\\fadein')) {
		metadataPatch.includeFadeIn = true;
	}
	if (latexSourceString.includes('\\fadeout')) {
		metadataPatch.includeFadeOut = true;
	}
	if (latexSourceString.includes('\\theend')) {
		metadataPatch.includeTheEnd = true;
	}

	let bodyContent = latexSourceString;
	const beginDocumentIndex = bodyContent.indexOf('\\begin{document}');
	if (beginDocumentIndex !== -1) {
		bodyContent = bodyContent.slice(beginDocumentIndex + '\\begin{document}'.length);
	}
	const endDocumentIndex = bodyContent.indexOf('\\end{document}');
	if (endDocumentIndex !== -1) {
		bodyContent = bodyContent.slice(0, endDocumentIndex);
	}

	bodyContent = bodyContent
		.replace(/\\coverpage/g, '')
		.replace(/\\maketitle/g, '')
		.replace(/\\fadein/g, '')
		.replace(/\\fadeout/g, '')
		.replace(/\\theend/g, '');

	const tokenRegex = /\\(intslug|extslug|intextslug|extintslug)(?:\[([^\]]*)\])?\{([^}]*)\}|\\begin\{dialogue\}(?:\[([^\]]*)\])?\{([^}]*)\}([\s\S]*?)\\end\{dialogue\}|\\begin\{flushright\}([\s\S]*?)\\end\{flushright\}/g;

	const extractedBlocks = [];
	let lastProcessedIndex = 0;
	let matchResult = tokenRegex.exec(bodyContent);

	function appendActionParagraphsFromSlice(rawSlice) {
		const paragraphs = rawSlice.split(/\n\s*\n/);
		for (const rawParagraph of paragraphs) {
			const cleanedParagraph = convertLatexTokensToPlainText(rawParagraph);
			if (cleanedParagraph.length > 0) {
				extractedBlocks.push({
					identifier: identifierGenerator(),
					type: 'action',
					content: cleanedParagraph
				});
			}
		}
	}

	while (matchResult !== null) {
		const precedingText = bodyContent.slice(lastProcessedIndex, matchResult.index);
		appendActionParagraphsFromSlice(precedingText);

		if (matchResult[1]) {
			const commandName = matchResult[1].toLowerCase();
			const envMap = {
				intslug: 'INT',
				extslug: 'EXT',
				intextslug: 'INTEXT',
				extintslug: 'EXTINT'
			};
			const rawTimeOfDay = matchResult[2] ? convertLatexTokensToPlainText(matchResult[2]) : 'TAG';
			const normalizedTimeOfDay = rawTimeOfDay.toLowerCase() === 'day' ? 'TAG' : rawTimeOfDay;
			extractedBlocks.push({
				identifier: identifierGenerator(),
				type: 'scene_heading',
				environment: envMap[commandName] || 'INT',
				location: convertLatexTokensToPlainText(matchResult[3]),
				timeOfDay: normalizedTimeOfDay
			});
		} else if (matchResult[5] !== undefined) {
			const optionalDirection = matchResult[4] ? convertLatexTokensToPlainText(matchResult[4]) : '';
			const speakerName = convertLatexTokensToPlainText(matchResult[5]);
			const rawDialogueInner = matchResult[6] || '';
			const dialogueSegments = [];

			if (optionalDirection.length > 0) {
				dialogueSegments.push({
					identifier: identifierGenerator(),
					segmentType: 'parenthetical',
					text: optionalDirection
				});
			}

			const innerParts = rawDialogueInner.split(/\\paren\{([^}]*)\}/g);
			for (let partIndex = 0; partIndex < innerParts.length; partIndex += 1) {
				const partText = convertLatexTokensToPlainText(innerParts[partIndex]);
				if (partText.length === 0) {
					continue;
				}
				if (partIndex % 2 === 1) {
					dialogueSegments.push({
						identifier: identifierGenerator(),
						segmentType: 'parenthetical',
						text: partText
					});
				} else {
					dialogueSegments.push({
						identifier: identifierGenerator(),
						segmentType: 'speech',
						text: partText
					});
				}
			}

			if (dialogueSegments.length === 0) {
				dialogueSegments.push({
					identifier: identifierGenerator(),
					segmentType: 'speech',
					text: ''
				});
			}

			extractedBlocks.push({
				identifier: identifierGenerator(),
				type: 'dialogue',
				speaker: speakerName,
				segments: dialogueSegments
			});
		} else if (matchResult[7] !== undefined) {
			extractedBlocks.push({
				identifier: identifierGenerator(),
				type: 'transition',
				transitionType: normalizeTransitionLabel(convertLatexTokensToPlainText(matchResult[7]))
			});
		}

		lastProcessedIndex = tokenRegex.lastIndex;
		matchResult = tokenRegex.exec(bodyContent);
	}

	appendActionParagraphsFromSlice(bodyContent.slice(lastProcessedIndex));

	return {
		metadataPatch: metadataPatch,
		blocks: extractedBlocks
	};
}

function resolveEnvironmentCodeFromPrefix(rawPrefixString) {
	const normalizedPrefix = rawPrefixString.toUpperCase().replace(/\./g, '');
	if (normalizedPrefix === 'INT/EXT' || normalizedPrefix === 'INNEN/AUSSEN') {
		return 'INTEXT';
	}
	if (normalizedPrefix === 'EXT/INT' || normalizedPrefix === 'AUSSEN/INNEN') {
		return 'EXTINT';
	}
	if (normalizedPrefix.startsWith('EXT') || normalizedPrefix.startsWith('AUSSEN')) {
		return 'EXT';
	}
	return 'INT';
}

export function parsePlainTextScreenplay(rawPlainText, identifierGenerator) {
	const rawLines = rawPlainText.replace(/\r\n/g, '\n').split('\n');
	const parsedBlocks = [];
	let currentDialogue = null;
	let currentActionLines = [];

	function flushActionLines() {
		if (currentActionLines.length > 0) {
			parsedBlocks.push({
				identifier: identifierGenerator(),
				type: 'action',
				content: currentActionLines.join(' ')
			});
			currentActionLines = [];
		}
	}

	function flushDialogueBlock() {
		if (currentDialogue !== null) {
			if (currentDialogue.segments.length === 0) {
				currentDialogue.segments.push({
					identifier: identifierGenerator(),
					segmentType: 'speech',
					text: ''
				});
			}
			parsedBlocks.push(currentDialogue);
			currentDialogue = null;
		}
	}

	for (const lineItem of rawLines) {
		const trimmedLine = lineItem.trim();
		if (trimmedLine.length === 0) {
			flushActionLines();
			flushDialogueBlock();
			continue;
		}

		const slugMatch = trimmedLine.match(/^(INT\.\/EXT\.|EXT\.\/INT\.|INT\.|EXT\.|INNEN\/AUSSEN\.?|AUSSEN\/INNEN\.?|INNEN\.?|AUSSEN\.?)\s+([^-\n]+?)(?:\s+-\s+(.+))?$/i);
		if (slugMatch !== null) {
			flushActionLines();
			flushDialogueBlock();
			const environmentValue = resolveEnvironmentCodeFromPrefix(slugMatch[1]);
			const rawTime = slugMatch[3] ? slugMatch[3].trim().toUpperCase() : 'TAG';
			parsedBlocks.push({
				identifier: identifierGenerator(),
				type: 'scene_heading',
				environment: environmentValue,
				location: slugMatch[2].trim(),
				timeOfDay: rawTime === 'DAY' ? 'TAG' : rawTime
			});
			continue;
		}

		const transitionMatch = trimmedLine.match(/^(CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|FADE TO BLACK\.|SCHNITT AUF:|ÜBERBLENDUNG AUF:|HARTER SCHNITT AUF:|MATCH CUT AUF:|SCHWARZBLENDE\.)$/i);
		if (transitionMatch !== null) {
			flushActionLines();
			flushDialogueBlock();
			parsedBlocks.push({
				identifier: identifierGenerator(),
				type: 'transition',
				transitionType: normalizeTransitionLabel(transitionMatch[1])
			});
			continue;
		}

		const characterMatch = trimmedLine.match(/^([A-ZÄÖÜ][A-ZÄÖÜ0-9\s.-]{1,28})(?:\s*\(([^)]+)\))?$/);
		if (characterMatch !== null && currentDialogue === null && !trimmedLine.endsWith('.')) {
			flushActionLines();
			const segmentsList = [];
			if (characterMatch[2]) {
				segmentsList.push({
					identifier: identifierGenerator(),
					segmentType: 'parenthetical',
					text: characterMatch[2].trim()
				});
			}
			currentDialogue = {
				identifier: identifierGenerator(),
				type: 'dialogue',
				speaker: characterMatch[1].trim(),
				segments: segmentsList
			};
			continue;
		}

		if (currentDialogue !== null) {
			if (trimmedLine.startsWith('(') && trimmedLine.endsWith(')')) {
				currentDialogue.segments.push({
					identifier: identifierGenerator(),
					segmentType: 'parenthetical',
					text: trimmedLine.slice(1, -1).trim()
				});
			} else {
				currentDialogue.segments.push({
					identifier: identifierGenerator(),
					segmentType: 'speech',
					text: trimmedLine
				});
			}
			continue;
		}

		currentActionLines.push(trimmedLine);
	}

	flushActionLines();
	flushDialogueBlock();

	return {
		metadataPatch: {},
		blocks: parsedBlocks
	};
}

export function parseUniversalScriptInput(rawInputString, identifierGenerator) {
	if (typeof rawInputString !== 'string' || rawInputString.trim().length === 0) {
		throw new Error('Bitte zuerst einen Text oder LaTeX-Code einfügen.');
	}
	const looksLikeLatex = rawInputString.includes('\\documentclass')
		|| rawInputString.includes('\\begin{dialogue}')
		|| rawInputString.includes('\\intslug')
		|| rawInputString.includes('\\extslug');

	if (looksLikeLatex) {
		return parseLatexScreenplaySource(rawInputString, identifierGenerator);
	}
	return parsePlainTextScreenplay(rawInputString, identifierGenerator);
}

export function buildPromptTemplateForArtificialIntelligence() {
	return [
		'Schreibe die Szene entweder als LaTeX für \\documentclass{screenplay}[2012/06/30] (mit \\intslug[TAG]{Ort} und \\begin{dialogue}[Regie]{Figur} ... \\end{dialogue}) oder im klassischen Drehbuchformat:',
		'INNEN SCHAUPLATZ - TAG',
		'Handlungstext als Absatz.',
		'FIGURENNAME (optional Regieanweisung)',
		'Gesprochener Dialogtext.'
	].join('\n');
}