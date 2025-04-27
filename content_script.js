chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "copyText") {
        // 전달받은 텍스트를 복사하기 위해 임시 <textarea> 요소 생성
        const textarea = document.createElement("textarea");
        textarea.value = request.text || "";
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        // 텍스트 선택 및 클립보드 복사
        textarea.select();
        document.execCommand("copy");
        // 임시 요소 제거
        document.body.removeChild(textarea);
    }
});
