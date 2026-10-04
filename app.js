const CONFIG = {
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
	return block.querySelector('.editable-node') || block;
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
		const prefixSelect = createSelectElement(CONFIG.prefixes, block.getAttribute('data-prefix'), function(newVal) {
			block.setAttribute('data-prefix', newVal);
			block.querySelector('.sh-prefix').textContent = newVal + '. ';
		});
		const timeSelect = createSelectElement(CONFIG.times, block.getAttribute('data-time'), function(newVal) {
			block.setAttribute('data-time', newVal);
			block.querySelector('.sh-time').textContent = ' - ' + newVal;
		});
		container.appendChild(createFormGroup('Ort Prefix', prefixSelect));
		container.appendChild(createFormGroup('Daytime', timeSelect));
	} else if (type === 'character') {
		const extSelect = createSelectElement(CONFIG.extensions, block.getAttribute('data-extension'), function(newVal) {
			block.setAttribute('data-extension', newVal);
			const formatted = newVal ? ' (' + newVal + ')' : '';
			block.querySelector('.char-ext').textContent = formatted;
		});
		container.appendChild(createFormGroup('Way of talking', extSelect));
	} else if (type === 'transition') {
		const transSelect = createSelectElement(CONFIG.transitions, block.getAttribute('data-transition'), function(newVal) {
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
	addBtn.addEventListener('mousedown', function(e) {
		e.preventDefault();
		insertLogicalBlockAfter(block);
	});
	
	const delBtn = document.createElement('button');
	delBtn.className = 'action-btn del-btn';
	delBtn.textContent = '−';
	delBtn.addEventListener('mousedown', function(e) {
		e.preventDefault();
		deleteBlock(block);
	});

	actions.appendChild(addBtn);
	actions.appendChild(delBtn);
	block.appendChild(actions);

	if (type === 'scene_heading') {
		block.setAttribute('data-prefix', CONFIG.prefixes[0].val);
		block.setAttribute('data-time', CONFIG.times[0].val);

		const prefixNode = document.createElement('span');
		prefixNode.className = 'sh-prefix static-text';
		prefixNode.setAttribute('contenteditable', 'false');
		prefixNode.textContent = CONFIG.prefixes[0].val + '. ';

		const locationNode = document.createElement('span');
		locationNode.className = 'sh-location editable-node';
		locationNode.setAttribute('contenteditable', 'true');
		locationNode.setAttribute('data-placeholder', '[ ENTER LOCATION ]');
		locationNode.textContent = initialText;

		const timeNode = document.createElement('span');
		timeNode.className = 'sh-time static-text';
		timeNode.setAttribute('contenteditable', 'false');
		timeNode.textContent = ' - ' + CONFIG.times[0].val;

		block.appendChild(prefixNode);
		block.appendChild(locationNode);
		block.appendChild(timeNode);
	} else if (type === 'character') {
		block.setAttribute('data-extension', CONFIG.extensions[0].val);

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
		block.setAttribute('data-transition', CONFIG.transitions[0].val);
		
		const transText = document.createElement('span');
		transText.textContent = CONFIG.transitions[0].val;
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

function compileNativePDF() {
	if (state.isCompiling) {
		return;
	}
	state.isCompiling = true;
	
	const overlay = document.getElementById('compiler-overlay');
	const progressBar = document.getElementById('progress-bar');
	overlay.classList.remove('hidden');
	progressBar.style.width = '10%';
	
	setTimeout(function() {
		try {
			const { jsPDF } = window.jspdf;
			const doc = new jsPDF({ orientation: 'p', unit: 'in', format: 'letter' });
			
			doc.setFont('courier', 'normal');
			doc.setFontSize(12);
			
			const LINES_PER_PAGE = 54;
			let currentLine = 0;
			let pageNum = 0;
			
			function addPage() {
				doc.addPage();
				pageNum++;
				currentLine = 0;
				if (pageNum > 1) {
					doc.text(pageNum.toString() + '.', 7.5, 0.5, { align: 'right' });
				}
			}
			
			const title = document.getElementById('script-title').value.trim() || 'UNTITLED SCRIPT';
			const author = document.getElementById('script-author').value.trim() || 'UNKNOWN AUTHOR';
			
			doc.text(title.toUpperCase(), 4.25, 4.5, { align: 'center' });
			doc.text('written by', 4.25, 5.0, { align: 'center' });
			doc.text(author, 4.25, 5.5, { align: 'center' });
			
			addPage();
			
			const blocks = document.querySelectorAll('.script-block');
			let prevType = null;
			
			blocks.forEach(function(block) {
				const type = block.getAttribute('data-type');
				let text = '';
				let leftMargin = 1.5;
				let maxWidth = 6.0;
				let spacesBefore = 1;
				
				if (type === 'scene_heading') {
					const prefix = block.getAttribute('data-prefix');
					const loc = block.querySelector('.sh-location').textContent.trim();
					const time = block.getAttribute('data-time');
					text = (prefix + '. ' + loc + ' - ' + time).toUpperCase();
					spacesBefore = prevType === null ? 0 : 2;
				} else if (type === 'action') {
					text = getBlockText(block).trim();
					spacesBefore = prevType === null ? 0 : 2;
				} else if (type === 'character') {
					const name = block.querySelector('.char-name').textContent.trim().toUpperCase();
					const ext = block.getAttribute('data-extension');
					text = ext ? name + ' (' + ext + ')' : name;
					leftMargin = 3.7;
					maxWidth = 4.0;
					spacesBefore = 2;
				} else if (type === 'parenthetical') {
					const inner = block.querySelector('.paren-text').textContent.trim();
					text = '(' + inner + ')';
					leftMargin = 3.1;
					maxWidth = 2.0;
					spacesBefore = 1;
				} else if (type === 'dialogue') {
					text = getBlockText(block).trim();
					leftMargin = 2.5;
					maxWidth = 3.5;
					spacesBefore = 1;
				} else if (type === 'transition') {
					text = block.getAttribute('data-transition').toUpperCase();
					leftMargin = 5.5;
					maxWidth = 2.0;
					spacesBefore = 2;
				}
				
				if (text === '') {
					return;
				}
				
				const lines = doc.splitTextToSize(text, maxWidth);
				let linesNeeded = lines.length;
				
				if (type === 'character') {
					linesNeeded += 2;
				}
				
				if (currentLine + spacesBefore + linesNeeded > LINES_PER_PAGE) {
					addPage();
					spacesBefore = 0;
				}
				
				currentLine += spacesBefore;
				
				lines.forEach(function(line) {
					const yPos = 1.0 + (currentLine * (1/6));
					doc.text(line, leftMargin, yPos);
					currentLine++;
				});
				
				prevType = type;
			});
			
			progressBar.style.width = '100%';
			doc.save('script.pdf');
			
		} catch (error) {
			alert('Fehler bei der PDF-Generierung: ' + error.message);
		} finally {
			setTimeout(function() {
				overlay.classList.add('hidden');
				progressBar.style.width = '0%';
				state.isCompiling = false;
			}, 500);
		}
	}, 100);
}

function initializeEditor() {
	const container = document.getElementById('editor-container');
	const initialBlock = buildBlockDOM('scene_heading');
	container.appendChild(initialBlock);
	setCaretPosition(getEditableNode(initialBlock), 0);
	updateActiveState(initialBlock);

	document.getElementById('export-pdf-btn').addEventListener('click', compileNativePDF);
	
	document.getElementById('block-type-selector').addEventListener('change', function(event) {
		if (state.activeBlock && !event.target.options[event.target.selectedIndex].disabled) {
			morphBlock(state.activeBlock, event.target.value);
		}
	});
}

document.addEventListener('DOMContentLoaded', function() {
	try {
		initializeEditor();
	} catch (error) {
		console.error(error);
	}
});
