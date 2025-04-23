/**
 * Auth Service - Hệ thống quản lý xác thực người dùng
 * Sử dụng Google Sheets API để kiểm tra quyền truy cập
 */

const AuthService = (function() {
    // Cấu hình
    const CONFIG = {
        // ID của Google Sheet và tên sheet
        SHEET_ID: '1qDfLjU8f_5qLJAKZnnrc6CQgGUr6IRmCIOC_a3JTA-A',
        SHEET_NAME: 'mail',
        
        // Khóa lưu trữ thông tin người dùng trong localStorage
        STORAGE_KEY: 'ai_assistant_user'
    };

    // Biến lưu trữ dữ liệu người dùng trong phiên làm việc
    let currentUser = null;
    let isInitialized = false;
    let purchasedAssistants = [];
    let allAssistantsData = [];

    /**
     * Khởi tạo dịch vụ xác thực
     * - Kiểm tra người dùng đã đăng nhập
     * - Cài đặt các sự kiện
     */
    async function initialize() {
        if (isInitialized) return;
        
        // Khôi phục phiên đăng nhập nếu có
        restoreSession();
        
        // Tải dữ liệu trợ lý
        loadAssistantsData();
        
        // Thiết lập các sự kiện
        setupEventListeners();
        
        // Cập nhật UI dựa trên trạng thái đăng nhập
        updateUI();
        
        // Nếu đã đăng nhập, tải danh sách trợ lý AI đã mua
        if (isLoggedIn()) {
            await loadPurchasedAssistants();
        }
        
        isInitialized = true;
        console.log('Auth Service initialized');
    }

    /**
     * Tải dữ liệu của tất cả trợ lý AI từ danh sách
     */
    function loadAssistantsData() {
        try {
            // Lấy danh sách trợ lý từ biến toàn cục hoặc tạo mảng rỗng
            allAssistantsData = window.assistants || [];
            console.log('Loaded assistants data:', allAssistantsData.length > 0 ? 'Success' : 'Empty or not found');
        } catch (error) {
            console.error('Error loading assistants data:', error);
            allAssistantsData = [];
        }
    }

    /**
     * Khôi phục phiên đăng nhập từ localStorage
     */
    function restoreSession() {
        try {
            const savedUser = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (savedUser) {
                currentUser = JSON.parse(savedUser);
                console.log('Session restored for:', currentUser.email);
            }
        } catch (error) {
            console.error('Error restoring session:', error);
            localStorage.removeItem(CONFIG.STORAGE_KEY);
        }
    }

    /**
     * Thiết lập các sự kiện liên quan đến đăng nhập/đăng xuất
     */
    function setupEventListeners() {
        // Nút mở form đăng nhập
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', showLoginModal);
        }

        // Đóng form đăng nhập
        const loginCloseBtn = document.getElementById('loginCloseBtn');
        if (loginCloseBtn) {
            loginCloseBtn.addEventListener('click', hideLoginModal);
        }

        // Xử lý form đăng nhập
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        // Nút đăng xuất
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // Nút chat cần kiểm tra đăng nhập và quyền truy cập
        document.addEventListener('click', function(e) {
            if (e.target.closest('.assistant-btn')) {
                if (!isLoggedIn()) {
                    e.preventDefault();
                    e.stopPropagation();
                    showLoginModal();
                    showLoginMessage('Vui lòng đăng nhập để sử dụng trợ lý AI');
                    return false;
                }
                
                // Kiểm tra quyền truy cập vào trợ lý
                const card = e.target.closest('.assistant-card');
                if (card) {
                    const assistantId = card.dataset.id;
                    if (!canAccessAssistant(assistantId)) {
                        e.preventDefault();
                        e.stopPropagation();
                        alert(`Bạn chưa mua trợ lý AI này. Vui lòng mua để sử dụng.`);
                        return false;
                    }
                }
            }
        }, true);

        // Đóng modal khi click bên ngoài
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.addEventListener('click', function(e) {
                if (e.target === loginModal) {
                    hideLoginModal();
                }
            });
        }

        // Sự kiện cho các trợ lý đã mua trong sidebar
        document.addEventListener('click', function(e) {
            const sidebarAssistant = e.target.closest('.sidebar-purchased-assistant');
            if (sidebarAssistant && !e.target.closest('.assistant-url-link')) {
                const assistantId = sidebarAssistant.dataset.id;
                if (assistantId) {
                    // Thay đổi: Hiển thị modal danh sách trợ lý thay vì mở chat
                    const myAssistantsModal = document.getElementById('myAssistantsModal');
                    if (myAssistantsModal) {
                        // Trigger click vào nút "Trợ lý của tôi" để hiển thị modal
                        const myAssistantsBtn = document.getElementById('myAssistantsBtn');
                        if (myAssistantsBtn) {
                            myAssistantsBtn.click();
                        } else {
                            myAssistantsModal.classList.add('active');
                        }
                    }
                }
            }
        });
    }

    /**
     * Mở cửa sổ chat với trợ lý AI đã chọn
     */
    function openChatWithAssistant(assistantId) {
        // Tìm thông tin trợ lý từ ID
        const assistantData = allAssistantsData.find(a => a.id === parseInt(assistantId, 10));
        if (!assistantData) return;

        // Mô phỏng việc click vào nút chat của thẻ trợ lý tương ứng
        const chatModal = document.getElementById('chatModal');
        const modalAssistantName = document.getElementById('modalAssistantName');
        const modalAssistantAvatar = document.getElementById('modalAssistantAvatar');
        
        if (chatModal && modalAssistantName && modalAssistantAvatar) {
            modalAssistantName.textContent = assistantData.name;
            modalAssistantAvatar.src = assistantData.image;
            chatModal.classList.add('active');
            
            // Focus vào ô input chat
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.focus();
            }
        }
    }

    /**
     * Tải danh sách trợ lý AI đã mua cho người dùng hiện tại
     */
    async function loadPurchasedAssistants() {
        if (!isLoggedIn()) {
            purchasedAssistants = [];
            return;
        }
        
        try {
            // Sử dụng Google Sheets Proxy để lấy danh sách trợ lý đã mua
            purchasedAssistants = await GoogleSheetsProxy.getPurchasedAssistants(currentUser.email);
            
            console.log('Loaded purchased assistants:', purchasedAssistants);
            
            // Lưu danh sách vào thông tin người dùng
            currentUser.purchasedAssistants = purchasedAssistants;
            try {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(currentUser));
            } catch (error) {
                console.error('Error saving user data to localStorage:', error);
            }
            
            // Cập nhật UI để hiển thị trợ lý đã mua
            updateAssistantCardsUI();
            updatePurchasedAssistantsSidebarUI();
        } catch (error) {
            console.error('Error loading purchased assistants:', error);
        }
    }
    
    /**
     * Lấy URL của trợ lý dựa trên code
     */
    function getAssistantUrl(assistantCode) {
        return assistantCode.toLowerCase() === 'marketing' ? 
            'https://chatgpt.com/g/g-67ff1e78cd4c81919b4d2415b87a97d4-ai-marketing-master-dinh-cao' : 
            'https://chatgpt.com/g/g-67bd58162bd081918a19da303fede9b5-ai-pham-van-dung-kim-cuong';
    }

    /**
     * Cập nhật hiển thị thẻ trợ lý AI dựa trên quyền truy cập
     * Thẻ nào chưa mua sẽ bị làm mờ và hiển thị nút "Mua ngay" thay vì "Chat"
     */
    function updateAssistantCardsUI() {
        // Lấy tất cả thẻ trợ lý AI
        const assistantCards = document.querySelectorAll('.assistant-card');
        
        // Theo dõi các mã đã hiển thị để tránh trùng lặp link
        const displayedCodes = new Set();
        
        assistantCards.forEach(card => {
            const assistantId = parseInt(card.dataset.id, 10);
            const canAccess = purchasedAssistants.includes(assistantId);
            
            // Cập nhật UI của thẻ
            if (canAccess) {
                // Đã mua - hiển thị bình thường
                card.classList.remove('not-purchased');
                card.style.opacity = '1';
                
                // Cập nhật nút - thay đổi thành "Đã mua" thay vì "Bắt đầu chat"
                const chatBtn = card.querySelector('.assistant-btn');
                if (chatBtn) {
                    chatBtn.innerHTML = `
                        <div class="chat-icon-wrapper">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        Đã mua
                    `;
                    chatBtn.classList.remove('purchase-btn');
                    chatBtn.classList.add('purchased-btn');
                    // Vô hiệu hóa nút hoặc sử dụng làm liên kết đến URL thay vì chat
                    chatBtn.setAttribute('disabled', 'disabled');
                    chatBtn.style.cursor = 'default';
                    
                    // Thêm URL nếu cần thiết
                    const assistantInfo = allAssistantsData.find(a => a.id === assistantId);
                    if (assistantInfo) {
                        // Kiểm tra xem mã này đã được hiển thị chưa
                        const showLink = !displayedCodes.has(assistantInfo.code.toLowerCase());
                        if (showLink) {
                            // Thêm mã vào danh sách đã hiển thị
                            displayedCodes.add(assistantInfo.code.toLowerCase());
                            
                            const assistantUrl = getAssistantUrl(assistantInfo.code);
                            const urlLink = document.createElement('a');
                            urlLink.href = assistantUrl;
                            urlLink.className = 'assistant-url-link-card';
                            urlLink.title = 'Truy cập URL của trợ lý';
                            urlLink.target = '_blank';
                            urlLink.innerHTML = '<i class="fas fa-external-link-alt"></i>';
                            
                            // Thêm vào bên cạnh nút
                            const cardFooter = chatBtn.parentElement;
                            if (cardFooter) {
                                cardFooter.appendChild(urlLink);
                            }
                        }
                    }
                }
            } else {
                // Chưa mua - làm mờ và thay đổi nút
                card.classList.add('not-purchased');
                card.style.opacity = '0.7';
                
                // Cập nhật nút
                const chatBtn = card.querySelector('.assistant-btn');
                if (chatBtn) {
                    chatBtn.innerHTML = `
                        <div class="chat-icon-wrapper">
                            <i class="fas fa-shopping-cart"></i>
                        </div>
                        Mua ngay
                    `;
                    chatBtn.classList.add('purchase-btn');
                    chatBtn.classList.remove('purchased-btn');
                }
            }
        });
    }

    /**
     * Cập nhật UI hiển thị trợ lý đã mua trong sidebar
     */
    function updatePurchasedAssistantsSidebarUI() {
        const sidebarList = document.getElementById('purchasedAssistantsSidebar');
        const emptyMessage = document.getElementById('emptyPurchasedMessage');
        
        if (!sidebarList) return;
        
        // Xóa các mục hiện tại (trừ thông báo trống)
        const existingItems = sidebarList.querySelectorAll('.sidebar-purchased-assistant');
        existingItems.forEach(item => item.remove());
        
        // Kiểm tra có trợ lý nào đã mua không
        if (!purchasedAssistants || purchasedAssistants.length === 0) {
            // Hiển thị thông báo trống
            if (emptyMessage) {
                emptyMessage.style.display = 'block';
            }
            return;
        }
        
        // Ẩn thông báo trống
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
        }
        
        // Theo dõi các mã đã hiển thị để tránh trùng lặp
        const displayedCodes = new Set();
        
        // Thêm từng trợ lý đã mua vào danh sách
        purchasedAssistants.forEach(assistantId => {
            // Tìm thông tin của trợ lý dựa vào ID
            const assistantInfo = allAssistantsData.find(a => a.id === assistantId);
            if (!assistantInfo) return;
            
            // Tạo URL giả định dựa trên thông tin trợ lý
            const assistantUrl = getAssistantUrl(assistantInfo.code);
            
            // Tạo phần tử danh sách mới
            const listItem = document.createElement('li');
            listItem.className = 'sidebar-purchased-assistant';
            listItem.dataset.id = assistantId;
            
            // Kiểm tra xem mã này đã được hiển thị chưa
            const showLink = !displayedCodes.has(assistantInfo.code.toLowerCase());
            if (showLink) {
                // Thêm mã vào danh sách đã hiển thị
                displayedCodes.add(assistantInfo.code.toLowerCase());
            }
            
            // Định dạng HTML cho mục trợ lý trong sidebar
            listItem.innerHTML = `
                <div class="purchased-assistant-link-wrapper">
                    <a href="javascript:void(0)" class="nav-link purchased-assistant-link">
                        <div class="purchased-assistant-avatar">
                            <img src="${assistantInfo.image}" alt="${assistantInfo.name}">
                        </div>
                        <span class="assistant-name-text">${assistantInfo.name}</span>
                    </a>
                    ${showLink ? `<a href="${assistantUrl}" class="assistant-url-link" title="Truy cập URL của trợ lý" target="_blank">
                        <i class="fas fa-external-link-alt"></i>
                    </a>` : ''}
                </div>
            `;
            
            // Thêm vào sidebar
            sidebarList.appendChild(listItem);
        });
    }

    /**
     * Hiển thị modal đăng nhập
     */
    function showLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.classList.add('active');
            const emailInput = document.getElementById('userEmail');
            if (emailInput) {
                emailInput.focus();
            }
        }
    }

    /**
     * Ẩn modal đăng nhập
     */
    function hideLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.classList.remove('active');
            // Xóa thông báo lỗi nếu có
            const msgEl = document.getElementById('loginMessage');
            if (msgEl) {
                msgEl.style.display = 'none';
                msgEl.textContent = '';
            }
        }
    }

    /**
     * Hiển thị thông báo trên form đăng nhập
     */
    function showLoginMessage(message, isError = true) {
        const msgEl = document.getElementById('loginMessage');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.style.color = isError ? '#ff6b6b' : '#4cc9f0';
            msgEl.style.display = 'block';
        }
    }

    /**
     * Xử lý sự kiện đăng nhập
     */
    async function handleLogin(e) {
        e.preventDefault();
        
        const emailInput = document.getElementById('userEmail');
        if (!emailInput) return;
        
        const email = emailInput.value.trim();
        if (!email) {
            showLoginMessage('Vui lòng nhập email');
            return;
        }
        
        // Hiển thị thông báo đang xử lý
        showLoginMessage('Đang xác thực...', false);
        
        try {
            // Sử dụng Google Sheets Proxy để kiểm tra quyền truy cập
            const isAuthorized = await GoogleSheetsProxy.isEmailAuthorized(email);
            
            if (isAuthorized) {
                // Lưu thông tin người dùng
                currentUser = {
                    email: email,
                    loginTime: new Date().toISOString(),
                    isAuthenticated: true
                };
                
                try {
                    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(currentUser));
                } catch (error) {
                    console.error('Error saving user to localStorage:', error);
                }
                
                // Tải danh sách trợ lý AI đã mua
                await loadPurchasedAssistants();
                
                // Cập nhật UI
                updateUI();
                
                // Đóng modal
                hideLoginModal();
                
                // Hiển thị thông báo chào mừng
                showWelcomeMessage();
                
                // Xử lý khi đăng nhập thành công
                loginSuccess();
            } else {
                showLoginMessage('Email không có quyền truy cập. Vui lòng liên hệ quản trị viên.');
            }
        } catch (error) {
            console.error('Error during login:', error);
            showLoginMessage('Có lỗi xảy ra. Vui lòng thử lại sau.');
        }
    }

    /**
     * Xử lý sự kiện đăng xuất
     */
    function handleLogout() {
        // Xóa thông tin người dùng
        currentUser = null;
        purchasedAssistants = [];
        
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
        } catch (error) {
            console.error('Error removing user from localStorage:', error);
        }
        
        // Cập nhật UI
        updateUI();
        
        // Cập nhật hiển thị thẻ trợ lý
        updateAssistantCardsUI();
        updatePurchasedAssistantsSidebarUI();
        
        // Hiển thị thông báo
        alert('Bạn đã đăng xuất thành công!');
        
        // Xử lý khi đăng xuất
        logoutSuccess();
    }

    /**
     * Hiển thị thông báo chào mừng sau khi đăng nhập
     */
    function showWelcomeMessage() {
        const purchasedCount = purchasedAssistants.length;
        
        if (purchasedCount > 0) {
            alert(`Chào mừng ${currentUser.email} đã đăng nhập thành công!\nBạn đã mua ${purchasedCount} trợ lý AI.`);
        } else {
            alert(`Chào mừng ${currentUser.email} đã đăng nhập thành công!\nBạn chưa mua trợ lý AI nào. Vui lòng mua để sử dụng.`);
        }
    }

    /**
     * Cập nhật giao diện dựa trên trạng thái đăng nhập
     */
    function updateUI() {
        // Cập nhật hiển thị nút đăng nhập/đăng xuất
        const loginBtn = document.getElementById('loginBtn');
        const userInfoContainer = document.getElementById('userInfoContainer');
        const loggedInUserEmail = document.getElementById('loggedInUserEmail');
        
        if (isLoggedIn()) {
            // Đã đăng nhập
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfoContainer) {
                userInfoContainer.style.display = 'block';
                if (loggedInUserEmail) {
                    loggedInUserEmail.textContent = currentUser.email;
                }
                
                // Hiển thị số lượng trợ lý đã mua
                const purchasedInfo = document.getElementById('purchasedAssistantsInfo');
                if (purchasedInfo) {
                    purchasedInfo.textContent = `Đã mua ${purchasedAssistants.length} trợ lý AI`;
                }
            }
        } else {
            // Chưa đăng nhập
            if (loginBtn) loginBtn.style.display = 'block';
            if (userInfoContainer) userInfoContainer.style.display = 'none';
        }
    }

    /**
     * Kiểm tra xem người dùng đã đăng nhập chưa
     */
    function isLoggedIn() {
        return currentUser !== null && currentUser.isAuthenticated === true;
    }

    /**
     * Kiểm tra xem người dùng có quyền sử dụng trợ lý AI cụ thể không
     */
    function canAccessAssistant(assistantId) {
        if (!isLoggedIn() || !assistantId) return false;
        
        // Kiểm tra xem assistantId có trong danh sách đã mua không
        return purchasedAssistants.includes(parseInt(assistantId, 10));
    }

    /**
     * Lấy thông tin người dùng hiện tại
     */
    function getCurrentUser() {
        return currentUser;
    }

    /**
     * Lấy danh sách trợ lý AI đã mua
     */
    function getPurchasedAssistants() {
        return purchasedAssistants;
    }

    /**
     * Xử lý khi đăng nhập thành công
     */
    function loginSuccess() {
        // Thông báo cho các thành phần khác biết về sự kiện đăng nhập thành công
        const loginSuccessEvent = new CustomEvent('login-success', {
            detail: { user: currentUser }
        });
        document.dispatchEvent(loginSuccessEvent);
        
        // Thông báo về sự thay đổi trạng thái xác thực
        const authStatusEvent = new CustomEvent('auth-status-changed', {
            detail: { isLoggedIn: true, user: currentUser }
        });
        document.dispatchEvent(authStatusEvent);
    }
    
    /**
     * Xử lý khi đăng xuất
     */
    function logoutSuccess() {
        // Thông báo cho các thành phần khác biết về sự kiện đăng xuất
        const logoutEvent = new CustomEvent('logout');
        document.dispatchEvent(logoutEvent);
        
        // Thông báo về sự thay đổi trạng thái xác thực
        const authStatusEvent = new CustomEvent('auth-status-changed', {
            detail: { isLoggedIn: false }
        });
        document.dispatchEvent(authStatusEvent);
    }

    // API công khai
    return {
        init: initialize,
        isLoggedIn: isLoggedIn,
        getCurrentUser: getCurrentUser,
        login: showLoginModal,
        logout: handleLogout,
        canAccessAssistant: canAccessAssistant,
        getPurchasedAssistants: getPurchasedAssistants
    };
})();

// Khởi tạo dịch vụ xác thực khi trang đã tải xong
document.addEventListener('DOMContentLoaded', function() {
    // Khởi tạo dịch vụ xác thực
    AuthService.init();
}); 