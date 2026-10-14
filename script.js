const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxbvm2m3U9F1gmSee8gg-BMuApUDta1pLUoVQt9V6h0MipamOkPh71gqMQWCPGjqzF7bA/exec";

const ADMIN_PHONE = "01099901806";   
const CALL_PHONE  = "0538178800";    

window.addEventListener('DOMContentLoaded', () => {
    const dtInput = document.getElementById('bookingTime');
    if (dtInput) {
        const now = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16); 
        dtInput.value = now;
        dtInput.setAttribute('min', now);
    }
});

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

async function saveToGoogleSheet(status) {
    try {
        const name  = document.getElementById('userName').value.trim();
        const phone = document.getElementById('userPhone').value.trim();
        const count = document.getElementById('userCount').value + "명";
        const timeRaw = document.getElementById('bookingTime').value || '';
        const time = timeRaw ? timeRaw.replace('T', ' ') : '';

        const payload = {
            name: name,
            phone: phone,
            count: count,
            time: time,
            status: status,
            createdAt: new Date().toISOString()
        };

        if (GOOGLE_SHEET_URL.includes("YOUR_GOOGLE_APPS_SCRIPT")) {
            console.warn("구글시트 웹 앱 URL이 설정되지 않았습니다.");
            return;
        }

        await fetch(GOOGLE_SHEET_URL, {
            method: "POST",
            mode: "no-cors", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        console.log("✅ 구글시트 전송 완료");

    } catch (error) {
        console.error("구글시트 전송 에러: ", error);
    }
}

window.handleBooking = function() {
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
        return;
    }

    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'flex';
};

window.sendSms = function() {
    const modalBody = document.querySelector('.modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <p class="status-msg" style="color:#007bff; font-weight:bold; font-size:16px;">
            1단계: 아래 버튼을 눌러 예약 문자를 보내주세요.<br>
            2단계: 문자 발송 후, 다시 이 화면으로 돌아와 전화 버튼을 눌러주세요.
        </p>
        <div class="button-group">
            <button onclick="triggerActualSms()" class="btn-action copy" style="font-size:18px; padding:12px 0; width:100%;">
                💬 1단계: 예약 문자 발송
            </button>
            <button onclick="callToCenter()" class="btn-action later" style="font-size:18px; padding:12px 0; margin-top:8px; width:100%;">
                📞 2단계: 매장으로 전화하기
            </button>
            <button onclick="closeModal()" class="btn-action close" style="margin-top:10px; width:100%;">창 닫기</button>
        </div>
    `;

    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'flex';
};

window.triggerActualSms = function() {
    const url = getSmsUrl();
    if (url) window.location.href = url;
};

window.callToCenter = function() {
    const telLink = document.getElementById('hiddenTelLink');
    if (telLink) {
        telLink.href = `tel:${CALL_PHONE}`;
        telLink.click();
    } else {
        window.location.href = `tel:${CALL_PHONE}`;
    }
};

window.copyAccount = function() {
    const account = "79422580482"; 

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(account).then(() => {
            alert("카카오뱅크 계좌번호가 복사되었습니다!\n예약 문자와 전화 단계를 진행해 주세요.");
            saveToGoogleSheet("입금요청/문자접수");
            window.sendSms();
        }).catch(() => {
            saveToGoogleSheet("입금요청/문자접수");
            window.sendSms();
        });
    } else {
        saveToGoogleSheet("입금요청/문자접수");
        window.sendSms();
    }
};

window.handleLaterPay = function() {
    if (confirm("현장 결제로 예약 문자를 발송하시겠습니까?")) {
        saveToGoogleSheet("현장결제요청");
        window.sendSms();
    }
};

window.closeModal = function() {
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
};

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) window.closeModal();
};
