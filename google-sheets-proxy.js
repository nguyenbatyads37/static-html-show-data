/**
 * Google Sheets Proxy - Kết nối với Google Sheets thông qua Google Apps Script API
 * 
 * File này sẽ gọi đến Google Apps Script Web App để lấy dữ liệu thực từ Google Sheets
 * Đã điều chỉnh để phù hợp với cấu trúc dữ liệu mới
 */

const GoogleSheetsProxy = (function() {
    // Cấu hình API
    const CONFIG = {
        // URL của Google Apps Script Web App sau khi đã triển khai
        // Cần thay đổi URL này bằng URL mới được cấp sau khi triển khai lại Apps Script 
        // với các cài đặt CORS chính xác
        API_URL: 'https://script.google.com/macros/s/AKfycbywvGBkvl0SQxGDU-9iskrv4b0REp6FqsTnCh_sYEFqzIV_cULm7WYXyRBHIfx76Ccj/exec',
        
        // Thời gian cache (milliseconds) - giảm xuống 1 phút để cập nhật thường xuyên hơn
        CACHE_DURATION: 1 * 60 * 1000,
        
        // Thời gian timeout cho JSONP request (milliseconds) - giảm xuống 5 giây để phát hiện lỗi nhanh hơn
        JSONP_TIMEOUT: 5000,
        
        // Bật/tắt debug logging
        DEBUG: true,
        
        // Cấu hình polling realtime
        ENABLE_REALTIME: true,
        POLLING_INTERVAL: 30 * 1000, // Cập nhật mỗi 30 giây
        
        // Thông tin debug
        VERSION: '1.7',
        LAST_UPDATED: '2024-06-12'
    };
    
    // Cache dữ liệu
    let cache = {
        authorizedEmails: {
            data: null,
            timestamp: 0
        },
        userAssistants: {
            data: new Map(),
            timestamp: 0
        },
        assistantDetails: {
            data: new Map(),
            timestamp: 0
        }
    };
    
    // Ghi log phiên bản khi khởi tạo
    console.log(`GoogleSheetsProxy loaded - Version ${CONFIG.VERSION} (${CONFIG.LAST_UPDATED})`);
    
    /**
     * Kiểm tra xem cache có còn hiệu lực không
     * @param {number} timestamp - Thời điểm cache được tạo
     * @returns {boolean} - true nếu cache còn hiệu lực, false nếu đã hết hạn
     */
    function isCacheValid(timestamp) {
        return (Date.now() - timestamp) < CONFIG.CACHE_DURATION;
    }
    
    /**
     * Tạo callback ngẫu nhiên cho JSONP
     * @returns {string} - Tên hàm callback
     */
    function createJSONPCallback() {
        return 'jsonp_callback_' + Math.round(100000 * Math.random());
    }
    
    /**
     * Gọi API Apps Script với JSONP để tránh lỗi CORS
     * @param {string} action - Hành động cần thực hiện
     * @param {Object} params - Các tham số bổ sung
     * @returns {Promise<Object>} - Kết quả từ API
     */
    function callApi(action, params = {}) {
        return new Promise((resolve, reject) => {
            if (CONFIG.DEBUG) {
                console.log(`Gọi API với JSONP: ${action} với tham số:`, params);
                // Log URL đầy đủ để kiểm tra trực tiếp
                const tempParams = new URLSearchParams({
                    action,
                    callback: 'test_callback',
                    ...params
                });
                console.log(`URL API đầy đủ để kiểm tra: ${CONFIG.API_URL}?${tempParams.toString()}`);
            }
            
            // Tạo tên callback ngẫu nhiên
            const callbackName = createJSONPCallback();
            
            // Tạo timeout để hủy nếu quá lâu
            let timeoutId = setTimeout(() => {
                // Xóa script và callback
                if (window[callbackName]) {
                    window[callbackName] = null;
                }
                
                if (scriptElement && scriptElement.parentNode) {
                    scriptElement.parentNode.removeChild(scriptElement);
                }
                
                if (CONFIG.DEBUG) {
                    console.warn(`JSONP request timeout sau ${CONFIG.JSONP_TIMEOUT/1000} giây cho action: ${action}`);
                }
                
                reject(new Error(`API request timeout sau ${CONFIG.JSONP_TIMEOUT/1000} giây`));
            }, CONFIG.JSONP_TIMEOUT);
            
            // Tạo callback toàn cục
            window[callbackName] = function(data) {
                // Xóa timeout
                clearTimeout(timeoutId);
                
                // Xóa script và callback
                window[callbackName] = null;
                if (scriptElement && scriptElement.parentNode) {
                    scriptElement.parentNode.removeChild(scriptElement);
                }
                
                // Kiểm tra lỗi
                if (data && data.error) {
                    reject(new Error(data.message || 'Lỗi không xác định từ API'));
                } else {
                    if (CONFIG.DEBUG) {
                        console.log(`JSONP nhận được dữ liệu thành công:`, data);
                    }
                    resolve(data);
                }
            };
            
            // Xây dựng URL với tham số action, callback và các tham số khác
            const queryParams = new URLSearchParams({
                action,
                callback: callbackName,
                ...params
            });
            
            const url = `${CONFIG.API_URL}?${queryParams.toString()}`;
            
            // Tạo thẻ script
            const scriptElement = document.createElement('script');
            scriptElement.src = url;
            scriptElement.async = true;
            scriptElement.onerror = function(error) {
                // Xóa timeout
                clearTimeout(timeoutId);
                
                // Xóa callback
                window[callbackName] = null;
                
                // Xóa script
                if (scriptElement.parentNode) {
                    scriptElement.parentNode.removeChild(scriptElement);
                }
                
                // Thông báo lỗi chi tiết hơn
                if (CONFIG.DEBUG) {
                    console.error(`Lỗi khi tải script JSONP:`, error);
                    console.error(`URL không thể truy cập: ${url}`);
                    console.error(`Vui lòng kiểm tra Google Apps Script Web App và cài đặt CORS`);
                }
                
                reject(new Error('Không thể kết nối đến API. Kiểm tra lại URL và cài đặt CORS.'));
            };
            
            // Thêm vào trang
            document.body.appendChild(scriptElement);
        });
    }
    
    /**
     * Lấy danh sách email được phép truy cập
     * @returns {Promise<Array<string>>} - Danh sách email được phép
     */
    async function getAuthorizedEmails() {
        // Kiểm tra cache
        if (cache.authorizedEmails.data && isCacheValid(cache.authorizedEmails.timestamp)) {
            return cache.authorizedEmails.data;
        }
        
        try {
            // Gọi API để lấy danh sách email được phép
            const result = await callApi('getAuthorizedEmails');
            
            // Lưu vào cache
            cache.authorizedEmails = {
                data: result.emails || [],
                timestamp: Date.now()
            };
            
            return cache.authorizedEmails.data;
        } catch (error) {
            console.error('Lỗi khi lấy danh sách email được phép:', error);
            
            // Nếu có lỗi, trả về mảng rỗng
            return [];
        }
    }
    
    /**
     * Tạo dữ liệu offline khi không thể kết nối đến API
     * @param {string} email - Email của người dùng
     * @returns {Object} - Dữ liệu trợ lý mặc định
     */
    function createOfflineData(email) {
        if (CONFIG.DEBUG) {
            console.log(`Đang tạo dữ liệu offline cho: ${email}`);
        }
        
        // URL trợ lý mặc định
        const defaultAssistantUrls = {
            "trợ lý 1": "https://chatgpt.com/g/g-67bd58162bd081918a19da303fede9b5-ai-pham-van-dung-kim-cuong",
            "trợ lí 2": "https://chatgpt.com/g/g-67ff1e78cd4c81919b4d2415b87a97d4-ai-marketing-master-dinh-cao"
        };
        
        // Kiểm tra email là bucu913@gmail.com
        if (email.toLowerCase().trim() === "bucu913@gmail.com") {
            return defaultAssistantUrls;
        }
        
        // Nếu không phải email biết trước, trả về object rỗng
        return {};
    }
    
    /**
     * Lấy danh sách trợ lý AI mà người dùng đã mua trong chế độ offline
     * @param {string} email - Email của người dùng
     * @returns {Promise<Array<number>>} - Danh sách ID trợ lý AI đã mua
     */
    async function getOfflinePurchasedAssistants(email) {
        if (!email) return [];
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Lấy dữ liệu offline
        const assistantUrls = createOfflineData(normalizedEmail);
        const purchasedAssistantIds = [];
        
        // Nếu email là bucu913@gmail.com, thêm ID mặc định
        if (normalizedEmail === "bucu913@gmail.com") {
            // Thêm ID 1 và 2 cho bucu913@gmail.com
            purchasedAssistantIds.push(1, 2);
        }
        
        // Lưu vào cache
        cache.userAssistants.data.set(normalizedEmail, purchasedAssistantIds);
        cache.userAssistants.timestamp = Date.now();
        
        // Lưu các URL trợ lý
        cache.assistantDetails.data.set(normalizedEmail, assistantUrls);
        cache.assistantDetails.timestamp = Date.now();
        
        return purchasedAssistantIds;
    }
    
    /**
     * Xử lý cập nhật realtime thông qua polling
     * @param {string} email - Email người dùng
     */
    function startRealtimeUpdates(email) {
        if (!CONFIG.ENABLE_REALTIME || !email) return;
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Xóa interval cũ nếu có
        if (window._realtimeInterval) {
            clearInterval(window._realtimeInterval);
        }
        
        console.log(`Bắt đầu cập nhật realtime cho ${normalizedEmail} mỗi ${CONFIG.POLLING_INTERVAL/1000} giây`);
        
        // Tạo interval mới
        window._realtimeInterval = setInterval(async () => {
            try {
                // Tạo bản sao của dữ liệu cũ để so sánh sau khi cập nhật
                const oldAssistantIds = cache.userAssistants.data.has(normalizedEmail) 
                    ? [...cache.userAssistants.data.get(normalizedEmail)] 
                    : [];
                    
                const oldUrls = cache.assistantDetails.data.has(normalizedEmail)
                    ? {...cache.assistantDetails.data.get(normalizedEmail)}
                    : {};
                
                console.log(`Đang cập nhật dữ liệu realtime cho ${normalizedEmail}...`);
                
                // Lưu lại timestamp hiện tại
                const currentTimestamp = cache.userAssistants.timestamp;
                
                // Tạm thời vô hiệu hóa cache để buộc lấy dữ liệu mới
                cache.userAssistants.timestamp = 0;
                
                // Gọi lại API để cập nhật dữ liệu mới nhất nhưng không xóa dữ liệu cũ
                try {
                    // Sử dụng batchApiCall thay vì callApi trực tiếp để tối ưu hiệu suất
                    const result = await batchApiCall('getUserPurchasedAssistants', {
                        email: normalizedEmail
                    });
                    
                    // Nếu API trả về lỗi, giữ nguyên dữ liệu cũ
                    if (result.error) {
                        console.warn('API trả về lỗi, giữ nguyên dữ liệu cũ');
                        cache.userAssistants.timestamp = currentTimestamp;
                        return;
                    }
                    
                    // Lấy trực tiếp danh sách trợ lý đã mua từ kết quả API với cấu trúc mới
                    const newAssistantIds = result.purchasedAssistants || [];
                    
                    // Xử lý dữ liệu chi tiết trợ lý từ cấu trúc mới của API
                    const newAssistantUrls = {};
                    
                    // Kiểm tra và xử lý assistantData - cấu trúc dữ liệu mới
                    if (result.assistantData) {
                        for (const [assistantId, details] of Object.entries(result.assistantData)) {
                            // Kiểm tra xem details có hợp lệ không
                            if (details && details.url) {
                                // Lưu URL theo cả ID và tên (nếu có)
                                newAssistantUrls[assistantId] = details.url;
                                if (details.name) {
                                    newAssistantUrls[details.name] = details.url;
                                }
                            }
                        }
                    }
                    
                    // Kiểm tra xem dữ liệu mới có khác dữ liệu cũ không
                    const hasChanges = JSON.stringify(oldAssistantIds) !== JSON.stringify(newAssistantIds);
                    
                    if (hasChanges) {
                        console.log('Phát hiện thay đổi trong dữ liệu trợ lý, đang cập nhật...');
                        
                        // Cập nhật cache chỉ khi có thay đổi thực sự
                        cache.userAssistants.data.set(normalizedEmail, newAssistantIds);
                        cache.userAssistants.timestamp = Date.now();
                        
                        // Kết hợp URLs cũ và mới để giữ lại thông tin
                        const combinedUrls = {...oldUrls, ...newAssistantUrls};
                        cache.assistantDetails.data.set(normalizedEmail, combinedUrls);
                        cache.assistantDetails.timestamp = Date.now();
                        
                        // Kích hoạt sự kiện tùy chỉnh để thông báo cho UI cập nhật
                        window.dispatchEvent(new CustomEvent('assistantsDataUpdated', {
                            detail: {
                                email: normalizedEmail,
                                assistantIds: newAssistantIds,
                                timestamp: new Date().toISOString(),
                                preserveUI: true // Thông báo cho UI không reset toàn bộ
                            }
                        }));
                        
                        console.log(`Dữ liệu realtime đã được cập nhật: ${newAssistantIds.length} trợ lý`);
                    } else {
                        console.log('Không có thay đổi trong dữ liệu trợ lý');
                        // Khôi phục timestamp cũ để tránh gọi API liên tục
                        cache.userAssistants.timestamp = currentTimestamp;
                    }
                } catch (error) {
                    console.error('Lỗi khi cập nhật dữ liệu realtime:', error);
                    // Khôi phục timestamp cũ nếu có lỗi
                    cache.userAssistants.timestamp = currentTimestamp;
                }
            } catch (error) {
                console.error('Lỗi khi cập nhật dữ liệu realtime:', error);
            }
        }, CONFIG.POLLING_INTERVAL);
    }
    
    /**
     * Dừng cập nhật realtime
     */
    function stopRealtimeUpdates() {
        if (window._realtimeInterval) {
            clearInterval(window._realtimeInterval);
            window._realtimeInterval = null;
            console.log('Đã dừng cập nhật realtime');
        }
    }
    
    /**
     * Tối ưu hóa hiệu suất gọi API bằng cách gom nhóm các request
     * @type {Object} - Cache cho các request đang chờ xử lý
     */
    const pendingRequests = {};
    
    /**
     * Gọi API theo batch để tối ưu hiệu suất
     * @param {string} action - Hành động API
     * @param {Object} params - Tham số 
     * @returns {Promise<Object>} - Kết quả API
     */
    function batchApiCall(action, params = {}) {
        // Tạo key duy nhất cho request này
        const requestKey = `${action}_${JSON.stringify(params)}`;
        
        // Nếu đã có request đang chờ xử lý với cùng tham số, trả về Promise đó
        if (pendingRequests[requestKey]) {
            return pendingRequests[requestKey];
        }
        
        // Tạo Promise mới và lưu vào pendingRequests
        const promise = callApi(action, params).finally(() => {
            // Xóa khỏi pending requests khi hoàn thành
            delete pendingRequests[requestKey];
        });
        
        pendingRequests[requestKey] = promise;
        return promise;
    }
    
    /**
     * Lấy danh sách trợ lý AI mà người dùng đã mua
     * @param {string} email - Email của người dùng
     * @param {boolean} forceRefresh - Buộc làm mới dữ liệu từ API
     * @returns {Promise<Array<number>>} - Danh sách ID trợ lý AI đã mua
     */
    async function getPurchasedAssistants(email, forceRefresh = false) {
        if (!email) return [];
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Kiểm tra cache và chỉ sử dụng nếu không buộc làm mới
        if (
            !forceRefresh &&
            cache.userAssistants.data.has(normalizedEmail) && 
            isCacheValid(cache.userAssistants.timestamp)
        ) {
            return cache.userAssistants.data.get(normalizedEmail);
        }
        
        try {
            // Lưu dữ liệu cũ để tránh mất thông tin khi đang tải
            const oldData = cache.userAssistants.data.has(normalizedEmail) 
                ? cache.userAssistants.data.get(normalizedEmail) 
                : [];
                
            const oldUrls = cache.assistantDetails.data.has(normalizedEmail)
                ? cache.assistantDetails.data.get(normalizedEmail)
                : {};
            
            // Sử dụng batchApiCall thay vì callApi trực tiếp để tối ưu hiệu suất
            const result = await batchApiCall('getUserPurchasedAssistants', {
                email: normalizedEmail
            });
            
            // Lấy trực tiếp danh sách trợ lý đã mua từ kết quả API với cấu trúc mới
            const purchasedAssistantIds = result.purchasedAssistants || [];
            
            // Xử lý dữ liệu chi tiết trợ lý từ cấu trúc mới của API
            const assistantUrls = {...oldUrls}; // Bắt đầu với dữ liệu cũ để giữ lại thông tin
            
            // Kiểm tra và xử lý assistantData - cấu trúc dữ liệu mới
            if (result.assistantData) {
                for (const [assistantId, details] of Object.entries(result.assistantData)) {
                    // Kiểm tra xem details có hợp lệ không
                    if (details && details.url) {
                        // Lưu URL theo cả ID và tên (nếu có)
                        assistantUrls[assistantId] = details.url;
                        if (details.name) {
                            assistantUrls[details.name] = details.url;
                        }
                    }
                }
            }
            
            // Cập nhật cache cho danh sách trợ lý
            cache.userAssistants.data.set(normalizedEmail, purchasedAssistantIds);
            cache.userAssistants.timestamp = Date.now();
            
            // Lưu URL trợ lý trong cache
            cache.assistantDetails.data.set(normalizedEmail, assistantUrls);
            cache.assistantDetails.timestamp = Date.now();
            
            // Bắt đầu cập nhật realtime nếu được bật và chưa kích hoạt
            if (CONFIG.ENABLE_REALTIME && !window._realtimeInterval) {
                startRealtimeUpdates(normalizedEmail);
            }
            
            console.log(`Đã tải ${purchasedAssistantIds.length} trợ lý cho ${normalizedEmail}`);
            
            // Kích hoạt sự kiện khi dữ liệu được cập nhật
            if (forceRefresh) {
                window.dispatchEvent(new CustomEvent('assistantsDataUpdated', {
                    detail: {
                        email: normalizedEmail,
                        assistantIds: purchasedAssistantIds,
                        timestamp: new Date().toISOString(),
                        preserveUI: true // Thông báo UI giữ nguyên trạng thái
                    }
                }));
            }
            
            return purchasedAssistantIds;
        } catch (error) {
            console.error(`Lỗi khi lấy thông tin trợ lý AI đã mua cho ${email}:`, error);
            
            // Trả về dữ liệu cũ từ cache nếu có
            if (cache.userAssistants.data.has(normalizedEmail)) {
                console.warn('Trả về dữ liệu từ cache do lỗi khi gọi API');
                return cache.userAssistants.data.get(normalizedEmail);
            }
            
            // Nếu là lỗi kết nối và không có dữ liệu cũ, sử dụng dữ liệu offline
            console.warn('Đang sử dụng dữ liệu offline do lỗi kết nối');
            return getOfflinePurchasedAssistants(email);
        }
    }
    
    /**
     * Lấy chi tiết trợ lý AI đã mua dựa trên ID
     * @param {string} email - Email của người dùng
     * @param {number} assistantId - ID của trợ lý cần lấy thông tin
     * @returns {Promise<Object|null>} - Thông tin chi tiết của trợ lý hoặc null
     */
    async function getAssistantDetails(email, assistantId) {
        if (!email || assistantId === undefined || assistantId === null) return null;
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Đảm bảo có dữ liệu trong cache
        if (
            !cache.assistantDetails.data.has(normalizedEmail) || 
            !isCacheValid(cache.assistantDetails.timestamp)
        ) {
            // Gọi getPurchasedAssistants sẽ tự động cập nhật cache.assistantDetails
            await getPurchasedAssistants(normalizedEmail);
        }
        
        // Lấy chi tiết từ cache
        const assistantData = cache.assistantDetails.data.get(normalizedEmail);
        if (!assistantData) return null;
        
        // Trả về thông tin của trợ lý cụ thể
        return assistantData[assistantId] || null;
    }
    
    /**
     * Lấy URL của trợ lý AI
     * @param {string} email - Email của người dùng
     * @param {number} assistantId - ID của trợ lý
     * @returns {Promise<string|null>} - URL của trợ lý hoặc null nếu không tìm thấy
     */
    async function getAssistantUrl(email, assistantId) {
        if (!email) return null;
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Log để debug
        console.log(`Đang lấy URL cho trợ lý ${assistantId} của email ${normalizedEmail}`);
        
        // Kiểm tra cache trước khi làm bất kỳ thứ gì
        if (cache.assistantDetails.data.has(normalizedEmail)) {
            const assistantUrls = cache.assistantDetails.data.get(normalizedEmail);
            
            // Tìm URL trực tiếp từ cache trước
            if (assistantUrls && assistantUrls[assistantId]) {
                console.log(`Tìm thấy URL trong cache: ${assistantUrls[assistantId]}`);
                return assistantUrls[assistantId];
            }
        }
        
        // Đảm bảo dữ liệu đã được tải nếu không có trong cache
        if (
            !cache.assistantDetails.data.has(normalizedEmail) || 
            !isCacheValid(cache.assistantDetails.timestamp)
        ) {
            try {
                // Tải dữ liệu nếu chưa có
                console.log(`Dữ liệu cache không có hoặc hết hạn, đang lấy dữ liệu mới...`);
                await getPurchasedAssistants(normalizedEmail);
            } catch (error) {
                console.error('Lỗi khi tải dữ liệu trợ lý:', error);
                
                // Tải dữ liệu offline
                await getOfflinePurchasedAssistants(normalizedEmail);
            }
        }
        
        // Lấy lại dữ liệu từ cache sau khi đã cập nhật
        const assistantUrls = cache.assistantDetails.data.get(normalizedEmail) || {};
        console.log(`Dữ liệu URLs từ cache:`, assistantUrls);
        
        // Sử dụng assistantId như là key trực tiếp nếu là email cụ thể và có trong dữ liệu
        if (normalizedEmail === "bucu913@gmail.com") {
            // Kiểm tra các trường hợp đặc biệt
            if (assistantId === 1 || assistantId === "1") {
                return assistantUrls["trợ lý 1"];
            } else if (assistantId === 2 || assistantId === "2") {
                return assistantUrls["trợ lí 2"];
            }
        }
        
        // Cách 1: Tìm URL từ assistantData[assistantId]
        if (assistantUrls[assistantId]) {
            console.log(`Tìm thấy URL theo ID trực tiếp: ${assistantUrls[assistantId]}`);
            return assistantUrls[assistantId];
        }
        
        // Cách 2: Gọi trực tiếp API để lấy URL
        try {
            console.log(`Đang gọi API checkAccessAndGetUrl cho trợ lý ${assistantId}...`);
            const result = await checkAccessAndGetUrl(normalizedEmail, assistantId);
            console.log(`Kết quả API checkAccessAndGetUrl:`, result);
            
            if (result && result.canAccess && result.url) {
                // Lưu vào cache
                assistantUrls[assistantId] = result.url;
                cache.assistantDetails.data.set(normalizedEmail, assistantUrls);
                console.log(`Đã lưu URL mới vào cache: ${result.url}`);
                return result.url;
            }
        } catch (error) {
            console.error(`Lỗi khi gọi API trực tiếp:`, error);
        }
        
        // Cách 3: Tìm trong assistantData đã cache theo tên
        const assistantsData = window.assistants || [];
        const assistant = assistantsData.find(a => a.id === parseInt(assistantId, 10));
        
        if (assistant && assistant.name) {
            console.log(`Đang tìm URL cho trợ lý ${assistant.name}...`);
            
            // Tìm theo tên trợ lý
            if (assistantUrls[assistant.name]) {
                console.log(`Tìm thấy URL theo tên: ${assistantUrls[assistant.name]}`);
                return assistantUrls[assistant.name];
            }
            
            // Lặp qua tất cả URL để tìm
            for (const [key, url] of Object.entries(assistantUrls)) {
                if (typeof url === 'string' && (
                    key === assistant.name || 
                    key === assistant.id.toString() ||
                    url.includes(assistant.id.toString())
                )) {
                    console.log(`Tìm thấy URL qua so khớp: ${url}`);
                    return url;
                }
            }
        }
        
        console.warn(`Không tìm thấy URL cho trợ lý ${assistantId} của ${normalizedEmail}`);
        return null;
    }
    
    /**
     * Kiểm tra xem email đã cung cấp có trong danh sách được phép không
     * @param {string} email - Email cần kiểm tra
     * @returns {Promise<boolean>} - true nếu email được phép, false nếu không
     */
    async function isEmailAuthorized(email) {
        if (!email) return false;
        
        const authorizedEmails = await getAuthorizedEmails();
        const normalizedEmail = email.toLowerCase().trim();
        
        return authorizedEmails.includes(normalizedEmail);
    }
    
    /**
     * Kiểm tra xem người dùng có quyền sử dụng trợ lý AI cụ thể không
     * @param {string} email - Email của người dùng
     * @param {number|string} assistantId - ID của trợ lý AI
     * @returns {Promise<boolean>} - true nếu có quyền, false nếu không
     */
    async function canAccessAssistant(email, assistantId) {
        if (!email || !assistantId) return false;
        
        const normalizedEmail = email.toLowerCase().trim();
        const parsedAssistantId = parseInt(assistantId, 10);
        
        if (isNaN(parsedAssistantId)) return false;
        
        // Lấy danh sách trợ lý AI đã mua
        const purchasedAssistants = await getPurchasedAssistants(normalizedEmail);
        
        // Kiểm tra xem assistantId có trong danh sách không
        return purchasedAssistants.includes(parsedAssistantId);
    }
    
    /**
     * Xóa cache để buộc cập nhật dữ liệu từ API trong lần gọi tiếp theo
     */
    function clearCache() {
        cache.authorizedEmails = {
            data: null,
            timestamp: 0
        };
        
        cache.userAssistants = {
            data: new Map(),
            timestamp: 0
        };
        
        cache.assistantDetails = {
            data: new Map(),
            timestamp: 0
        };
        
        console.log('Đã xóa cache dữ liệu');
    }
    
    /**
     * Kiểm tra kết nối đến API
     * @returns {Promise<boolean>} - true nếu kết nối thành công, false nếu không
     */
    async function testConnection() {
        try {
            // Hiển thị URL test để kiểm tra trực tiếp trên console
            if (CONFIG.DEBUG) {
                const testUrl = `${CONFIG.API_URL}?action=test&callback=testCallback`;
                console.log('URL để kiểm tra trực tiếp trong trình duyệt:', testUrl);
                console.log('Vui lòng mở URL trên trong trình duyệt để xem phản hồi');
            }
            
            const result = await callApi('test');
            console.log('Kết quả test API:', result);
            return !result.error;
        } catch (error) {
            console.error('Lỗi khi kiểm tra kết nối API:', error);
            return false;
        }
    }
    
    /**
     * Tạo URL trực tiếp để truy cập API (không qua JSONP)
     * Hữu ích cho việc kiểm tra trực tiếp
     * @param {string} action - Hành động cần thực hiện
     * @param {Object} params - Các tham số bổ sung
     * @returns {string} - URL đầy đủ để kiểm tra
     */
    function createDirectApiUrl(action, params = {}) {
        const queryParams = new URLSearchParams({
            action,
            ...params
        });
        
        return `${CONFIG.API_URL}?${queryParams.toString()}`;
    }
    
    /**
     * Kiểm tra quyền truy cập và lấy URL cụ thể của trợ lý
     * @param {string} email - Email người dùng
     * @param {number|string} assistantId - ID của trợ lý
     * @returns {Promise<Object>} - Kết quả kiểm tra và URL
     */
    async function checkAccessAndGetUrl(email, assistantId) {
        if (!email || !assistantId) {
            return { canAccess: false, message: 'Thiếu thông tin email hoặc ID trợ lý' };
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        
        try {
            const result = await callApi('checkAccessAndGetUrl', {
                email: normalizedEmail,
                assistantId: assistantId
            });
            
            return {
                canAccess: result.canAccess,
                url: result.url,
                name: result.name,
                message: result.message
            };
        } catch (error) {
            console.error('Lỗi khi kiểm tra quyền truy cập:', error);
            return { canAccess: false, message: error.message };
        }
    }
    
    // Thêm hàm để bắt đầu lắng nghe sự kiện UI
    function initUIEventListeners() {
        // Lắng nghe sự kiện click để lưu trữ URLs tạm thời
        document.addEventListener('click', function(event) {
            // Kiểm tra xem đây có phải là nút trợ lý không
            const assistantButton = event.target.closest('.assistant-card-button, .assistant-item');
            if (assistantButton) {
                // Lưu thông tin URL của nút này vào localStorage tạm thời
                try {
                    const assistantId = assistantButton.dataset.assistantId;
                    const assistantUrl = assistantButton.dataset.url || assistantButton.href;
                    if (assistantId && assistantUrl) {
                        const tempData = JSON.parse(localStorage.getItem('tempAssistantUrls') || '{}');
                        tempData[assistantId] = assistantUrl;
                        localStorage.setItem('tempAssistantUrls', JSON.stringify(tempData));
                        console.log(`Đã lưu URL tạm thời cho trợ lý ${assistantId}: ${assistantUrl}`);
                    }
                } catch (e) {
                    console.error('Lỗi khi lưu thông tin URL tạm thời:', e);
                }
            }
        }, true);
        
        console.log('Đã khởi tạo event listeners cho UI');
    }
    
    // LINK PERSISTENCE SYSTEM - Giữ cho các nút link bot luôn hiển thị
    let linkObserver = null;
    
    /**
     * Khởi tạo hệ thống giữ link
     */
    function initLinkPersistenceSystem() {
        // Khởi tạo event listeners
        initUIEventListeners();
        
        // Tự động khôi phục link sau các hành động
        setupLinkObserver();
        
        // Thiết lập sự kiện mutation observer để phát hiện thay đổi DOM
        setupMutationObserver();
        
        // Thêm việc thiết lập listeners
        api.setupInteractionListeners();
        
        console.log('Hệ thống giữ link đã được khởi tạo');
    }
    
    /**
     * Thiết lập theo dõi thay đổi DOM để khôi phục link
     */
    function setupMutationObserver() {
        if (window.MutationObserver) {
            // Ngừng observer cũ nếu có
            if (linkObserver) {
                linkObserver.disconnect();
            }
            
            // Tạo observer mới
            linkObserver = new MutationObserver(function(mutations) {
                // Kiểm tra xem có sự kiện nào liên quan đến các nút trợ lý không
                let needRestore = false;
                
                for (const mutation of mutations) {
                    // Nếu có thêm/xóa các node
                    if (mutation.type === 'childList' || mutation.type === 'attributes') {
                        needRestore = true;
                        break;
                    }
                }
                
                // Luôn khôi phục nhiều lần để đảm bảo nút không bị mất
                if (needRestore) {
                    restoreLinksMultipleTimes(5);
                }
            });
            
            // Bắt đầu theo dõi toàn bộ document
            linkObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['href', 'data-url', 'data-assistant-id', 'style', 'class', 'display', 'visibility', 'opacity']
            });
            
            console.log('Đã thiết lập mutation observer cải tiến để theo dõi thay đổi DOM');
        }
    }
    
    /**
     * Thiết lập theo dõi link
     */
    function setupLinkObserver() {
        // Tự động khôi phục link sau khi trang đã tải
        window.addEventListener('load', function() {
            restoreLinksMultipleTimes(5);
        });
        
        // Tự động khôi phục link khi có cập nhật dữ liệu
        window.addEventListener('assistantsDataUpdated', function(e) {
            restoreLinksMultipleTimes(5);
        });
        
        // Tự động cập nhật từ UI khi chuyển đổi tab
        window.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                api.updateCacheFromUI();
                restoreLinksMultipleTimes(5);
            }
        });
        
        // Khôi phục khi có sự kiện cuộn trang
        window.addEventListener('scroll', function() {
            restoreLinksMultipleTimes(3);
        }, { passive: true });
        
        // Khôi phục khi nhấp chuột vào bất kỳ đâu trên trang
        document.addEventListener('click', function() {
            restoreLinksMultipleTimes(5);
        }, { passive: true });
        
        // Thêm khôi phục tự động định kỳ (mỗi 5 giây)
        setInterval(function() {
            api.restoreLinks();
        }, 5000);
        
        // Quan trọng: Thêm event listeners với xử lý sự kiện đặc biệt
        attachSpecialEventHandlers();
        
        console.log('Đã thiết lập các event listener cải tiến để theo dõi link');
    }
    
    /**
     * Gắn các trình xử lý sự kiện đặc biệt để ngăn chặn việc mất link
     */
    function attachSpecialEventHandlers() {
        // 1. Bảo vệ khi tìm kiếm hoặc thay đổi input
        document.addEventListener('input', function(e) {
            restoreLinksMultipleTimes(5);
        }, true);
        
        // 2. Bảo vệ khi có thay đổi form
        document.addEventListener('change', function(e) {
            restoreLinksMultipleTimes(5);
        }, true);
        
        // 3. Bảo vệ khi có thay đổi focus
        document.addEventListener('focusin', function(e) {
            setTimeout(function() {
                api.restoreLinks();
            }, 100);
        }, true);
        document.addEventListener('focusout', function(e) {
            setTimeout(function() {
                api.restoreLinks();
            }, 100);
        }, true);
        
        // 4. Bảo vệ khi có keydown (nhập liệu)
        document.addEventListener('keydown', function(e) {
            setTimeout(function() {
                api.restoreLinks();
            }, 200);
        }, true);
        
        // 5. Tạo bảo vệ cho các nút trợ lý cụ thể
        setInterval(function() {
            const assistantElements = document.querySelectorAll('.assistant-card-button, .assistant-item, [data-assistant-id]');
            if (assistantElements.length > 0) {
                api.restoreLinks();
            }
        }, 2000);
        
        // 6. Override lại một số hàm DOM có thể ẩn hoặc xóa phần tử
        overrideDomMethods();
        
        console.log('Đã thiết lập lớp bảo vệ đặc biệt cho các event');
    }
    
    /**
     * Ghi đè một số phương thức DOM để ngăn chặn việc ẩn/xóa các nút trợ lý
     */
    function overrideDomMethods() {
        try {
            // Lưu tham chiếu đến các hàm gốc
            const originalSetAttribute = Element.prototype.setAttribute;
            const originalRemoveAttribute = Element.prototype.removeAttribute;
            const originalRemoveChild = Node.prototype.removeChild;
            const originalAppendChild = Node.prototype.appendChild;
            const originalReplaceChild = Node.prototype.replaceChild;
            
            // Ghi đè hàm setAttribute để theo dõi thay đổi style
            Element.prototype.setAttribute = function(name, value) {
                const result = originalSetAttribute.call(this, name, value);
                
                // Nếu là thuộc tính style và đang thay đổi hiển thị của các nút trợ lý
                if (
                    (name === 'style' && (value.includes('display') || value.includes('visibility') || value.includes('opacity'))) ||
                    name === 'class'
                ) {
                    const isAssistantElement = this.classList?.contains('assistant-card-button') || 
                                              this.classList?.contains('assistant-item') || 
                                              this.hasAttribute?.('data-assistant-id') ||
                                              this.querySelector?.('.assistant-card-button, .assistant-item, [data-assistant-id]');
                                              
                    if (isAssistantElement) {
                        setTimeout(() => api.restoreLinks(), 0);
                        setTimeout(() => api.restoreLinks(), 100);
                        setTimeout(() => api.restoreLinks(), 300);
                    }
                }
                
                return result;
            };
            
            // Ghi đè removeChild để ngăn chặn xóa nút trợ lý
            Node.prototype.removeChild = function(child) {
                // Kiểm tra xem đây có phải là nút trợ lý không
                const isAssistantElement = child.classList?.contains('assistant-card-button') || 
                                          child.classList?.contains('assistant-item') || 
                                          child.hasAttribute?.('data-assistant-id') ||
                                          child.querySelector?.('.assistant-card-button, .assistant-item, [data-assistant-id]');
            
                // Nếu là nút trợ lý, khôi phục ngay lập tức sau khi xóa
                if (isAssistantElement) {
                    // Cho phép xóa nhưng khôi phục sau đó
                    setTimeout(() => restoreLinksMultipleTimes(5), 10);
                }
                
                // Thực hiện hành động xóa gốc
                return originalRemoveChild.call(this, child);
            };
            
            console.log('Đã ghi đè các phương thức DOM để bảo vệ nút trợ lý');
        } catch (e) {
            console.error('Lỗi khi ghi đè phương thức DOM:', e);
        }
    }
    
    /**
     * Khôi phục links nhiều lần với độ trễ khác nhau
     * @param {number} times - Số lần lặp lại
     */
    function restoreLinksMultipleTimes(times) {
        // Khôi phục ngay lập tức
        setTimeout(() => api.restoreLinks(), 0);
        
        // Khôi phục nhiều lần với các độ trễ khác nhau
        for (let i = 1; i <= times; i++) {
            setTimeout(() => api.restoreLinks(), i * 100);
        }
        
        // Thêm một lần khôi phục cuối cùng sau khoảng thời gian dài hơn
        setTimeout(() => api.restoreLinks(), times * 200);
    }
    
    // API công khai
    const api = {
        getAuthorizedEmails,
        isEmailAuthorized,
        canAccessAssistant,
        getPurchasedAssistants,
        getAssistantDetails,
        getAssistantUrl,
        checkAccessAndGetUrl,
        clearCache,
        testConnection,
        getOfflinePurchasedAssistants,
        createDirectApiUrl,
        
        // Các chức năng realtime
        startRealtimeUpdates,
        stopRealtimeUpdates,
        
        // Cấu hình realtime
        setRealtimeConfig: function(config = {}) {
            if (typeof config.enabled === 'boolean') {
                CONFIG.ENABLE_REALTIME = config.enabled;
            }
            
            if (config.interval && typeof config.interval === 'number') {
                CONFIG.POLLING_INTERVAL = config.interval;
            }
            
            console.log(`Đã cập nhật cấu hình realtime: enabled=${CONFIG.ENABLE_REALTIME}, interval=${CONFIG.POLLING_INTERVAL}ms`);
            
            // Khởi động lại realtime nếu đã có email
            const currentUser = cache.userAssistants.data.keys().next().value;
            if (currentUser && CONFIG.ENABLE_REALTIME) {
                startRealtimeUpdates(currentUser);
            }
        },
        
        // Các chức năng giữ link
        initUIEventListeners,
        initLinkPersistenceSystem,
        
        // Các hàm cập nhật và khôi phục link
        updateCacheFromUI: function() {
            try {
                // Lấy URLs đã lưu tạm thời
                const tempData = JSON.parse(localStorage.getItem('tempAssistantUrls') || '{}');
                if (Object.keys(tempData).length === 0) return;
                
                // Lấy email hiện tại
                const currentUser = cache.userAssistants.data.keys().next().value;
                if (!currentUser) return;
                
                // Cập nhật cache
                const assistantUrls = cache.assistantDetails.data.get(currentUser) || {};
                for (const [id, url] of Object.entries(tempData)) {
                    assistantUrls[id] = url;
                }
                cache.assistantDetails.data.set(currentUser, assistantUrls);
                
                console.log(`Đã cập nhật cache từ UI cho ${currentUser}:`, tempData);
            } catch (e) {
                console.error('Lỗi khi cập nhật cache từ UI:', e);
            }
        },
        
        // Thêm hàm mới để theo dõi các tương tác người dùng
        setupInteractionListeners: function() {
            // Thêm biến để debounce MutationObserver
            let debounceTimer = null;
            
            // Theo dõi các sự kiện tìm kiếm
            document.addEventListener('input', function(e) {
                if (e.target && (e.target.id === 'searchInput' || e.target.classList.contains('search-field'))) {
                    setTimeout(() => {
                        console.log('Khôi phục links sau tìm kiếm');
                        restoreLinksMultipleTimes(5);
                    }, 300);
                }
            });
            
            // Theo dõi các click vào menu, lọc, hoặc chọn trợ lý con
            document.addEventListener('click', function(e) {
                console.log('Khôi phục links sau click');
                setTimeout(() => restoreLinksMultipleTimes(5), 300);
            });
            
            // Sử dụng debounce cho MutationObserver
            const processChanges = function() {
                console.log('Xử lý thay đổi DOM');
                restoreLinksMultipleTimes(3);
            };
            
            // Theo dõi các thay đổi trong DOM với kỹ thuật debounce
            const observer = new MutationObserver(function() {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(processChanges, 300);
            });
            
            // Bắt đầu theo dõi với các tùy chọn cụ thể hơn
            observer.observe(document.body, { 
                childList: true, 
                subtree: true,
                characterData: false,
                attributeFilter: ['class', 'id', 'style'] // Chỉ quan tâm đến các thuộc tính quan trọng
            });
        },
        
        // Khôi phục URLs từ cache
        restoreLinks: function() {
            try {
                // Kiểm tra xem có phần tử nào cần khôi phục không
                const assistantElements = document.querySelectorAll('.assistant-card-button, .assistant-item, [data-assistant-id]');
                if (assistantElements.length === 0) {
                    console.log('Không tìm thấy phần tử trợ lý nào để khôi phục');
                    return 0;
                }
                
                // Lấy email hiện tại
                const currentUser = cache.userAssistants.data.keys().next().value;
                if (!currentUser) {
                    console.log('Không có người dùng hiện tại trong cache');
                    return 0;
                }
                
                // Lấy dữ liệu URLs
                const assistantUrls = cache.assistantDetails.data.get(currentUser) || {};
                
                // Kết hợp với dữ liệu tạm thời
                const tempData = JSON.parse(localStorage.getItem('tempAssistantUrls') || '{}');
                const combinedData = {...assistantUrls, ...tempData};
                
                // Debug để hiển thị dữ liệu URL đang được sử dụng
                console.log('Dữ liệu URL kết hợp:', combinedData);
                
                // Khôi phục links
                let restoredCount = 0;
                
                // Quét tất cả các phần tử trợ lý để khôi phục
                assistantElements.forEach(element => {
                    const assistantId = element.dataset.assistantId;
                    if (assistantId && combinedData[assistantId]) {
                        // Khôi phục URL
                        if (element.tagName === 'A') {
                            element.href = combinedData[assistantId];
                        }
                        element.dataset.url = combinedData[assistantId];
                        
                        // Đảm bảo phần tử hiển thị
                        if (element.style.display === 'none') {
                            element.style.display = '';
                        }
                        
                        // Loại bỏ class ẩn
                        if (element.classList.contains('hidden')) {
                            element.classList.remove('hidden');
                        }
                        
                        // Đặt opacity về 1 nếu bị ẩn
                        if (element.style.opacity === '0') {
                            element.style.opacity = '1';
                        }
                        
                        // Đặt visibility về visible
                        if (element.style.visibility === 'hidden') {
                            element.style.visibility = 'visible';
                        }
                        
                        // Đảm bảo phần tử cha hiển thị
                        let parent = element.parentElement;
                        for (let i = 0; i < 5 && parent; i++) {
                            if (parent.style.display === 'none') {
                                parent.style.display = '';
                            }
                            if (parent.classList.contains('hidden')) {
                                parent.classList.remove('hidden');
                            }
                            if (parent.style.opacity === '0') {
                                parent.style.opacity = '1';
                            }
                            if (parent.style.visibility === 'hidden') {
                                parent.style.visibility = 'visible';
                            }
                            parent = parent.parentElement;
                        }
                        
                        restoredCount++;
                    }
                });
                
                // Kiểm tra và xử lý thêm các phần tử "đã mua"
                const purchasedElements = document.querySelectorAll('.purchased-badge, .purchased-label, .purchased-tag');
                purchasedElements.forEach(element => {
                    // Tìm ID trợ lý từ phần tử cha
                    const parentCard = element.closest('[data-id], [data-assistant-id]');
                    if (parentCard) {
                        const assistantId = parentCard.dataset.id || parentCard.dataset.assistantId;
                        if (assistantId && combinedData[assistantId]) {
                            // Tạo hoặc cập nhật nút link
                            let linkBtn = parentCard.querySelector('.assistant-link');
                            if (!linkBtn) {
                                linkBtn = document.createElement('a');
                                linkBtn.className = 'assistant-link btn btn-primary btn-sm ml-2';
                                linkBtn.innerHTML = 'Truy cập';
                                linkBtn.href = combinedData[assistantId];
                                linkBtn.target = '_blank';
                                linkBtn.dataset.assistantId = assistantId;
                                parentCard.appendChild(linkBtn);
                                restoredCount++;
                            } else if (linkBtn.href !== combinedData[assistantId]) {
                                linkBtn.href = combinedData[assistantId];
                                restoredCount++;
                            }
                        }
                    }
                });
                
                if (restoredCount > 0) {
                    console.log(`Đã khôi phục ${restoredCount} URL trợ lý từ cache`);
                }
                
                return restoredCount;
            } catch (e) {
                console.error('Lỗi khi khôi phục links từ cache:', e);
                return 0;
            }
        },
        
        // Thêm hàm khôi phục liên tục nhiều lần vào API
        restoreLinksContinuously: function(times = 5) {
            restoreLinksMultipleTimes(times);
        },
        
        // Các hàm debug hiện có
        debug: function() {
            console.log('==== DEBUG GOOGLE SHEETS PROXY ====');
            console.log('Cache hiện tại:', cache);
            console.log('Cache URLs:', cache.assistantDetails.data);
            console.log('Cấu hình realtime:', {
                enabled: CONFIG.ENABLE_REALTIME,
                interval: CONFIG.POLLING_INTERVAL,
                active: !!window._realtimeInterval
            });
            
            // Kiểm tra cache cho email demo@gmail.com
            const email = 'demo@gmail.com';
            if (cache.assistantDetails.data.has(email)) {
                console.log(`Cache URLs cho ${email}:`, cache.assistantDetails.data.get(email));
            } else {
                console.log(`Không có cache URLs cho ${email}`);
            }
            
            return cache;
        },
        
        getUrlDirectly: async function(email, assistantId) {
            if (!email || !assistantId) return null;
            
            try {
                const result = await checkAccessAndGetUrl(email, assistantId);
                if (result && result.canAccess && result.url) {
                    console.log(`URL lấy trực tiếp từ API cho trợ lý ${assistantId}:`, result.url);
                    // Lưu URL mới vào cache
                    const normalizedEmail = email.toLowerCase().trim();
                    const assistantUrls = cache.assistantDetails.data.get(normalizedEmail) || {};
                    assistantUrls[assistantId] = result.url;
                    cache.assistantDetails.data.set(normalizedEmail, assistantUrls);
                    
                    // Lưu vào localStorage tạm thời
                    try {
                        const tempData = JSON.parse(localStorage.getItem('tempAssistantUrls') || '{}');
                        tempData[assistantId] = result.url;
                        localStorage.setItem('tempAssistantUrls', JSON.stringify(tempData));
                    } catch (e) {}
                    
                    return result.url;
                }
                return null;
            } catch (error) {
                console.error('Lỗi khi lấy URL trực tiếp:', error);
                return null;
            }
        },
        
        isRealtimeActive: function() {
            return !!window._realtimeInterval;
        }
    };
    
    // Tự động khởi tạo hệ thống giữ link khi script được tải
    setTimeout(function() {
        try {
            api.initLinkPersistenceSystem();
        } catch (e) {
            console.error('Lỗi khi khởi tạo hệ thống giữ link:', e);
        }
    }, 500);
    
    return api;
})();