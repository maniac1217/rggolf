const ADMIN_PHONE = "01035028232";
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

// 4. 예약 신청하기 메인 제어
function handleBooking() {
    const name = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const count = document.getElementById('userCount').value;
    const time = document.getElementById('bookingTime').value;

    if (!name || !phone || !count || !time) {
        alert("모든 예약 정보를 정확히 입력해주세요.");
        return;
    }
    if (parseInt(count, 10) < 1) {
        alert("최소 1명 이상 입력하셔야 합니다.");
        return;
    }

    document.getElementById('modal').style.display = 'flex';
}

function sendSms() {
    const url = getSmsUrl();
    window.location.href = url;
}

// 계좌 복사 시 작동
function copyAccount() {
    const account = "79422580482"; 
    
    navigator.clipboard.writeText(account).then(() => {
        alert("카카오뱅크 계좌번호가 복사되었습니다! 확인을 누르면 문자 발송 화면으로 이동합니다.");
        saveToIndexedDB("입금요청/문자접수");
        sendSms();
    }).catch(() => {
        saveToIndexedDB("입금요청/문자접수");
        sendSms();
    });
}

// 나중에 입금(현장 결제) 시 작동
function handleLaterPay() {
    if(confirm("현장 결제로 예약 문자를 발송하시겠습니까?")) {
        saveToIndexedDB("현장결제요청");
        sendSms();
        closeModal();
    }
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target == modal) {
        closeModal();
    }
}