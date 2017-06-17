var input;
var result;
var intro;
//The minimum time the next request should be sent
var nextReqTime = Number.MAX_VALUE;

function check(url) {
	//Ensure that this request is the most recent one
	if (nextReqTime > new Date().getTime())
		return;
	if (!url || url.indexOf('..') != -1)
		return;
	var req = new XMLHttpRequest();
	req.open('GET', '/site/'+ encodeURI(url), true);
	req.onreadystatechange = function() {
		if (req.status === 200) {
			result.innerHTML = 'is ' +req.responseText;
			document.title = url + ' is ' + req.responseText;
		}
		locked = false;
	}
	req.onerror = function() { locked = false; };
	req.send();
};

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
	}

	//Reset status text on keypress
	result.innerHTML = 'is ...';
	
	//Check the sites status in 250ms
	window.setTimeout(function() { check(input.value); }, 250);
};

window.onload = function() {
	input = document.getElementById('site');
	result = document.getElementById('status');
	intro = document.getElementsByName('intro');
	input.onkeyup = function(event) { inputHandler(event) };
	//Ensure focus is on the text box
	document.onkeydown = input.focus;
	document.onclick = input.focus;
};
