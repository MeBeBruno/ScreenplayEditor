const LATEX_CONFIG = {
	prefixes: [
		{ val: 'INT', label: 'Interior' },
		{ val: 'EXT', label: 'Exterior' },
		{ val: 'INT/EXT', label: 'Interior/Exterior' }
	],
	times: [
		{ val: 'DAY', label: 'Daytime' },
		{ val: 'NIGHT', label: 'Nighttime' },
		{ val: 'CONTINUOUS', label: 'Continuous' },
		{ val: 'LATER', label: 'Later than previous' },
		{ val: 'MOMENTS LATER', label: 'Moments after previous' },
		{ val: 'DAWN', label: 'At dawn' },
		{ val: 'DUSK', label: 'At dusk' },
		{ val: 'SAME', label: 'With previous' }
	],
	extensions: [
		{ val: '', label: '-' },
		{ val: 'V.O.', label: 'Voice over' },
		{ val: 'O.S.', label: 'Off screen' },
		{ val: 'O.C.', label: 'Off camera' },
		{ val: 'CONT\'D', label: 'Continued' }
	],
	transitions: [
		{ val: 'CUT TO:', label: 'Cut to' },
		{ val: 'FADE IN:', label: 'Fade in' },
		{ val: 'FADE OUT.', label: 'Fade out' },
		{ val: 'DISSOLVE TO:', label: 'Dissolve to...' },
		{ val: 'SMASH CUT TO:', label: 'Smash cut to...' },
		{ val: 'MATCH CUT TO:', label: 'Match cut to...' },
		{ val: 'BLACKOUT.', label: 'Black out' }
	]
};

const state = {
	activeBlock: null,
	isCompiling: false
};

function getAllowedNextTypes(prevType) {
	if (!prevType) {
		return ['scene_heading', 'action'];
	}
	switch (prevType) {
		case 'scene_heading': return ['action', 'character'];
		case 'action': return ['scene_heading', 'action', 'character', 'transition'];
		case 'character': return ['dialogue', 'parenthetical'];
		case 'parenthetical': return ['dialogue'];
		case 'dialogue': return ['character', 'action', 'scene_heading', 'transition'];
		case 'transition': return ['scene_heading'];
		default: return ['action'];
	}
}

function getCaretPosition(element) {
	const selection = window.getSelection();
	if (selection.rangeCount === 0) {
		return 0;
	}
	const range = selection.getRangeAt(0);
	const preCaretRange = range.cloneRange();
	preCaretRange.selectNodeContents(element);
	preCaretRange.setEnd(range.endContainer, range.endOffset);
	return preCaretRange.toString().length;
}

function setCaretPosition(element, position) {
	element.focus();
	const selection = window.getSelection();
	const range = document.createRange();
	if (element.childNodes.length > 0) {
		const textNode = element.childNodes[0];
		range.setStart(textNode, Math.min(position, textNode.length));
		range.setEnd(textNode, Math.min(position, textNode.length));
	} else {
		range.setStart(element, 0);
		range.setEnd(element, 0);
	}
	selection.removeAllRanges();
	selection.addRange(range);
}

function getEditableNode(block) {
	if (block.getAttribute('contenteditable') === 'true') {
		return block;
	}
	const editable = block.querySelector('.editable-node');
	return editable || block;
}

function getBlockText(block) {
	return getEditableNode(block).textContent || '';
}

function enforceSyntaxRules(block) {
	const select = document.getElementById('block-type-selector');
	const prev = block.previousElementSibling;
	const prevType = prev ? prev.getAttribute('data-type') : null;
	const allowed = getAllowedNextTypes(prevType);
	
	Array.from(select.options).forEach(function(opt) {
		opt.disabled = !allowed.includes(opt.value);
	});

	const currentType = block.getAttribute('data-type');
	if (!allowed.includes(currentType)) {
		morphBlock(block, allowed[0], true);
		return false;
	}
	return true;
}

function createSelectElement(options, currentValue, onChangeCallback) {
	const select = document.createElement('select');
	options.forEach(function(optObj) {
		const option = document.createElement('option');
		option.value = optObj.val;
		option.textContent = optObj.label;
		if (optObj.val === currentValue) {
			option.selected = true;
		}
		select.appendChild(option);
	});
	select.addEventListener('change', function(event) {
		onChangeCallback(event.target.value);
	});
	return select;
}

function createFormGroup(labelText, selectElement) {
	const group = document.createElement('div');
	group.className = 'input-group';
	const label = document.createElement('label');
	label.textContent = labelText;
	group.appendChild(label);
	group.appendChild(selectElement);
	return group;
}

