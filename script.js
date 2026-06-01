const ADMIN_PHONE = "01099901806"; 
let db = null;

// 1. IndexedDB 데이터베이스 초기화 (오류 발생 시에도 전체 스크립트가 멈추지 않도록 조치)
try {
    const request = indexedDB.open("RG_Golf_DB", 1);

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains("reservations")) {
            db.createObjectStore("reservations", { keyPath: "id", autoIncrement: true });
        }
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log("Database 연결 성공");
    };

    request.onerror = function(event) {
        console.error("Database 에러: ", event.target.errorCode);
    };
} catch (e) {
    console.error("IndexedDB를 지원하지 않거나 환경적 제약이 있습니다.", e);
}

// 2. 예약 정보 취합 및 문자 URL 생성 함수
function getSmsUrl() {
    const name = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const count = document.getElementById('userCount').value.trim();
    const time = document.getElementById('bookingTime').value;

    const formattedTime = time.replace('T', ' ');
    const message = `[알지골프 예약신청]\n성함: ${name}\n인원: ${count}명\n연락처: ${phone}\n시간: ${formattedTime}\n예약 확인 부탁드립니다.`;
    
    return `sms:${ADMIN_PHONE}?body=${encodeURIComponent(message)}`;
}

// 3. IndexedDB 데이터 저장 로직 (DB가 없어도 에러 없이 넘어가도록 보강)
function saveToIndexedDB(status) {
    try {
        const name = document.getElementById('userName').value.trim();
        const phone = document.getElementById('userPhone').value.trim();
        const count = parseInt(document.getElementById('userCount').value, 10);
        const time = document.getElementById('bookingTime').value.replace('T', ' ');

        const newReservation = {
            name: name,
            phone: phone,
            count: count + "명",
            time: time,
            status: status,
            createdAt: time.split(' ')[0]
        };

        if (db) {
            const transaction = db.transaction(["reservations"], "readwrite");
            const store = transaction.objectStore("reservations");
            store.add(newReservation);
        } else {
            console.warn("DB가 초기화되지 않아 로컬 저장을 건너뜁니다.");
        }
    } catch (error) {
        console.error("데이터 저장 중 오류 발생: ", error);
    }
}

// 4. 예약 신청하기 메인 제어 (버튼 클릭 시 가장 먼저 실행됨)
function handleBooking() {
    // 함수가 정상 호출되는지 확인하는 로그
    console.log("handleBooking() 함수 시작됨");

    const name = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const count = document.getElementById('userCount').value;
    const time = document.getElementById('bookingTime').value;

    // 입력 검증
    if (!name || !phone || !count || !time) {
        alert("모든 예약 정보를 정확히 입력해주세요.");
        return;
    }
    if (parseInt(count, 10) < 1) {
        alert("최소 1명 이상 입력하셔야 합니다.");
        return;
    }

    // 모달 요소를 찾아서 띄우기
    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'flex';
        console.log("모달 표시 완료");
    } else {
        alert("화면에 모달 레이아웃(id='modal')을 찾을 수 없습니다.");
    }
}

// 5. 순차 실행 처리 함수
// 기존 sendSms 함수를 지우고 이 코드로 덮어쓰기 합니다.
function sendSms() {
    // 1. IndexedDB 저장 등은 기존 모달 클릭 시 이미 완료된 상태입니다.
    
    // 2. 모달창 내부를 '문자 발송' 안내로 즉시 전환하여 배경에 깔아둡니다.
    const modalBody = document.querySelector('.modal-body');
    if (modalBody) {
        modalBody.innerHTML = `
            <p class="status-msg" style="color:#007bff; font-weight:bold; font-size:16px;">
                통화 종료 후 아래 버튼을 누르면<br>
                예약 문자 전송 창으로 연결됩니다!
            </p>
            <div class="button-group">
                <button onclick="triggerActualSms()" class="btn-action copy" style="font-size:18px; padding:15px 0;">
                    💬 2단계: 예약 문자 발송하기
                </button>
                <button onclick="closeModal()" class="btn-action close" style="margin-top:10px;">창 닫기</button>
            </div>
        `;
    }

    // 3. 브라우저 제어권을 뺏기지 않는 '전화 걸기'를 즉시 먼저 실행합니다.
    const telLink = document.getElementById('hiddenTelLink');
    if (telLink) {
        telLink.click();
    }
}

// 사용자가 돌아와서 누를 전화 걸기 함수
function triggerActualSms() {
    const url = getSmsUrl();
    window.location.href = url; // 문자 앱으로 이동
    closeModal(); // 모달 닫기
}

// 계좌 복사 시 작동
function copyAccount() {
    const account = "79422580482"; 
    
    navigator.clipboard.writeText(account).then(() => {
        alert("카카오뱅크 계좌번호가 복사되었습니다!\n확인을 누르면 문자 발송 후 매장 전화 연결이 순차적으로 진행됩니다.");
        saveToIndexedDB("입금요청/문자접수");
        sendSms();
        closeModal();
    }).catch(() => {
        saveToIndexedDB("입금요청/문자접수");
        sendSms();
        closeModal();
    });
}

// 나중에 입금(현장 결제) 시 작동
function handleLaterPay() {
    if(confirm("현장 결제로 예약 문자를 발송하시겠습니까?\n(문자 발송 후 매장 전화 연결이 진행됩니다.)")) {
        saveToIndexedDB("현장결제요청");
        sendSms();
        closeModal();
    }
}

// 모달 창 닫기
function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// 모달 바깥 클릭 시 닫기
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target == modal) {
        closeModal();
    }
}
