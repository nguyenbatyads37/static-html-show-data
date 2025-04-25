/**
 * Auth Service - Hệ thống quản lý xác thực người dùng
 * Sử dụng Google Sheets API để kiểm tra quyền truy cập
 * 
 * Đã tối ưu hóa để phân tách rõ logic xác thực và UI
 * Đã điều chỉnh để phù hợp với cấu trúc dữ liệu mới
 */

const AuthService = (function() {
    // ===== PHẦN CẤU HÌNH =====
    const CONFIG = {
        // Khóa lưu trữ thông tin người dùng trong localStorage
        STORAGE_KEY: 'ai_assistant_user',
        
        // Thời gian hết hạn phiên đăng nhập (milliseconds) - 24 giờ
        SESSION_TIMEOUT: 24 * 60 * 60 * 1000
    };

    // ===== PHẦN TRẠNG THÁI DỊCH VỤ =====
    // Biến lưu trữ dữ liệu người dùng trong phiên làm việc
    let _currentUser = null;
    let _isInitialized = false;
    let _purchasedAssistants = [];
    let _allAssistantsData = [];
    let _eventHandlers = {}; // Lưu trữ event handlers để có thể gỡ bỏ sau này

    // ===== PHẦN QUẢN LÝ PHIÊN NGƯỜI DÙNG =====
    /**
     * Khởi tạo dịch vụ xác thực
     * @returns {Promise<void>}
     */
    async function initialize() {
        if (_isInitialized) return;
        
        try {
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
            
            _isInitialized = true;
            console.log('Auth Service đã khởi tạo thành công');
        } catch (error) {
            console.error('Lỗi khi khởi tạo Auth Service:', error);
        }
    }

    /**
     * Khôi phục phiên đăng nhập từ localStorage
     */
    function restoreSession() {
        try {
            const savedUserData = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (!savedUserData) return;
            
            const savedUser = JSON.parse(savedUserData);
            
            // Kiểm tra phiên có hết hạn chưa
            if (isSessionExpired(savedUser)) {
                console.log('Phiên đăng nhập đã hết hạn');
                localStorage.removeItem(CONFIG.STORAGE_KEY);
                return;
            }
            
            _currentUser = savedUser;
            console.log('Đã khôi phục phiên đăng nhập cho:', _currentUser.email);
        } catch (error) {
            console.error('Lỗi khi khôi phục phiên đăng nhập:', error);
            localStorage.removeItem(CONFIG.STORAGE_KEY);
        }
    }
    
    /**
     * Kiểm tra phiên đăng nhập đã hết hạn chưa
     * @param {Object} userData - Dữ liệu người dùng
     * @returns {boolean} - true nếu phiên đã hết hạn
     */
    function isSessionExpired(userData) {
        if (!userData || !userData.loginTime) return true;
        
        const loginTime = new Date(userData.loginTime).getTime();
        const currentTime = new Date().getTime();
        
        return (currentTime - loginTime) > CONFIG.SESSION_TIMEOUT;
    }

    /**
     * Tải dữ liệu của tất cả trợ lý AI từ danh sách
     */
    function loadAssistantsData() {
        try {
            // Lấy danh sách trợ lý từ biến toàn cục hoặc tạo mảng rỗng
            _allAssistantsData = window.assistants || [];
            console.log('Đã tải dữ liệu trợ lý:', _allAssistantsData.length > 0 ? 'Thành công' : 'Trống hoặc không tìm thấy');
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu trợ lý:', error);
            _allAssistantsData = [];
        }
    }

    // ===== PHẦN QUẢN LÝ SỰ KIỆN =====
    /**
     * Thiết lập các sự kiện liên quan đến đăng nhập/đăng xuất
     */
    function setupEventListeners() {
        // Xóa event listeners cũ (nếu có) trước khi thêm mới
        removeEventListeners();
        
        // Nút mở form đăng nhập
        _addEventHandler('click', '#loginBtn', showLoginModal);

        // Đóng form đăng nhập
        _addEventHandler('click', '#loginCloseBtn', hideLoginModal);

        // Xử lý form đăng nhập
        _addEventHandler('submit', '#loginForm', handleLogin);

        // Nút đăng xuất
        _addEventHandler('click', '#logoutBtn', handleLogout);

        // Nút chat cần kiểm tra đăng nhập và quyền truy cập
        document.addEventListener('click', handleAssistantButtonClick, true);
        _eventHandlers['assistantClick'] = handleAssistantButtonClick;

        // Đóng modal khi click bên ngoài
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            const closeModalHandler = function(e) {
                if (e.target === loginModal) {
                    hideLoginModal();
                }
            };
            loginModal.addEventListener('click', closeModalHandler);
            _eventHandlers['closeModal'] = { element: loginModal, type: 'click', handler: closeModalHandler };
        }

        // Sự kiện cho các trợ lý đã mua trong sidebar
        const sidebarHandler = function(e) {
            const sidebarAssistant = e.target.closest('.sidebar-purchased-assistant');
            if (sidebarAssistant && !e.target.closest('.assistant-url-link')) {
                const assistantId = sidebarAssistant.dataset.id;
                if (assistantId) {
                    const myAssistantsModal = document.getElementById('myAssistantsModal');
                    if (myAssistantsModal) {
                        const myAssistantsBtn = document.getElementById('myAssistantsBtn');
                        if (myAssistantsBtn) {
                            myAssistantsBtn.click();
                        } else {
                            myAssistantsModal.classList.add('active');
                        }
                    }
                }
            }
        };
        document.addEventListener('click', sidebarHandler);
        _eventHandlers['sidebarClick'] = sidebarHandler;
    }
    
    /**
     * Helper để thêm event listener với selector CSS
     * @param {string} eventType - Loại sự kiện (click, submit, v.v.)
     * @param {string} selector - CSS selector
     * @param {Function} handler - Hàm xử lý sự kiện
     */
    function _addEventHandler(eventType, selector, handler) {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener(eventType, handler);
            // Lưu để có thể gỡ bỏ sau này
            _eventHandlers[selector] = { element, type: eventType, handler };
        }
    }
    
    /**
     * Gỡ bỏ tất cả event listeners đã đăng ký
     */
    function removeEventListeners() {
        // Gỡ bỏ các event listeners cụ thể
        for (const key in _eventHandlers) {
            const handler = _eventHandlers[key];
            if (typeof handler === 'function') {
                document.removeEventListener('click', handler, true);
            } else if (handler.element && handler.type && handler.handler) {
                handler.element.removeEventListener(handler.type, handler.handler);
            }
        }
        
        // Xóa danh sách
        _eventHandlers = {};
    }
    
    /**
     * Xử lý sự kiện click vào nút trợ lý AI
     * @param {Event} e - Sự kiện click
     */
    function handleAssistantButtonClick(e) {
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
    }

    // ===== PHẦN QUẢN LÝ TRỢ LÝ AI =====
    /**
     * Lấy URL của trợ lý dựa trên code
     * @param {string} assistantCode - Mã code của trợ lý AI
     * @returns {string} - URL của trợ lý
     */
    async function getAssistantUrl(assistantCode, userEmail = null) {
        // Nếu có email người dùng và assistantCode là ID số, thử lấy URL từ Google Sheet
        if (userEmail && !isNaN(parseInt(assistantCode, 10))) {
            try {
                const assistantId = parseInt(assistantCode, 10);
                const url = await GoogleSheetsProxy.getAssistantUrl(userEmail, assistantId);
                if (url) return url;
            } catch (error) {
                console.warn('Không thể lấy URL từ Google Sheet:', error);
                // Tiếp tục với các URL mặc định
            }
        }
        
        // Chuyển đổi code về chữ thường để so sánh
        const code = typeof assistantCode === 'string' ? assistantCode.toLowerCase() : String(assistantCode).toLowerCase();
        
        // Trả về URL tương ứng với từng loại trợ lý
        if (code === 'marketing' || code.includes('market')) {
            return 'https://chatgpt.com/g/g-67ff1e78cd4c81919b4d2415b87a97d4-ai-marketing-master-dinh-cao';
        } else if (code === 'skhoe01' || code.includes('health')) {
            return 'https://chatgpt.com/g/g-67bd58162bd081918a19da303fede9b5-ai-pham-van-dung-kim-cuong';
        } else if (code === 'viet02' || code.includes('content')) {
            return 'https://chatgpt.com/g/g-85FYtUWZ3DcTJHKj7CnQP3V-ai-content-master-2023';
        } else if (code.includes('python') || code.includes('code')) {
            return 'https://chatgpt.com/g/g-9gqq4QvTH3iSISUjYSJJebs-ai-python-expert';
        } else if (code.includes('seo') || code.includes('search')) {
            return 'https://chatgpt.com/g/g-L3KX31BQG85j7HgcjhsJWKQ-ai-seo-master';
        } else {
            // URL mặc định cho các trợ lý khác
            return 'https://chatgpt.com/g/g-eVeZC163vF3jHU4HKaKDpZo-ai-assistant-default';
        }
    }

    /**
     * Tải danh sách trợ lý AI đã mua cho người dùng hiện tại
     * @returns {Promise<Array<number>>} - Danh sách ID trợ lý đã mua
     */
    async function loadPurchasedAssistants() {
        if (!isLoggedIn()) {
            _purchasedAssistants = [];
            return [];
        }
        
        try {
            // Thử kết nối đến API
            let apiActive = false;
            let connectionError = null;
            
            try {
                console.log("Đang kiểm tra kết nối API...");
                apiActive = await GoogleSheetsProxy.testConnection();
                console.log("Kết quả kiểm tra kết nối API:", apiActive);
            } catch (error) {
                console.error('Lỗi kết nối đến API:', error);
                connectionError = error;
                apiActive = false;
            }
            
            // Nếu API không hoạt động, sử dụng dữ liệu offline hoặc dữ liệu cũ
            if (!apiActive) {
                console.warn('API không hoạt động, sử dụng dữ liệu dự phòng');
                if (connectionError) {
                    console.warn('Nguyên nhân không kết nối được:', connectionError.message);
                }
                
                // Thử lấy dữ liệu offline
                try {
                    console.log("Đang lấy dữ liệu offline cho:", _currentUser.email);
                    _purchasedAssistants = await GoogleSheetsProxy.getOfflinePurchasedAssistants(_currentUser.email) || [];
                    console.log("Dữ liệu offline:", _purchasedAssistants);
                    
                    // Nếu không có dữ liệu offline mà có dữ liệu cũ, sử dụng dữ liệu cũ
                    if (_purchasedAssistants.length === 0 && _currentUser.purchasedAssistants && _currentUser.purchasedAssistants.length > 0) {
                        console.log("Sử dụng dữ liệu mua hàng từ dữ liệu người dùng cũ");
                        _purchasedAssistants = _currentUser.purchasedAssistants;
                    }
                    
                    // Cập nhật UI với dữ liệu hiện có
                    updateAssistantCardsUI();
                    updatePurchasedAssistantsSidebarUI();
                    
                    // Cập nhật dữ liệu người dùng và lưu vào localStorage
                    if (_currentUser) {
                        _currentUser.purchasedAssistants = _purchasedAssistants;
                        saveUserData();
                    }
                    
                    return _purchasedAssistants;
                } catch (offlineError) {
                    console.error('Lỗi khi tải dữ liệu offline:', offlineError);
                }
            }
            
            // Lấy danh sách trợ lý đã mua từ API
            console.log("Đang tải danh sách trợ lý đã mua từ API cho:", _currentUser.email);
            _purchasedAssistants = await GoogleSheetsProxy.getPurchasedAssistants(_currentUser.email) || [];
            console.log("Danh sách trợ lý từ API:", _purchasedAssistants);
            
            // Lưu lại danh sách vào dữ liệu người dùng hiện tại
            if (_currentUser) {
                _currentUser.purchasedAssistants = _purchasedAssistants;
                
                // Lưu lại vào localStorage
                saveUserData();
            }
            
            // Cập nhật giao diện
            updateAssistantCardsUI();
            updatePurchasedAssistantsSidebarUI();
            
            return _purchasedAssistants;
        } catch (error) {
            console.error('Lỗi khi tải danh sách trợ lý đã mua:', error);
            
            // Nếu có lỗi và có dữ liệu cũ, sử dụng dữ liệu cũ
            if (_currentUser && _currentUser.purchasedAssistants && _currentUser.purchasedAssistants.length > 0) {
                console.log("Sử dụng dữ liệu trợ lý từ cache người dùng hiện tại");
                _purchasedAssistants = _currentUser.purchasedAssistants;
                updateAssistantCardsUI();
                updatePurchasedAssistantsSidebarUI();
            } else {
                // Thử lấy dữ liệu offline nếu không có dữ liệu cũ
                try {
                    console.log("Thử tải dữ liệu offline vì không có dữ liệu cache");
                    _purchasedAssistants = await GoogleSheetsProxy.getOfflinePurchasedAssistants(_currentUser.email) || [];
                    
                    if (_purchasedAssistants.length > 0) {
                        console.log("Đã tìm thấy dữ liệu offline:", _purchasedAssistants);
                        // Cập nhật dữ liệu người dùng và lưu vào localStorage
                        if (_currentUser) {
                            _currentUser.purchasedAssistants = _purchasedAssistants;
                            saveUserData();
                        }
                        
                        // Cập nhật UI
                        updateAssistantCardsUI();
                        updatePurchasedAssistantsSidebarUI();
                    } else {
                        console.warn("Không có dữ liệu trợ lý offline");
                        _purchasedAssistants = [];
                    }
                } catch (offlineError) {
                    console.error('Lỗi khi tải dữ liệu offline:', offlineError);
                    _purchasedAssistants = [];
                }
            }
            
            return _purchasedAssistants;
        }
    }
    
    /**
     * Cập nhật hiển thị thẻ trợ lý AI dựa trên quyền truy cập
     */
    function updateAssistantCardsUI() {
        // Lấy tất cả thẻ trợ lý AI
        const assistantCards = document.querySelectorAll('.assistant-card');
        
        // Theo dõi các mã đã hiển thị để tránh trùng lặp link
        const displayedCodes = new Set();
        
        assistantCards.forEach(card => {
            const assistantId = parseInt(card.dataset.id, 10);
            const canAccess = _purchasedAssistants.includes(assistantId);
            
            // Cập nhật UI của thẻ
            if (canAccess) {
                // Đã mua - hiển thị bình thường
                card.classList.remove('not-purchased');
                card.style.opacity = '1';
                
                // Cập nhật nút - thay đổi thành "Đã mua"
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
                    // Vô hiệu hóa nút
                    chatBtn.setAttribute('disabled', 'disabled');
                    chatBtn.style.cursor = 'default';
                    
                    // Thêm URL nếu cần thiết
                    const assistantInfo = _allAssistantsData.find(a => a.id === assistantId);
                    if (assistantInfo) {
                        // Lấy URL từ GoogleSheetsProxy
                        GoogleSheetsProxy.getAssistantUrl(_currentUser.email, assistantId).then(assistantUrl => {
                            if (assistantUrl) {
                                const urlLink = document.createElement('a');
                                urlLink.href = assistantUrl;
                                urlLink.className = 'assistant-url-link-card';
                                urlLink.title = 'Truy cập URL của trợ lý';
                                urlLink.target = '_blank';
                                urlLink.innerHTML = '<i class="fas fa-external-link-alt"></i>';
                                
                                // Thêm vào bên cạnh nút
                                const cardFooter = chatBtn.parentElement;
                                if (cardFooter) {
                                    // Kiểm tra xem liên kết đã tồn tại chưa
                                    const existingLink = cardFooter.querySelector('.assistant-url-link-card');
                                    if (!existingLink) {
                                        cardFooter.appendChild(urlLink);
                                    }
                                }
                            }
                        }).catch(error => {
                            console.error('Lỗi khi lấy URL trợ lý:', error);
                        });
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
                    chatBtn.removeAttribute('disabled');
                    chatBtn.style.cursor = 'pointer';
                    
                    // Xóa liên kết nếu có
                    const cardFooter = chatBtn.parentElement;
                    if (cardFooter) {
                        const existingLink = cardFooter.querySelector('.assistant-url-link-card');
                        if (existingLink) {
                            existingLink.remove();
                        }
                    }
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
        if (!_purchasedAssistants || _purchasedAssistants.length === 0) {
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
        _purchasedAssistants.forEach(assistantId => {
            // Tìm thông tin của trợ lý dựa vào ID
            const assistantInfo = _allAssistantsData.find(a => a.id === assistantId);
            
            // Lấy chi tiết trợ lý từ Google Sheets (nếu có)
            GoogleSheetsProxy.getAssistantDetails(_currentUser.email, assistantId).then(assistantDetails => {
                // Kết hợp thông tin từ cả hai nguồn
                const name = (assistantDetails && assistantDetails.name) || 
                             (assistantInfo && assistantInfo.name) || 
                             `Trợ lý #${assistantId}`;
                             
                const image = (assistantInfo && assistantInfo.image) || 
                             '/assets/images/assistants/default-assistant.png';
                
                // Tạo phần tử danh sách mới
                const listItem = document.createElement('li');
                listItem.className = 'sidebar-purchased-assistant';
                listItem.dataset.id = assistantId;
                
                // Kiểm tra xem mã này đã được hiển thị chưa
                const codeKey = assistantInfo && assistantInfo.code 
                    ? assistantInfo.code.toLowerCase() 
                    : `id-${assistantId}`;
                
                const showLink = !displayedCodes.has(codeKey);
                if (showLink) {
                    // Thêm mã vào danh sách đã hiển thị
                    displayedCodes.add(codeKey);
                }
                
                // Lấy URL từ nhiều nguồn
                getAssistantUrl(assistantInfo ? assistantInfo.code : assistantId, _currentUser.email).then(assistantUrl => {
                    // Định dạng HTML cho mục trợ lý trong sidebar
                    listItem.innerHTML = `
                        <div class="purchased-assistant-link-wrapper">
                            <a href="javascript:void(0)" class="nav-link purchased-assistant-link">
                                <div class="purchased-assistant-avatar">
                                    <img src="${image}" alt="${name}" loading="lazy">
                                </div>
                                <span class="assistant-name-text">${name}</span>
                            </a>
                            ${showLink && assistantUrl ? `<a href="${assistantUrl}" class="assistant-url-link" title="Truy cập URL của trợ lý" target="_blank">
                                <i class="fas fa-external-link-alt"></i>
                            </a>` : ''}
                        </div>
                    `;
                    
                    // Thêm vào sidebar
                    sidebarList.appendChild(listItem);
                }).catch(error => {
                    console.error('Lỗi khi lấy URL trợ lý cho sidebar:', error);
                });
            }).catch(error => {
                console.error('Lỗi khi lấy chi tiết trợ lý:', error);
                
                // Fallback khi không lấy được chi tiết trợ lý
                if (assistantInfo) {
                    const listItem = document.createElement('li');
                    listItem.className = 'sidebar-purchased-assistant';
                    listItem.dataset.id = assistantId;
                    
                    // Định dạng HTML cho mục trợ lý trong sidebar
                    listItem.innerHTML = `
                        <div class="purchased-assistant-link-wrapper">
                            <a href="javascript:void(0)" class="nav-link purchased-assistant-link">
                                <div class="purchased-assistant-avatar">
                                    <img src="${assistantInfo.image}" alt="${assistantInfo.name}" loading="lazy">
                                </div>
                                <span class="assistant-name-text">${assistantInfo.name}</span>
                            </a>
                        </div>
                    `;
                    
                    // Thêm vào sidebar
                    sidebarList.appendChild(listItem);
                }
            });
        });
    }

    // ===== PHẦN QUẢN LÝ ĐĂNG NHẬP/ĐĂNG XUẤT =====
    /**
     * Xử lý sự kiện đăng nhập
     * @param {Event} e - Sự kiện submit form
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
                _currentUser = {
                    email: email,
                    loginTime: new Date().toISOString(),
                    isAuthenticated: true
                };
                
                // Lưu vào localStorage
                saveUserData();
                
                // Tải danh sách trợ lý AI đã mua
                await loadPurchasedAssistants();
                
                // Cập nhật UI
                updateUI();
                
                // Đóng modal
                hideLoginModal();
                
                // Hiển thị thông báo chào mừng
                showWelcomeMessage();
                
                // Phát sự kiện đăng nhập thành công
                triggerEvent('login-success', { user: _currentUser });
                triggerEvent('auth-status-changed', { isLoggedIn: true, user: _currentUser });
            } else {
                showLoginMessage('Email không có quyền truy cập. Vui lòng liên hệ quản trị viên.');
            }
        } catch (error) {
            console.error('Lỗi trong quá trình đăng nhập:', error);
            showLoginMessage('Có lỗi xảy ra. Vui lòng thử lại sau.');
        }
    }

    /**
     * Xử lý sự kiện đăng xuất
     */
    function handleLogout() {
        // Xóa thông tin người dùng
        _currentUser = null;
        _purchasedAssistants = [];
        
        // Xóa khỏi localStorage
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
        } catch (error) {
            console.error('Lỗi khi xóa dữ liệu người dùng khỏi localStorage:', error);
        }
        
        // Cập nhật UI
        updateUI();
        updateAssistantCardsUI();
        updatePurchasedAssistantsSidebarUI();
        
        // Hiển thị thông báo
        alert('Bạn đã đăng xuất thành công!');
        
        // Phát sự kiện đăng xuất
        triggerEvent('logout');
        triggerEvent('auth-status-changed', { isLoggedIn: false });
    }
    
    /**
     * Lưu dữ liệu người dùng vào localStorage
     */
    function saveUserData() {
        if (!_currentUser) return;
        
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(_currentUser));
        } catch (error) {
            console.error('Lỗi khi lưu dữ liệu người dùng vào localStorage:', error);
        }
    }

    // ===== PHẦN QUẢN LÝ UI =====
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
                    loggedInUserEmail.textContent = _currentUser.email;
                }
                
                // Hiển thị số lượng trợ lý đã mua
                const purchasedInfo = document.getElementById('purchasedAssistantsInfo');
                if (purchasedInfo) {
                    purchasedInfo.textContent = `Đã mua ${_purchasedAssistants.length} trợ lý AI`;
                }
            }
        } else {
            // Chưa đăng nhập
            if (loginBtn) loginBtn.style.display = 'block';
            if (userInfoContainer) userInfoContainer.style.display = 'none';
        }
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
     * @param {string} message - Nội dung thông báo
     * @param {boolean} isError - Có phải lỗi không
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
     * Hiển thị thông báo chào mừng sau khi đăng nhập
     */
    function showWelcomeMessage() {
        const purchasedCount = _purchasedAssistants.length;
        
        if (purchasedCount > 0) {
            alert(`Chào mừng ${_currentUser.email} đã đăng nhập thành công!\nBạn đã mua ${purchasedCount} trợ lý AI.`);
        } else {
            alert(`Chào mừng ${_currentUser.email} đã đăng nhập thành công!\nBạn chưa mua trợ lý AI nào. Vui lòng mua để sử dụng.`);
        }
    }

    // ===== PHẦN UTILITY =====
    /**
     * Phát sự kiện tùy chỉnh
     * @param {string} eventName - Tên sự kiện
     * @param {Object} data - Dữ liệu kèm theo sự kiện
     */
    function triggerEvent(eventName, data = {}) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }

    /**
     * Kiểm tra xem người dùng đã đăng nhập chưa
     * @returns {boolean} - true nếu đã đăng nhập
     */
    function isLoggedIn() {
        return _currentUser !== null && _currentUser.isAuthenticated === true;
    }

    /**
     * Kiểm tra xem người dùng có quyền sử dụng trợ lý AI cụ thể không
     * @param {number|string} assistantId - ID của trợ lý AI
     * @returns {boolean} - true nếu có quyền
     */
    function canAccessAssistant(assistantId) {
        if (!isLoggedIn() || !assistantId) return false;
        
        // Kiểm tra xem assistantId có trong danh sách đã mua không
        return _purchasedAssistants.includes(parseInt(assistantId, 10));
    }

    /**
     * Lấy thông tin người dùng hiện tại
     * @returns {Object|null} - Thông tin người dùng hoặc null nếu chưa đăng nhập
     */
    function getCurrentUser() {
        return _currentUser;
    }

    /**
     * Lấy danh sách trợ lý AI đã mua
     * @returns {Array<number>} - Danh sách ID trợ lý
     */
    function getAssistants() {
        return [..._purchasedAssistants]; // Trả về bản sao để tránh thay đổi trực tiếp
    }
    
    /**
     * Làm mới danh sách trợ lý AI đã mua
     * Hữu ích khi cần cập nhật lại sau khi mua thêm trợ lý
     * @returns {Promise<Array<number>>} - Danh sách ID trợ lý mới
     */
    async function refreshAssistants() {
        // Xóa cache trong GoogleSheetsProxy
        if (typeof GoogleSheetsProxy.clearCache === 'function') {
            GoogleSheetsProxy.clearCache();
        }
        
        // Tải lại danh sách
        return await loadPurchasedAssistants();
    }
    
    /**
     * Dọn dẹp tài nguyên khi hủy dịch vụ
     * Hữu ích khi cần gỡ bỏ hoặc làm mới trang
     */
    function dispose() {
        // Gỡ bỏ các event listeners
        removeEventListeners();
        
        // Đặt lại các biến trạng thái
        _isInitialized = false;
        console.log('Đã hủy Auth Service');
    }

    // API công khai
    return {
        init: initialize,
        isLoggedIn: isLoggedIn,
        getCurrentUser: getCurrentUser,
        login: showLoginModal,
        logout: handleLogout,
        canAccessAssistant: canAccessAssistant,
        getPurchasedAssistants: getAssistants,
        getAssistantUrl: getAssistantUrl,
        refreshAssistants: refreshAssistants,
        dispose: dispose
    };
})();