function renderContextControls(block) {
	const container = document.getElementById('context-controls');
	container.innerHTML = '';
	const type = block.getAttribute('data-type');

	if (type === 'scene_heading') {
		const prefixSelect = createSelectElement(LATEX_CONFIG.prefixes, block.getAttribute('data-prefix'), function(newVal) {
			block.setAttribute('data-prefix', newVal);
			block.querySelector('.sh-prefix').textContent = newVal + '. ';
		});
		const timeSelect = createSelectElement(LATEX_CONFIG.times, block.getAttribute('data-time'), function(newVal) {
			block.setAttribute('data-time', newVal);
			block.querySelector('.sh-time').textContent = ' - ' + newVal;
		});
		container.appendChild(createFormGroup('Ort Prefix', prefixSelect));
		container.appendChild(createFormGroup('Daytime', timeSelect));
	} else if (type === 'character') {
		const extSelect = createSelectElement(LATEX_CONFIG.extensions, block.getAttribute('data-extension'), function(newVal) {
			block.setAttribute('data-extension', newVal);
			const formatted = newVal ? ' (' + newVal + ')' : '';
			block.querySelector('.char-ext').textContent = formatted;
		});
		container.appendChild(createFormGroup('Way of talking', extSelect));
	} else if (type === 'transition') {
		const transSelect = createSelectElement(LATEX_CONFIG.transitions, block.getAttribute('data-transition'), function(newVal) {
			block.setAttribute('data-transition', newVal);
			block.textContent = newVal;
		});
		container.appendChild(createFormGroup('Type of cut', transSelect));
	}
}

function buildBlockDOM(type, initialText = '') {
	const block = document.createElement('div');
	block.className = 'script-block';
	block.setAttribute('data-type', type);

	const actions = document.createElement('aside');
	actions.className = 'block-actions';
	actions.setAttribute('contenteditable', 'false');
	
	const addBtn = document.createElement('button');
	addBtn.className = 'action-btn';
	addBtn.textContent = '+';
	addBtn.title = 'Append new block';
	addBtn.addEventListener('mousedown', function(e) {
		e.preventDefault();
		insertLogicalBlockAfter(block);
	});
	
	const delBtn = document.createElement('button');
	delBtn.className = 'action-btn del-btn';
	delBtn.textContent = '−';
	delBtn.title = 'Delete block';
	delBtn.addEventListener('mousedown', function(e) {
		e.preventDefault();
		deleteBlock(block);
	});

	actions.appendChild(addBtn);
	actions.appendChild(delBtn);
	block.appendChild(actions);

	if (type === 'scene_heading') {
		block.setAttribute('data-prefix', LATEX_CONFIG.prefixes[0].val);
		block.setAttribute('data-time', LATEX_CONFIG.times[0].val);

		const prefixNode = document.createElement('span');
		prefixNode.className = 'sh-prefix static-text';
		prefixNode.setAttribute('contenteditable', 'false');
		prefixNode.textContent = LATEX_CONFIG.prefixes[0].val + '. ';

		const locationNode = document.createElement('span');
		locationNode.className = 'sh-location editable-node';
		locationNode.setAttribute('contenteditable', 'true');
		locationNode.setAttribute('data-placeholder', '[ ENTER LOCATION ]');
		locationNode.textContent = initialText;

		const timeNode = document.createElement('span');
		timeNode.className = 'sh-time static-text';
		timeNode.setAttribute('contenteditable', 'false');
		timeNode.textContent = ' - ' + LATEX_CONFIG.times[0].val;

		block.appendChild(prefixNode);
		block.appendChild(locationNode);
		block.appendChild(timeNode);
	} else if (type === 'character') {
		block.setAttribute('data-extension', LATEX_CONFIG.extensions[0].val);

		const nameNode = document.createElement('span');
		nameNode.className = 'char-name editable-node';
		nameNode.setAttribute('contenteditable', 'true');
		nameNode.setAttribute('data-placeholder', '[ ENTER CHARACTER NAME ]');
		nameNode.textContent = initialText;

		const extNode = document.createElement('span');
		extNode.className = 'char-ext static-text';
		extNode.setAttribute('contenteditable', 'false');
		extNode.textContent = '';

		block.appendChild(nameNode);
		block.appendChild(extNode);
	} else if (type === 'parenthetical') {
		const openNode = document.createElement('span');
		openNode.className = 'static-text';
		openNode.setAttribute('contenteditable', 'false');
		openNode.textContent = '(';

		const textNode = document.createElement('span');
		textNode.className = 'paren-text editable-node';
		textNode.setAttribute('contenteditable', 'true');
		textNode.setAttribute('data-placeholder', 'Stage directions');
		textNode.textContent = initialText.replace(/[()]/g, '');

		const closeNode = document.createElement('span');
		closeNode.className = 'static-text';
		closeNode.setAttribute('contenteditable', 'false');
		closeNode.textContent = ')';

		block.appendChild(openNode);
		block.appendChild(textNode);
		block.appendChild(closeNode);
	} else if (type === 'transition') {
		block.setAttribute('contenteditable', 'false');
		block.setAttribute('tabindex', '0');
		block.setAttribute('data-transition', LATEX_CONFIG.transitions[0].val);
		
		const transText = document.createElement('span');
		transText.textContent = LATEX_CONFIG.transitions[0].val;
		block.appendChild(transText);
	} else {
		const textNode = document.createElement('span');
		textNode.className = 'editable-node';
		textNode.setAttribute('contenteditable', 'true');
		textNode.setAttribute('data-placeholder', type === 'dialogue' ? '[ ENTER DIALOGUE ]' : '[ ENTER ACTION ]');
		textNode.textContent = initialText;
		block.appendChild(textNode);
	}

	bindBlockEvents(block);
	return block;
}

