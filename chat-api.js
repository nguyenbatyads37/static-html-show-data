/**
 * Chat API - Quản lý tương tác với trợ lý AI
 * Tích hợp với AuthService để đảm bảo chỉ người dùng đã xác thực mới có thể chat
 */

const ChatAPI = (function() {
    // Cấu hình
    const CONFIG = {
        // Khóa lưu trữ cấu hình API trong localStorage
        API_CONFIG_KEY: 'ai_assistant_api_config',
        
        // URL API mặc định
        DEFAULT_API_URL: 'https://api.example.com/v1/chat',
        
        // Thông tin về trợ lý đang chat
        CURRENT_ASSISTANT_KEY: 'ai_current_assistant'
    };

    // Biến lưu trữ
    let apiUrl = null;
    let currentAssistant = null;

    /**
     * Khởi tạo Chat API
     */
    function initialize() {
        // Khôi phục cấu hình API nếu có
        restoreApiConfig();
        
        // Thiết lập sự kiện
        setupEventListeners();
        
        console.log('Chat API initialized with URL:', apiUrl || CONFIG.DEFAULT_API_URL);
    }

    /**
     * Khôi phục cấu hình API từ localStorage
     */
    function restoreApiConfig() {
        try {
            const savedConfig = localStorage.getItem(CONFIG.API_CONFIG_KEY);
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                apiUrl = config.url;
            }
        } catch (error) {
            console.error('Error restoring API config:', error);
        }
    }

    /**
     * Thiết lập các sự kiện
     */
    function setupEventListeners() {
        // Sự kiện khi nhấp vào nút chat của trợ lý
        document.addEventListener('click', function(e) {
            const chatBtn = e.target.closest('.assistant-btn');
            if (chatBtn) {
                // Nếu là nút "Mua ngay", xử lý khác
                if (chatBtn.classList.contains('purchase-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePurchaseClick(chatBtn);
                    return;
                }
                
                const card = chatBtn.closest('.assistant-card');
                if (card) {
                    handleAssistantCardClick(card);
                }
            }
        });
        
        // Sự kiện gửi tin nhắn trong chat
        const chatSendBtn = document.getElementById('chatSendBtn');
        if (chatSendBtn) {
            chatSendBtn.addEventListener('click', sendMessage);
        }
        
        // Sự kiện nhấn Enter để gửi tin nhắn
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }
        
        // Sự kiện đóng cửa sổ chat
        const chatCloseBtn = document.getElementById('chatCloseBtn');
        if (chatCloseBtn) {
            chatCloseBtn.addEventListener('click', closeChat);
        }
    }

    /**
     * Xử lý khi người dùng nhấp vào nút "Mua ngay"
     */
    function handlePurchaseClick(button) {
        const card = button.closest('.assistant-card');
        if (!card) return;
        
        const assistantId = card.dataset.id;
        const assistantName = card.dataset.name;
        
        // Kiểm tra xem người dùng đã đăng nhập chưa
        if (typeof AuthService !== 'undefined' && !AuthService.isLoggedIn()) {
            if (typeof AuthService.login === 'function') {
                AuthService.login();
            }
            return;
        }
        
        // Hiển thị thông báo mua hàng (chỉ là mô phỏng)
        alert(`Để mua trợ lý AI "${assistantName}", vui lòng liên hệ quản trị viên hoặc truy cập trang web chính thức của Học Viện AI DHM.`);
    }

    /**
     * Xử lý sự kiện khi người dùng nhấp vào thẻ trợ lý AI
     */
    function handleAssistantCardClick(card) {
        // Kiểm tra xác thực người dùng trước khi cho phép chat
        if (typeof AuthService === 'undefined' || !AuthService.isLoggedIn()) {
            // Hiển thị form đăng nhập nếu chưa đăng nhập
            if (typeof AuthService !== 'undefined' && typeof AuthService.login === 'function') {
                AuthService.login();
            } else {
                alert('Vui lòng đăng nhập để sử dụng trợ lý AI.');
            }
            return;
        }
        
        // Lấy thông tin trợ lý từ card
        const assistantId = card.dataset.id;
        const assistantName = card.dataset.name;
        const assistantImage = card.dataset.image;
        const assistantCode = card.dataset.code;
        
        if (!assistantId || !assistantName) {
            console.error('Missing assistant information');
            return;
        }
        
        // Kiểm tra quyền truy cập
        if (typeof AuthService !== 'undefined' && 
            typeof AuthService.canAccessAssistant === 'function' && 
            !AuthService.canAccessAssistant(assistantId)) {
            alert(`Bạn chưa mua trợ lý AI "${assistantName}". Vui lòng mua để sử dụng.`);
            return;
        }
        
        // Lưu thông tin trợ lý hiện tại
        currentAssistant = {
            id: assistantId,
            name: assistantName,
            image: assistantImage || 'https://via.placeholder.com/100',
            code: assistantCode || ''
        };
        
        try {
            localStorage.setItem(CONFIG.CURRENT_ASSISTANT_KEY, JSON.stringify(currentAssistant));
        } catch (error) {
            console.error('Error saving current assistant:', error);
        }
        
        // Cập nhật UI chat modal với thông tin trợ lý
        updateChatUI();
        
        // Hiển thị chat modal
        openChat();
    }

    /**
     * Mở cửa sổ chat
     */
    function openChat() {
        const chatModal = document.getElementById('chatModal');
        if (chatModal) {
            chatModal.classList.add('active');
            
            // Focus vào ô nhập tin nhắn
            setTimeout(() => {
                const chatInput = document.getElementById('chatInput');
                if (chatInput) {
                    chatInput.focus();
                }
            }, 300);
        }
    }

    /**
     * Đóng cửa sổ chat
     */
    function closeChat() {
        const chatModal = document.getElementById('chatModal');
        if (chatModal) {
            chatModal.classList.remove('active');
        }
    }

    /**
     * Cập nhật giao diện cửa sổ chat với thông tin trợ lý hiện tại
     */
    function updateChatUI() {
        if (!currentAssistant) return;
        
        // Cập nhật tên và ảnh trợ lý
        const modalAssistantName = document.getElementById('modalAssistantName');
        const modalAssistantAvatar = document.getElementById('modalAssistantAvatar');
        
        if (modalAssistantName) {
            modalAssistantName.textContent = currentAssistant.name;
        }
        
        if (modalAssistantAvatar) {
            modalAssistantAvatar.src = currentAssistant.image;
        }
        
        // Xóa các tin nhắn cũ và hiển thị tin nhắn chào mừng
        const chatBody = document.getElementById('chatBody');
        if (chatBody) {
            chatBody.innerHTML = '';
            
            // Thêm tin nhắn chào mừng
            const welcomeMsg = document.createElement('div');
            welcomeMsg.className = 'chat-message assistant-message';
            welcomeMsg.innerHTML = `
                <div class="message-bubble">
                    Xin chào! Tôi là ${currentAssistant.name} ${currentAssistant.code ? `(${currentAssistant.code})` : ''}.
                    Tôi có thể giúp gì cho bạn hôm nay?
                </div>
                <div class="message-time">Bây giờ</div>
            `;
            
            chatBody.appendChild(welcomeMsg);
        }
        
        // Xóa nội dung ô nhập tin nhắn
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value = '';
        }
    }

    /**
     * Hiển thị trạng thái đang gõ
     */
    function showTypingIndicator() {
        const chatBody = document.getElementById('chatBody');
        if (!chatBody) return;
        
        // Tạo indicator
        const typingMsg = document.createElement('div');
        typingMsg.className = 'chat-message assistant-message typing-indicator';
        typingMsg.id = 'typingIndicator';
        typingMsg.innerHTML = `
            <div class="message-bubble">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            </div>
        `;
        
        chatBody.appendChild(typingMsg);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    /**
     * Ẩn trạng thái đang gõ
     */
    function hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * Thêm tin nhắn vào cửa sổ chat
     */
    function addMessage(message, isUser = false) {
        const chatBody = document.getElementById('chatBody');
        if (!chatBody) return;
        
        // Tạo tin nhắn
        const msgElement = document.createElement('div');
        msgElement.className = `chat-message ${isUser ? 'user-message' : 'assistant-message'}`;
        
        // Format thời gian
        const now = new Date();
        const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                           now.getMinutes().toString().padStart(2, '0');
        
        msgElement.innerHTML = `
            <div class="message-bubble">${message}</div>
            <div class="message-time">${timeString}</div>
        `;
        
        chatBody.appendChild(msgElement);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    /**
     * Thêm tin nhắn lỗi
     */
    function addErrorMessage(message) {
        const chatBody = document.getElementById('chatBody');
        if (!chatBody) return;
        
        // Tạo tin nhắn
        const msgElement = document.createElement('div');
        msgElement.className = 'chat-message error';
        
        msgElement.innerHTML = `
            <div class="message-bubble">${message}</div>
            <div class="message-time">Lỗi</div>
        `;
        
        chatBody.appendChild(msgElement);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    /**
     * Gửi tin nhắn đến trợ lý AI
     */
    function sendMessage() {
        // Kiểm tra xác thực
        if (typeof AuthService !== 'undefined' && !AuthService.isLoggedIn()) {
            closeChat();
            if (typeof AuthService.login === 'function') {
                AuthService.login();
            }
            return;
        }
        
        // Kiểm tra quyền truy cập vào trợ lý hiện tại
        if (currentAssistant && typeof AuthService !== 'undefined' && 
            typeof AuthService.canAccessAssistant === 'function' && 
            !AuthService.canAccessAssistant(currentAssistant.id)) {
            closeChat();
            alert(`Bạn chưa mua trợ lý AI "${currentAssistant.name}". Vui lòng mua để sử dụng.`);
            return;
        }
        
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;
        
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Hiển thị tin nhắn của người dùng
        addMessage(message, true);
        
        // Xóa nội dung ô nhập
        chatInput.value = '';
        
        // Hiển thị trạng thái đang gõ
        showTypingIndicator();
        
        // Mô phỏng trợ lý đang xử lý và trả lời
        setTimeout(() => {
            processAIResponse(message);
        }, 1500);
    }

    /**
     * Xử lý phản hồi từ trợ lý AI (mô phỏng)
     */
    function processAIResponse(userMessage) {
        if (!currentAssistant) {
            hideTypingIndicator();
            addErrorMessage('Không thể kết nối với trợ lý AI. Vui lòng thử lại sau.');
            return;
        }
        
        // Trong thực tế, đây sẽ là một cuộc gọi API đến máy chủ AI
        // Hiện tại, chúng ta sử dụng phản hồi mẫu dựa trên trợ lý được chọn
        
        hideTypingIndicator();
        
        let response;
        const assistantName = currentAssistant.name;
        
        // Mô phỏng phản hồi dựa trên loại trợ lý
        if (userMessage.toLowerCase().includes('giới thiệu') || userMessage.toLowerCase().includes('bạn là ai')) {
            response = `Tôi là ${assistantName}, một trợ lý AI được thiết kế để hỗ trợ bạn. Tôi có thể giúp bạn với nhiều nhiệm vụ khác nhau tùy thuộc vào chuyên môn của tôi.`;
        } else if (userMessage.toLowerCase().includes('giúp') || userMessage.toLowerCase().includes('hỗ trợ')) {
            response = `Tôi có thể giúp bạn với nhiều vấn đề khác nhau. Hãy cho tôi biết cụ thể bạn cần hỗ trợ gì nhé!`;
        } else if (userMessage.toLowerCase().includes('cảm ơn')) {
            response = `Không có gì! Tôi luôn sẵn sàng hỗ trợ bạn.`;
        } else {
            // Phản hồi ngẫu nhiên
            const responses = [
                `Đây là một câu hỏi thú vị. Để trả lời chính xác, tôi cần thêm thông tin từ bạn.`,
                `Tôi đang phân tích yêu cầu của bạn. Bạn có thể cung cấp thêm chi tiết không?`,
                `Tôi hiểu yêu cầu của bạn và đang xử lý. Vui lòng đợi một chút.`,
                `Cảm ơn bạn đã chia sẻ. Tôi sẽ cố gắng hỗ trợ bạn tốt nhất có thể.`,
                `Đây là một chủ đề thú vị! Tôi rất vui được hỗ trợ bạn về vấn đề này.`
            ];
            const randomIndex = Math.floor(Math.random() * responses.length);
            response = responses[randomIndex];
        }
        
        // Hiển thị phản hồi
        addMessage(response, false);
    }

    /**
     * Thiết lập URL API
     */
    function configureApiUrl() {
        const url = prompt('Nhập URL API trợ lý AI:', apiUrl || CONFIG.DEFAULT_API_URL);
        if (url !== null) {
            apiUrl = url.trim();
            try {
                localStorage.setItem(CONFIG.API_CONFIG_KEY, JSON.stringify({ url: apiUrl }));
                alert('Cấu hình API đã được lưu.');
            } catch (error) {
                console.error('Error saving API config:', error);
                alert('Không thể lưu cấu hình API.');
            }
        }
    }

    /**
     * Xóa cấu hình API
     */
    function clearApiUrl() {
        if (confirm('Bạn có chắc muốn xóa cấu hình API hiện tại không?')) {
            apiUrl = null;
            try {
                localStorage.removeItem(CONFIG.API_CONFIG_KEY);
                alert('Cấu hình API đã được xóa.');
            } catch (error) {
                console.error('Error clearing API config:', error);
            }
        }
    }
    
    /**
     * Khởi tạo ChatAPI khi trang đã tải xong
     */
    document.addEventListener('DOMContentLoaded', initialize);

    // API công khai
    return {
        configureApiUrl,
        clearApiUrl,
        openChat,
        closeChat
    };
})(); 