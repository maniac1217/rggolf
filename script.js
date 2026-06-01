const ADMIN_PHONE = "01099901806"; // 문자 수신 및 전화 연결 대상 관리자 번호
let db;

// 1. IndexedDB 데이터베이스 초기화 및 생성
const request = indexedDB.open("RG_Golf_DB", 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains("reservations")) {
        db.createObjectStore("reservations", { keyPath: "id", autoIncrement: true });
    }
};

request.onsuccess = function(event) {
    db = event.target.result;
};

request.onerror = function(event) {
    console.error("Database 에러: " + event.target.errorCode);
};

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

// 3. IndexedDB 데이터 저장 로직
function saveToIndexedDB(status) {
    const name = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const count = parseInt(document.getElementById('userCount').value, 10);
    const time = document.getElementById('bookingTime').value.replace('T', ' ');

    const newReservation = {
        name: name,
        phone: phone,
        count: count + "명", // '명' 단위를 붙여서 저장
        time: time,
        status: status,
        createdAt: time.split(' ')[0] // 예약 실행 날짜 기준 필터링을 위해 추출
    };

    const transaction = db.transaction(["reservations"], "readwrite");
    const store = transaction.objectStore("reservations");
    store.add(newReservation);
}

// 4. 예약 신청하기 메인 제어 (HTML 버튼과 연결됨)
function handleBooking() {
    const name = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const count = document.getElementById('userCount').value;
    const time = document.getElementById('bookingTime').value;

    // 입력 유효성 검사
    if (!name || !phone || !count || !time) {
        alert("모든 예약 정보를 정확히 입력해주세요.");
        return;
    }
    if (parseInt(count, 10) < 1) {
        alert("최소 1명 이상 입력하셔야 합니다.");
        return;
    }

    // 검사 통과 시 모달창 열기
    document.getElementById('modal').style.display = 'flex';
}

// 5. 문자 전송 후 브라우저 복귀 시 전화 연결을 순차 실행하는 핵심 기능
function sendSms() {
    const url = getSmsUrl();
    
    // 1) 문자 앱을 먼저 실행시킵니다.
    window.location.href = url;
    
    // 2) 사용자가 문자 발송(또는 취소) 후 웹 화면으로 돌아오는(focus) 순간을 감지합니다.
    window.addEventListener('focus', function triggerTel() {
        // HTML 내 숨겨진 전화 링크를 클릭하여 전화를 연결합니다.
        document.getElementById('hiddenTelLink').click();
        
        // 중복 실행을 막기 위해 이벤트 리스너를 즉시 제거합니다.
        window.removeEventListener('focus', triggerTel);
    }, { once: true });
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
        // 클립보드 복사 실패 시에도 로직은 정상 유지
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

// 모달 바깥 영역 클릭 시 닫기
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target == modal) {
        closeModal();
    }
}