function morphBlock(block, newType, fromAutoCorrect = false) {
	const currentText = getBlockText(block);
	const newBlock = buildBlockDOM(newType, currentText);
	block.parentNode.replaceChild(newBlock, block);
	
	if (!fromAutoCorrect) {
		updateActiveState(newBlock);
		const newEditable = getEditableNode(newBlock);
		if (newBlock.getAttribute('contenteditable') !== 'false') {
			setCaretPosition(newEditable, newEditable.textContent.length);
		} else {
			newBlock.focus();
		}
	}
}

function updateActiveState(block) {
	if (state.activeBlock === block) {
		return;
	}
	if (!enforceSyntaxRules(block)) {
		return;
	}
	state.activeBlock = block;
	const type = block.getAttribute('data-type');
	const selector = document.getElementById('block-type-selector');
	if (selector && selector.value !== type) {
		selector.value = type;
	}
	renderContextControls(block);
}

function insertLogicalBlockAfter(block) {
	const type = block.getAttribute('data-type');
	const allowedNext = getAllowedNextTypes(type);
	const nextType = allowedNext[0];
	const newBlock = buildBlockDOM(nextType, '');
	block.parentNode.insertBefore(newBlock, block.nextSibling);
	
	if (newBlock.getAttribute('contenteditable') !== 'false') {
		setCaretPosition(getEditableNode(newBlock), 0);
	} else {
		newBlock.focus();
	}
}

function deleteBlock(block) {
	const prev = block.previousElementSibling;
	const next = block.nextElementSibling;
	
	if (!prev && !next) {
		morphBlock(block, 'scene_heading');
		getEditableNode(block).textContent = '';
		return;
	}
	
	block.remove();
	
	const focusTarget = prev || next;
	if (focusTarget.getAttribute('contenteditable') !== 'false') {
		setCaretPosition(getEditableNode(focusTarget), getEditableNode(focusTarget).textContent.length);
	} else {
		focusTarget.focus();
	}
	
	if (next) {
		enforceSyntaxRules(next);
	}
}

function handleEnterKey(event, block) {
	event.preventDefault();
	const type = block.getAttribute('data-type');
	const editable = getEditableNode(block);
	
	if (type === 'transition') {
		insertLogicalBlockAfter(block);
		return;
	}

	const caretPos = getCaretPosition(editable);
	const text = editable.textContent;
	const textBefore = text.slice(0, caretPos);
	const textAfter = text.slice(caretPos);

	editable.textContent = textBefore;

	const isBlockEmpty = textBefore.trim().length === 0 && textAfter.trim().length === 0;
	const nextType = getAllowedNextTypes(type)[0];

	if (isBlockEmpty && type !== 'action') {
		morphBlock(block, 'action');
		return;
	}

	const newBlock = buildBlockDOM(nextType, textAfter);
	block.parentNode.insertBefore(newBlock, block.nextSibling);
	
	if (newBlock.getAttribute('contenteditable') !== 'false') {
		setCaretPosition(getEditableNode(newBlock), 0);
	} else {
		newBlock.focus();
	}
}

