// =======================
// 기본 상수 / 전역 변수
// =======================
const ADMIN_PHONE = "01099901806";   // 문자 수신 번호
const CALL_PHONE  = "0538178800";    // 매장 전화번호
let db = null;

// [노션 연동 설정]
const NOTION_API_KEY = "ntn_abc123def456ghi789jkl012mno345pqrdl";
// ⚠️ 중요: 본인의 RGDB 데이터베이스 ID 32자리를 아래에 입력해주세요.
const NOTION_DATABASE_ID = "YOUR_NOTION_DATABASE_ID"; 
// 브라우저 CORS 에러 우회를 위한 프록시 서버 URL (테스트용)
const CORS_PROXY = "https://cors-anywhere.herokuapp.com/"; 

// =======================
// 1. 예약 일시 기본값 세팅
// =======================
window.addEventListener('DOMContentLoaded', () => {
    const dtInput = document.getElementById('bookingTime');
    if (dtInput) {
        const now = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16); // "YYYY-MM-DDTHH:MM"
        dtInput.value = now;
        dtInput.setAttribute('min', now);
    }
});

// =======================
// 2. IndexedDB 초기화
// =======================
try {
    const request = indexedDB.open("RG_Golf_DB", 1);

    request.onupgradeneeded = function (event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains("reservations")) {
            db.createObjectStore("reservations", { keyPath: "id", autoIncrement: true });
        }
    };

    request.onsuccess = function (event) {
        db = event.target.result;
        console.log("Database 연결 성공");
    };

    request.onerror = function (event) {
        console.error("Database 에러: ", event.target.errorCode);
    };
} catch (e) {
    console.error("IndexedDB를 지원하지 않거나 환경적 제약이 있습니다.", e);
}

// =======================
// 3. 공통 유틸: 모바일 OS 판별 / SMS URL 생성
// =======================
function getMobileOS() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('android') > -1) return 'android';
    if (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 || ua.indexOf('ipod') > -1) return 'ios';
    return 'other';
}

function getSmsUrl() {
    const name  = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const count = document.getElementById('userCount').value.trim();
    const time  = document.getElementById('bookingTime').value;

    const formattedTime = time ? time.replace('T', ' ') : '';
    const message =
        `[알지골프 예약신청]\n` +
        `성함: ${name}\n` +
        `인원: ${count}명\n` +
        `연락처: ${phone}\n` +
        `시간: ${formattedTime}\n` +
        `예약 확인 부탁드립니다.`;

    const os = getMobileOS();
    if (os === 'other') {
        alert("문자 기능은 모바일 기기에서 사용 가능합니다.\n직접 문자 또는 전화를 이용해 주세요.");
        return null;
    }

    const bodyConnector = (os === 'ios') ? '&' : '?';
    return `sms:${ADMIN_PHONE}${bodyConnector}body=${encodeURIComponent(message)}`;
}

// =======================
// NEW: Notion API 연동 함수
// =======================
async function sendToNotion(reservationData) {
    // 노션 API 엔드포인트에 CORS 프록시 주소를 결합합니다.
    const notionUrl = CORS_PROXY + "https://api.notion.com/v1/pages";

    // 노션 DB 속성(Properties) 형식에 맞게 데이터를 구성합니다.
    // ⚠️ 노션 DB의 컬럼명(성함, 연락처, 인원, 예약시간, 결제상태)이 일치해야 합니다.
    const payload = {
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
            "성함": {
                title: [{ text: { content: reservationData.name } }]
            },
            "연락처": {
                rich_text: [{ text: { content: reservationData.phone } }]
            },
            "인원": {
                rich_text: [{ text: { content: reservationData.count } }]
            },
            "예약시간": {
                rich_text: [{ text: { content: reservationData.time } }]
            },
            "결제상태": {
                select: { name: reservationData.status } // 로컬의 status를 노션의 Select(선택) 속성으로 저장
            }
        }
    };

    try {
        console.log("노션 데이터 전송 시작...");
        const response = await fetch(notionUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${NOTION_API_KEY}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log("Notion DB 연동 성공!");
        } else {
            const errData = await response.json();
            console.error("Notion API 에러 응답:", errData);
        }
    } catch (error) {
        console.error("Notion 전송 중 네트워크 오류 발생:", error);
    }
}

