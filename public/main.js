let lastPressed = new Date().getTime();
const input = document.getElementById('site');
const result = document.getElementById('status');
const intro = document.getElementsByName('intro');

//Ensure focus is on the text box
document.onkeydown = () => {
	input.focus();
};
document.onclick = () => {
	input.focus();
}

input.onkeyup = (event) => {
	//Escape from arrow keys.
	switch (event.keyCode) {
		case 37:
		case 38:
		case 39:
		case 40:
			return;
			break;
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
		intro[1].style.display = 'inherit';
		intro.forEach((item) => item.style.display = 'inherit');
		result.style.display = 'none';
		document.title = 'Is ... up?';
	}

	//Reset status text on keypress
	result.innerHTML = 'is ...';
	
	//Check the sites status.
	check(input.value);
};

const check = (url) => {
	if (!url || url.contains('..'))
		return;
	const req = new XMLHttpRequest();
	req.open('GET', `/site/${encodeURI(url)}`, true);
	req.onreadystatechange = () => {
		if (req.status === 200) {
			result.innerHTML = `is ${req.responseText}`;
			document.title = `${url} is ${req.responseText}`;
		}
	}
	req.send();
};