function handleBackspaceKey(event, block) {
	const editable = getEditableNode(block);
	if (block.getAttribute('data-type') === 'transition') {
		deleteBlock(block);
		return;
	}

	const caretPos = getCaretPosition(editable);
	const text = editable.textContent;

	if (caretPos === 0 && text.length === 0) {
		event.preventDefault();
		deleteBlock(block);
	} else if (caretPos === 0 && text.length > 0) {
		event.preventDefault();
		const previous = block.previousElementSibling;
		if (previous && previous.getAttribute('data-type') !== 'transition') {
			const prevEditable = getEditableNode(previous);
			const prevLength = prevEditable.textContent.length;
			prevEditable.textContent += text;
			block.remove();
			setCaretPosition(prevEditable, prevLength);
		}
	}
}

function bindBlockEvents(block) {
	const targetNode = block.getAttribute('contenteditable') === 'false' ? block : getEditableNode(block);

	targetNode.addEventListener('keydown', function(event) {
		if (event.key === 'Enter') {
			handleEnterKey(event, block);
		} else if (event.key === 'Backspace') {
			handleBackspaceKey(event, block);
		}
	});

	targetNode.addEventListener('focus', function() {
		updateActiveState(block);
	});

	targetNode.addEventListener('blur', function() {
		if (targetNode.textContent.trim() === '') {
			targetNode.innerHTML = '';
		}
	});

	targetNode.addEventListener('paste', function(event) {
		event.preventDefault();
		const paste = (event.clipboardData || window.clipboardData).getData('text/plain');
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		selection.deleteFromDocument();
		selection.getRangeAt(0).insertNode(document.createTextNode(paste));
		selection.collapseToEnd();
	});

	if (block.getAttribute('data-type') === 'scene_heading' || block.getAttribute('data-type') === 'character') {
		targetNode.addEventListener('input', function() {
			targetNode.textContent = targetNode.textContent.toUpperCase();
			setCaretPosition(targetNode, targetNode.textContent.length);
		});
	}
}

