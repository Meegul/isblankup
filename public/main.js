let input, result, intro, favicon;

//The minimum time the next request should be sent
let nextReqTime = Number.MAX_VALUE;
let locked = false;

function check(url) {
	//Ensure that this request is the most recent one
	if (locked || nextReqTime > new Date().getTime()) {
		return;
	}
	if (!url || url.indexOf('..') !== -1) {
		return;
	}
	const req = new XMLHttpRequest();
	req.open('GET', `/site/${encodeURI(url)}`, true);
	locked = true;
	req.onreadystatechange = function() {
		if (this.readyState === 4) {
			const body = JSON.parse(req.responseText);
			result.innerHTML = `${body.resultText} (${body.code})`;
			document.title = `${url} ${body.resultText}`;
			if (req.responseText.indexOf('up') !== -1) {
				favicon.href = '/up-favicon.png';
			} else { 
				favicon.href = '/down-favicon.png';
			}

			//Prevent other requests from being sent
			locked = false;
		}
	};
	req.onerror = () => { locked = false; };
	req.send();
}

function inputHandler(event) {
	//Delay sending a request for at least 250 ms after this keyup
	nextReqTime = new Date().getTime() + 250;

	//Escape from arrow keys.
	switch (event.keyCode) {
	case 37:
	case 38:
	case 39:
	case 40:
		return;
	default:
		break;
	}

	//Remove the intro text if the user has something in the text box.
	if (input.value.length > 0) {
		intro[0].style.visibility = 'hidden';
		intro[1].style.display = 'none';
		result.style.display = 'inherit';
	} else {
		intro[0].style.visibility = 'visible';
		intro[0].style.display = 'inherit';
		intro[1].style.display = 'inherit';
		result.style.display = 'none';
		document.title = 'Is ... up?';
		favicon.href = '/def-favicon.png';
	}

	//Reset status text on keypress
	result.innerHTML = 'is ...';

	//Check the sites status in 250ms
	window.setTimeout(() => { check(input.value); }, 250);
}

window.onload = function() {
	input = document.getElementById('site');
	result = document.getElementById('status');
	intro = document.getElementsByName('intro');
	favicon = document.getElementById('favicon');
	input.onkeyup = inputHandler;
	//Ensure focus is on the text box
	document.onkeydown = () => { input.focus(); };
	document.onclick = () => { input.focus(); };
};