// Khởi tạo dịch vụ xác thực khi trang đã tải xong
document.addEventListener('DOMContentLoaded', function() {
    // Khởi tạo dịch vụ xác thực
    AuthService.init();
});
// Chỉnh sửa trong auth-service.js

// Thêm đoạn code này sau phần khai báo biến
async function handleLogin(e) {
    if (e) e.preventDefault();
    
    const emailInput = document.getElementById('userEmail');
    if (!emailInput) return;
    
    const email = emailInput.value.trim();
    if (!email) {
        showLoginMessage('Vui lòng nhập email');
        return;
    }
    
    try {
        showLoginMessage('Đang xác thực...', false);
        
        // Sử dụng API mới thay thế cho GoogleSheetsProxy
        const userData = await APIService.login(email);
        
        if (!userData || !userData.success) {
            showLoginMessage(userData.message || 'Đăng nhập thất bại');
            return;
        }
        
        // Lưu thông tin người dùng
        _currentUser = {
            id: userData.userId,
            email: email,
            loginTime: new Date().getTime(),
            fullName: userData.fullName || email.split('@')[0]
        };
        
        // Đóng modal đăng nhập và cập nhật UI
        hideLoginModal();
        saveUserData();
        updateUI();
        
        // Nạp danh sách trợ lý đã mua
        await refreshAssistants();
        
        return true;
    } catch (error) {
        console.error('Login error:', error);
        showLoginMessage('Lỗi xác thực, vui lòng thử lại sau');
        return false;
    }
}

// Cập nhật hàm refreshAssistants
async function refreshAssistants() {
    try {
        if (!_currentUser) return;
        
        // Sử dụng APIService thay thế cho GoogleSheetsProxy
        _purchasedAssistants = await APIService.getUserAssistants();
        
        // Cập nhật UI nếu cần
        if (typeof updateAssistantStatus === 'function') {
            updateAssistantStatus();
        }
    } catch (error) {
        console.error('Error refreshing assistants:', error);
    }
}