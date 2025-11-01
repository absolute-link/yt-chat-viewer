export function setErrorMsg(msg: string) {
    const errTarget = document.getElementById('error');
    if (!errTarget) return;

    errTarget.className = (msg.length) ? 'show' : '';
    errTarget.innerHTML = msg;
}

export function clearErrorMsg() {
    setErrorMsg('');
}
