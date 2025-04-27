// 확장 프로그램 설치 시 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "remove_invisible_chars",
        title: "비좁은 분리 공간 문자 제거",
        contexts: ["selection"]
    });
});

// 타겟 탭에서 실행될 클립보드 복사 함수 (이 함수는 executeScript로 주입됩니다)
// 함수 이름과 본문은 executeScript 호출 시 문자열이 아닌 함수 객체 자체로 전달됩니다.
function copyTextToClipboardInPage(textToCopy) {
    // 임시 textarea 요소를 사용하여 클립보드에 복사 (content_script.js의 원래 로직과 유사)
    const textarea = document.createElement("textarea");
    textarea.value = textToCopy || "";
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);

    try {
        textarea.select();
        // 모바일 환경 등 일부 환경에서 select()가 제대로 작동하지 않을 수 있으므로
        // setSelectionRange를 사용합니다.
        textarea.setSelectionRange(0, textarea.value.length);

        // 클립보드 복사 명령 실행
        const success = document.execCommand("copy");
        if (success) {
            console.log("Injected script: Successfully copied to clipboard.");
            // 사용자에게 복사 성공 알림 등을 페이지에 표시할 수 있습니다.
            // alert("텍스트가 클립보드에 복사되었습니다!"); // 너무 intrusive 할 수 있음
        } else {
            console.error("Injected script: Failed to copy using execCommand.");
            // navigator.clipboard API를 대체로 시도해 볼 수도 있습니다. (requires HTTPS, user gesture)
            // navigator.clipboard.writeText(textToCopy).then(() => {
            //   console.log("Injected script: Successfully copied using navigator.clipboard.");
            // }).catch(err => {
            //   console.error("Injected script: Failed to copy using navigator.clipboard.", err);
            // });
        }
    } catch (err) {
        console.error("Injected script: Error during clipboard copy:", err);
    } finally {
        // 임시 요소 제거
        document.body.removeChild(textarea);
    }
}


// 컨텍스트 메뉴 클릭 이벤트 처리
chrome.contextMenus.onClicked.addListener(async (info, tab) => { // async 키워드 유지
    if (info.menuItemId === "remove_invisible_chars") {
        // 선택된 텍스트 가져오기
        const selectedText = info.selectionText || "";

        // 일반적으로 AI 워터마크에 사용될 수 있는 보이지 않는/폭이 좁은 문자들 제거
        // 포함된 문자: U+200B, U+200C, U+200D, U+202F, U+2060, U+FEFF
        const cleaned = selectedText.replace(/[\u200B\u200C\u200D\u202F\u2060\uFEFF]/g, "\u0020");

        // 1. 먼저 content script로 메시지 전송 시도 (일반적인 방법)
        // content_script.js가 이미 로드되어 있고 준비되었다면 이 방법이 가장 빠릅니다.
        chrome.tabs.sendMessage(tab.id, { action: "copyText", text: cleaned }, (response) => {
            // chrome.runtime.lastError를 체크하여 메시지 전송 실패 여부 확인
            // 만약 lastError가 존재하면 메시지를 받는 쪽(content script)이 없거나 응답하지 않은 것임
            if (chrome.runtime.lastError) {
                console.warn("메시지 전송 실패, content script가 응답하지 않습니다:", chrome.runtime.lastError.message);

                // 2. 메시지 전송 실패 시, chrome.scripting.executeScript로 직접 클립보드 복사 함수 실행 (Fallback)
                console.log("chrome.scripting.executeScript를 사용하여 클립보드 복사를 시도합니다.");
                if (tab.id) { // 유효한 탭 ID가 있는지 확인
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: copyTextToClipboardInPage, // 위에서 정의한 함수 객체 전달
                        args: [cleaned] // 함수에 전달할 인자 배열
                    })
                        .then(() => console.log("executeScript 실행 완료."))
                        .catch(err => console.error("executeScript 실행 중 오류 발생:", err));
                } else {
                    console.error("유효한 탭 ID를 찾을 수 없습니다.");
                }

            } else {
                // 메시지가 content script에 성공적으로 전달됨.
                // content script가 클립보드 복사를 처리할 것입니다.
                console.log("메시지가 content script에 성공적으로 전달되었습니다.");
                // 필요하다면 content script로부터의 응답(response) 처리를 여기에 추가
            }
        });
    }
});

// 참고: content_script.js 파일은 chrome.runtime.onMessage 리스너를 계속 가지고 있어야
// sendMessage가 성공했을 때 해당 스크립트가 클립보드 복사를 수행할 수 있습니다.
// executeScript는 sendMessage 실패 시의 대체 수단입니다.