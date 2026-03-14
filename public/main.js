let input, result, intro, favicon;
let debounceTimer = null;
let inFlight = false;

function truncate(str, max) {
	return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

async function check(url) {
	if (inFlight || !url || url.includes('..')) return;
	inFlight = true;
	try {
		const res = await fetch(`/site/${encodeURI(url)}`);
		const body = await res.json();

		// Build status string: "is up (200)" or "is responding (404 Not Found)"
		let status = body.resultText;
		if (body.code !== null && body.code !== undefined) {
			status += ` (${body.code}${body.statusText ? ' ' + body.statusText : ''})`;
		}

		// Compose parts separated by em dash
		const parts = [status];
		if (body.redirectedTo) {
			const displayUrl = body.redirectedTo.replace(/^https?:\/\//, '');
			parts.push(`via ${truncate(displayUrl, 40)}`);
		}
		parts.push(`${body.responseTime}ms`);

		result.textContent = parts.join(' \u2014 ');
		document.title = `${url} ${body.resultText}`;

		const isReachable = body.resultText === 'is up' || body.resultText === 'is responding';
		favicon.href = isReachable ? '/up-favicon.svg' : '/down-favicon.svg';
	} catch {
		result.textContent = 'could not connect';
		favicon.href = '/down-favicon.svg';
	} finally {
		inFlight = false;
	}
}

function inputHandler() {
	clearTimeout(debounceTimer);

	const hasValue = input.value.length > 0;
	intro[0].style.visibility = hasValue ? 'hidden' : 'visible';
	intro[1].style.display = hasValue ? 'none' : '';
	result.style.display = hasValue ? '' : 'none';

	if (!hasValue) {
		document.title = 'Is ... up?';
		favicon.href = '/def-favicon.svg';
		return;
	}

	result.textContent = 'is ...';
	debounceTimer = setTimeout(() => check(input.value), 250);
}

window.onload = () => {
	input = document.getElementById('site');
	result = document.getElementById('status');
	intro = document.getElementsByName('intro');
	favicon = document.getElementById('favicon');

	input.addEventListener('input', inputHandler);
	document.addEventListener('keydown', () => input.focus());
	document.addEventListener('click', () => input.focus());
};