// =======================
// 4. IndexedDB 저장 + Notion 동기화 호출
// =======================
function saveToIndexedDB(status) {
    try {
        const name  = document.getElementById('userName').value.trim();
        const phone = document.getElementById('userPhone').value.trim();
        const count = parseInt(document.getElementById('userCount').value, 10);
        const timeRaw = document.getElementById('bookingTime').value || '';
        const time = timeRaw ? timeRaw.replace('T', ' ') : '';

        const newReservation = {
            name: name,
            phone: phone,
            count: count + "명",
            time: time,
            status: status,
            createdAt: time.split(' ')[0] || ''
        };

        // 1. IndexedDB에 로컬 저장
        if (db) {
            const transaction = db.transaction(["reservations"], "readwrite");
            const store = transaction.objectStore("reservations");
            store.add(newReservation);
            console.log("로컬 IndexedDB 저장 완료");
        } else {
            console.warn("DB가 초기화되지 않아 로컬 저장을 건너뜁니다.");
        }

        // 2. 외부 Notion DB로 데이터 전송 트리거 추가
        sendToNotion(newReservation);

    } catch (error) {
        console.error("데이터 저장 중 오류 발생: ", error);
    }
}

// =======================
// 5. 예약 신청 메인 제어
// =======================
function handleBooking() {
    console.log("handleBooking() 함수 시작됨");

    const name  = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const count = document.getElementById('userCount').value;
    const time  = document.getElementById('bookingTime').value;

    if (!name || !phone || !count || !time) {
        alert("모든 예약 정보를 정확히 입력해주세요.");
        return;
    }
    if (parseInt(count, 10) < 1) {
        alert("최소 1명 이상 입력하셔야 합니다.");
    }

    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'flex';
        console.log("모달 표시 완료");
    } else {
        alert("화면에 모달 레이아웃(id='modal')을 찾을 수 없습니다.");
    }
}

// =======================
// 6. 모달 내부: 문자/전화 단계 UI 구성
// =======================
function sendSms() {
    const modalBody = document.querySelector('.modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <p class="status-msg" style="color:#007bff; font-weight:bold; font-size:16px;">
            1단계: 아래 버튼을 눌러 예약 문자를 보내주세요.<br>
            2단계: 문자 발송 후, 다시 이 화면으로 돌아와 전화 버튼을 눌러주세요.
        </p>
        <div class="button-group">
            <button onclick="triggerActualSms()" class="btn-action copy" style="font-size:18px; padding:12px 0;">
                💬 1단계: 예약 문자 발송
            </button>
            <button onclick="callToCenter()" class="btn-action later" style="font-size:18px; padding:12px 0; margin-top:8px;">
                📞 2단계: 매장으로 전화하기
            </button>
            <button onclick="closeModal()" class="btn-action close" style="margin-top:10px;">창 닫기</button>
        </div>
    `;

    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'flex';
}

function triggerActualSms() {
    const url = getSmsUrl();
    if (url) {
        window.location.href = url;
    }
}

function callToCenter() {
    const telLink = document.getElementById('hiddenTelLink');
    if (telLink) {
        telLink.href = `tel:${CALL_PHONE}`;
        telLink.click();
    } else {
        window.location.href = `tel:${CALL_PHONE}`;
    }
}

// =======================
// 7. 계좌 복사 / 현장결제 버튼 로직
// =======================
function copyAccount() {
    const account = "79422580482"; 

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(account).then(() => {
            alert("카카오뱅크 계좌번호가 복사되었습니다!\n예약 문자와 전화 단계를 진행해 주세요.");
            saveToIndexedDB("입금요청/문자접수");
            sendSms();
        }).catch(() => {
            alert("계좌 복사에 실패했습니다.\n그래도 예약 문자와 전화 단계는 진행할 수 있습니다.");
            saveToIndexedDB("입금요청/문자접수");
            sendSms();
        });
    } else {
        alert("이 브라우저에서는 자동 복사가 지원되지 않습니다.\n직접 계좌번호를 확인해 주세요.");
        saveToIndexedDB("입금요청/문자접수");
        sendSms();
    }
}

function handleLaterPay() {
    if (confirm("현장 결제로 예약 문자를 발송하시겠습니까?\n(문자 발송 후 매장 전화 연결을 진행하실 수 있습니다.)")) {
        saveToIndexedDB("현장결제요청");
        sendSms();
    }
}

// =======================
// 8. 모달 닫기 및 바깥 클릭 처리
// =======================
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
};
