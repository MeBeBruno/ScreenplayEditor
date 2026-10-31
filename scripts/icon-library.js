const LUCIDE_ICON_SVG_MAP = {
	arrowLeft: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'m12 19-7-7 7-7\'/><path d=\'M19 12H5\'/></svg>',
	clapperboard: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z\'/><path d=\'m6.2 5.3 3.1 3.9\'/><path d=\'m12.4 3.4 3.1 4\'/><path d=\'M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z\'/></svg>',
	helpCircle: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><circle cx=\'12\' cy=\'12\' r=\'10\'/><path d=\'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\'/><path d=\'M12 17h.01\'/></svg>',
	sparkles: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z\'/><path d=\'M5 3v4\'/><path d=\'M19 17v4\'/><path d=\'M3 5h4\'/><path d=\'M17 19h4\'/></svg>',
	printer: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\'/><path d=\'M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6\'/><rect x=\'6\' y=\'14\' width=\'12\' height=\'8\' rx=\'1\'/></svg>',
	externalLink: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'M15 3h6v6\'/><path d=\'M10 14 21 3\'/><path d=\'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\'/></svg>',
	chevronDown: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'m6 9 6 6 6-6\'/></svg>',
	copy: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><rect width=\'14\' height=\'14\' x=\'8\' y=\'8\' rx=\'2\' ry=\'2\'/><path d=\'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\'/></svg>',
	download: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\'/><polyline points=\'7 10 12 15 17 10\'/><line x1=\'12\' x2=\'12\' y1=\'15\' y2=\'3\'/></svg>',
	upload: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\'/><polyline points=\'17 8 12 3 7 8\'/><line x1=\'12\' x2=\'12\' y1=\'3\' y2=\'15\'/></svg>',
	sunMoon: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4\'/><path d=\'M12 2v2\'/><path d=\'M12 20v2\'/><path d=\'m4.9 4.9 1.4 1.4\'/><path d=\'m17.7 17.7 1.4 1.4\'/><path d=\'M2 12h2\'/><path d=\'M20 12h2\'/><path d=\'m6.3 17.7-1.4 1.4\'/><path d=\'m19.1 4.9-1.4 1.4\'/></svg>',
	close: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'M18 6 6 18\'/><path d=\'m6 6 12 12\'/></svg>',
	search: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><circle cx=\'11\' cy=\'11\' r=\'8\'/><path d=\'m21 21-4.3-4.3\'/></svg>',
	sortDescending: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'m3 16 4 4 4-4\'/><path d=\'M7 20V4\'/><path d=\'M11 4h10\'/><path d=\'M11 8h7\'/><path d=\'M11 12h4\'/></svg>',
	sortAscending: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'m3 8 4-4 4 4\'/><path d=\'M7 4v16\'/><path d=\'M11 12h4\'/><path d=\'M11 16h7\'/><path d=\'M11 20h10\'/></svg>',
	moreHorizontal: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><circle cx=\'12\' cy=\'12\' r=\'1\'/><circle cx=\'19\' cy=\'12\' r=\'1\'/><circle cx=\'5\' cy=\'12\' r=\'1\'/></svg>',
	sliders: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><line x1=\'4\' x2=\'4\' y1=\'21\' y2=\'14\'/><line x1=\'4\' x2=\'4\' y1=\'10\' y2=\'3\'/><line x1=\'12\' x2=\'12\' y1=\'21\' y2=\'12\'/><line x1=\'12\' x2=\'12\' y1=\'8\' y2=\'3\'/><line x1=\'20\' x2=\'20\' y1=\'21\' y2=\'16\'/><line x1=\'20\' x2=\'20\' y1=\'12\' y2=\'3\'/><line x1=\'2\' x2=\'6\' y1=\'14\' y2=\'14\'/><line x1=\'10\' x2=\'14\' y1=\'8\' y2=\'8\'/><line x1=\'18\' x2=\'22\' y1=\'16\' y2=\'16\'/></svg>',
	plus: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'M5 12h14\'/><path d=\'M12 5v14\'/></svg>',
	arrowUp: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'m18 15-6-6-6 6\'/></svg>',
	arrowDown: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'m6 9 6 6 6-6\'/></svg>',
	trash: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'M3 6h18\'/><path d=\'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\'/><path d=\'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\'/></svg>',
	check: '<svg viewBox=\'0 0 24 24\' aria-hidden=\'true\'><path d=\'M20 6 9 17l-5-5\'/></svg>'
};

const ONBOARDING_ILLUSTRATION_SVG_MAP = {
	stepOneIllustration: '<svg viewBox=\'0 0 200 110\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\' aria-hidden=\'true\'><rect x=\'18\' y=\'14\' width=\'76\' height=\'82\' rx=\'6\' stroke=\'currentColor\' stroke-width=\'3\'/><line x1=\'30\' y1=\'32\' x2=\'78\' y2=\'32\' stroke=\'currentColor\' stroke-width=\'3\' stroke-linecap=\'round\'/><line x1=\'30\' y1=\'48\' x2=\'82\' y2=\'48\' stroke=\'currentColor\' stroke-width=\'3\' stroke-linecap=\'round\'/><line x1=\'30\' y1=\'64\' x2=\'64\' y2=\'64\' stroke=\'currentColor\' stroke-width=\'3\' stroke-linecap=\'round\'/><path d=\'M106 55H132M132 55L122 45M132 55L122 65\' stroke=\'currentColor\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/><rect x=\'142\' y=\'22\' width=\'42\' height=\'66\' rx=\'6\' stroke=\'currentColor\' stroke-width=\'3\'/></svg>',
	stepTwoIllustration: '<svg viewBox=\'0 0 200 110\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\' aria-hidden=\'true\'><rect x=\'24\' y=\'16\' width=\'152\' height=\'22\' rx=\'4\' stroke=\'currentColor\' stroke-width=\'3\'/><rect x=\'54\' y=\'48\' width=\'92\' height=\'44\' rx=\'4\' stroke=\'currentColor\' stroke-width=\'3\'/><line x1=\'76\' y1=\'62\' x2=\'124\' y2=\'62\' stroke=\'currentColor\' stroke-width=\'3\' stroke-linecap=\'round\'/><line x1=\'66\' y1=\'76\' x2=\'134\' y2=\'76\' stroke=\'currentColor\' stroke-width=\'3\' stroke-linecap=\'round\'/></svg>',
	stepThreeIllustration: '<svg viewBox=\'0 0 200 110\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\' aria-hidden=\'true\'><rect x=\'46\' y=\'12\' width=\'108\' height=\'86\' rx=\'6\' stroke=\'currentColor\' stroke-width=\'3\'/><path d=\'M82 54L96 68L122 42\' stroke=\'currentColor\' stroke-width=\'4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>'
};

export function getIconSvgMarkup(iconName) {
	return LUCIDE_ICON_SVG_MAP[iconName] || '';
}

export function getOnboardingIllustrationMarkup(illustrationName) {
	return ONBOARDING_ILLUSTRATION_SVG_MAP[illustrationName] || '';
}

export function createIconSpanElement(iconName) {
	const iconSpan = document.createElement('span');
	iconSpan.className = 'icon-slot';
	iconSpan.innerHTML = getIconSvgMarkup(iconName);
	return iconSpan;
}