function escapeLatexChars(str) {
	return str.replace(/([&%$#_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
}

function generateLaTeXString() {
	const titleRaw = document.getElementById('script-title').value || 'UNTITLED SCRIPT';
	const authorRaw = document.getElementById('script-author').value || 'UNKNOWN AUTHOR';
	
	const title = escapeLatexChars(titleRaw);
	const author = escapeLatexChars(authorRaw);

	let tex = '\\documentclass[12pt]{screenplay}\n\n';
	tex += '\\title{' + title + '}\n';
	tex += '\\author{' + author + '}\n\n';
	tex += '\\begin{document}\n';
	tex += '\\coverpage\n\n';

	const blocks = document.querySelectorAll('.script-block');
	let inDialogue = false;

	blocks.forEach(function(block) {
		const type = block.getAttribute('data-type');
		
		if (inDialogue && type !== 'dialogue' && type !== 'parenthetical') {
			tex += '\\end{dialogue}\n\n';
			inDialogue = false;
		}

		if (type === 'scene_heading') {
			const prefix = block.getAttribute('data-prefix');
			const loc = escapeLatexChars(block.querySelector('.sh-location').textContent.trim());
			const time = escapeLatexChars(block.getAttribute('data-time'));
			
			if (prefix === 'INT') {
				tex += '\\int{' + loc + '}{' + time + '}\n\n';
			} else if (prefix === 'EXT') {
				tex += '\\ext{' + loc + '}{' + time + '}\n\n';
			} else {
				tex += '\\intext{' + loc + '}{' + time + '}\n\n'; 
			}
		} 
		else if (type === 'action') {
			const text = escapeLatexChars(getBlockText(block).trim());
			if (text) {
				tex += text + '\n\n';
			}
		}
		else if (type === 'character') {
			const name = escapeLatexChars(block.querySelector('.char-name').textContent.trim());
			const ext = escapeLatexChars(block.getAttribute('data-extension'));
			if (ext) {
				tex += '\\begin{dialogue}[' + ext + ']{' + name + '}\n';
			} else {
				tex += '\\begin{dialogue}{' + name + '}\n';
			}
			inDialogue = true;
		}
		else if (type === 'parenthetical') {
			const text = escapeLatexChars(block.querySelector('.paren-text').textContent.trim());
			if (text) {
				tex += '\\paren{' + text + '}\n';
			}
		}
		else if (type === 'dialogue') {
			const text = escapeLatexChars(getBlockText(block).trim());
			if (text) {
				tex += text + '\n';
			}
		}
		else if (type === 'transition') {
			const text = escapeLatexChars(block.getAttribute('data-transition'));
			if (text.includes('FADE IN')) {
				tex += '\\fadein\n\n';
			} else if (text.includes('FADE OUT')) {
				tex += '\\fadeout\n\n';
			} else {
				tex += '\\begin{flushright}\n' + text + '\n\\end{flushright}\n\n';
			}
		}
	});

	if (inDialogue) {
		tex += '\\end{dialogue}\n\n';
	}
	tex += '\\end{document}\n';
	return tex;
}

function showTexModal() {
	const texString = generateLaTeXString();
	const textarea = document.getElementById('tex-code-area');
	textarea.value = texString;
	document.getElementById('tex-modal').classList.remove('hidden');
	textarea.scrollTop = 0;
}

function closeTexModal() {
	document.getElementById('tex-modal').classList.add('hidden');
}

function copyTexCode() {
	const textarea = document.getElementById('tex-code-area');
	textarea.select();
	navigator.clipboard.writeText(textarea.value).then(function() {
		const btn = document.getElementById('copy-tex-btn');
		const originalText = btn.textContent;
		btn.textContent = 'Copied!';
		setTimeout(function() {
			btn.textContent = originalText;
		}, 2000);
	}).catch(function(err) {
		console.error('Copy error: ', err);
	});
}

function exportRawLaTeX() {
	const tex = document.getElementById('tex-code-area').value || generateLaTeXString();
	const blob = new Blob([tex], { type: 'text/plain;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'script.tex';
	a.click();
	URL.revokeObjectURL(url);
}

async function compilePDF() {
	if (state.isCompiling) {
		return;
	}
	
	state.isCompiling = true;
	const overlay = document.getElementById('compiler-overlay');
	const statusText = document.getElementById('compiler-status');
	const progressBar = document.getElementById('progress-bar');
	
	overlay.classList.remove('hidden');
	progressBar.style.width = '10%';
	
	try {
		statusText.textContent = 'Loading official screenplay.cls from CTAN...';
		const clsResponse = await fetch('https://mirrors.ctan.org/macros/latex/contrib/screenplay/screenplay.cls');
		if (!clsResponse.ok) {
			throw new Error('CTAN-Server for screenplay.cls is unreachable.');
		}
		const clsContent = await clsResponse.text();
		progressBar.style.width = '40%';

		statusText.textContent = 'Compiling via API...';
		const scriptLatex = generateLaTeXString();
		const fullCompileString = '\\begin{filecontents*}{screenplay.cls}\n' + clsContent + '\n\\end{filecontents*}\n' + scriptLatex;

		const pdfResponse = await fetch('https://latexonline.cc/compile', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: 'text=' + encodeURIComponent(fullCompileString)
		});

		if (!pdfResponse.ok) {
			throw new Error('API Compilation failed.');
		}

		progressBar.style.width = '80%';
		const blob = await pdfResponse.blob();
		const url = URL.createObjectURL(blob);
		
		progressBar.style.width = '100%';
		
		setTimeout(function() {
			const a = document.createElement('a');
			a.href = url;
			a.download = 'script.pdf';
			a.click();
			URL.revokeObjectURL(url);
			overlay.classList.add('hidden');
			progressBar.style.width = '0%';
			state.isCompiling = false;
		}, 500);

	} catch (error) {
		alert('Compilation error: ' + error.message);
		overlay.classList.add('hidden');
		progressBar.style.width = '0%';
		state.isCompiling = false;
	}
}

function initializeEditor() {
	const container = document.getElementById('editor-container');
	const initialBlock = buildBlockDOM('scene_heading');
	container.appendChild(initialBlock);
	setCaretPosition(getEditableNode(initialBlock), 0);
	updateActiveState(initialBlock);

	document.getElementById('show-tex-btn').addEventListener('click', showTexModal);
	document.getElementById('close-modal-btn').addEventListener('click', closeTexModal);
	document.getElementById('copy-tex-btn').addEventListener('click', copyTexCode);
	document.getElementById('download-tex-btn').addEventListener('click', exportRawLaTeX);
	
	document.getElementById('export-pdf-btn').addEventListener('click', compilePDF);
	
	document.getElementById('block-type-selector').addEventListener('change', function(event) {
		if (state.activeBlock && !event.target.options[event.target.selectedIndex].disabled) {
			morphBlock(state.activeBlock, event.target.value);
		}
	});
	
	document.getElementById('tex-modal').addEventListener('click', function(e) {
		if(e.target === this) {
			closeTexModal();
		}
	});
}

document.addEventListener('DOMContentLoaded', function() {
	try {
		initializeEditor();
	} catch (error) {
		console.error('Core Architecture Failure:', error);
	}
});
