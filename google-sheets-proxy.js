/**
 * Google Sheets Proxy - Mô phỏng kết nối với Google Sheets
 * 
 * Trong môi trường thực tế, đây nên là một API backend riêng biệt
 * sử dụng Google Sheets API với xác thực OAuth hoặc API Key
 */

const GoogleSheetsProxy = (function() {
    // Cấu hình
    const CONFIG = {
        SHEET_ID: '1qDfLjU8f_5qLJAKZnnrc6CQgGUr6IRmCIOC_a3JTA-A',
        SHEET_NAME: 'mail'
    };
    
    // Dữ liệu mẫu - Trong thực tế, dữ liệu này sẽ được lấy từ Google Sheets
    // Dựa trên dữ liệu từ Google Sheet đã cung cấp
    const MOCK_DATA = [
        ['Thời gian', 'Username', 'IP', 'Trạng thái', 'Token xác thực', 'Thời gian hết hạn', 'Purchased Assistants'],
        ['4/19/2025 20:38:40', 'bucu913', 'Unknown', 'Success', '2e53b6c9-b497-4d3c-a25f-9134c0e02d6f', '', '1,5'],
        ['4/19/2025 20:39:00', 'admin@example.com', 'Unknown', 'Success', '2f4eed4f-efb2-449c-a65c-cb9fa60a3399', '', '2,7'],
        ['4/19/2025 20:40:26', 'test@example.com', 'Unknown', 'Success', 'ffeb75d6-0179-4e9e-acd1-ccfb3f9911bf', '', '3,10'],
        ['4/20/2025 2:18:19', 'ngul', 'Unknown', 'Success', 'e2e43a65-dc6f-4c57-88f7-79d13966663b', '', '4,9'],
        ['4/20/2025 2:18:19', 'demo@gmail.com', 'Unknown', 'Success', 'e2e43a65-dc6f-4c57-88f7-79d13966663b', '', '6,8']
    ];
    
    // Cấu trúc dữ liệu người dùng - ánh xạ email đến ID trợ lý AI đã mua
    let userAssistantsMap = null;
    
    /**
     * Chuyển đổi dữ liệu thô thành danh sách email được phép
     */
    function parseAuthorizedEmails(rawData) {
        if (!rawData || !Array.isArray(rawData) || rawData.length <= 1) {
            return [];
        }
        
        // Bỏ qua hàng đầu tiên (tiêu đề) và lấy tên người dùng
        // Trong thực tế, cần thêm logic phù hợp với cấu trúc Google Sheet của bạn
        const usernames = rawData.slice(1).map(row => row[1]).filter(Boolean);
        
        // Biến đổi tên người dùng thành email
        // Đây chỉ là mô phỏng, trong thực tế cần lấy đúng cột email từ Google Sheet
        const emails = usernames.map(username => {
            // Nếu username đã là email, giữ nguyên
            if (username.includes('@')) {
                return username;
            }
            // Nếu không, thêm domain giả định
            return `${username}@gmail.com`;
        });
        
        // Loại bỏ các giá trị trùng lặp
        return [...new Set(emails)];
    }
    
    /**
     * Xây dựng bản đồ ánh xạ email của người dùng với trợ lý AI đã mua
     */
    function buildUserAssistantsMap(rawData) {
        const map = new Map();
        
        if (!rawData || !Array.isArray(rawData) || rawData.length <= 1) {
            return map;
        }
        
        // Bỏ qua hàng đầu tiên (tiêu đề) và xử lý từng hàng
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length < 7) continue;
            
            // Lấy username/email
            let email = row[1];
            if (!email) continue;
            
            // Chuyển username thành email nếu cần
            if (!email.includes('@')) {
                email = `${email}@gmail.com`;
            }
            
            // Lấy danh sách ID trợ lý AI đã mua (cột thứ 7)
            const purchasedAssistantsStr = row[6] || '';
            let purchasedAssistants = [];
            
            if (purchasedAssistantsStr) {
                // Parse danh sách ID từ chuỗi (e.g., "1,5,10")
                purchasedAssistants = purchasedAssistantsStr
                    .split(',')
                    .map(id => id.trim())
                    .filter(Boolean)
                    .map(id => parseInt(id, 10))
                    .filter(id => !isNaN(id));
            }
            
            // Lưu vào map
            map.set(email.toLowerCase(), purchasedAssistants);
        }
        
        return map;
    }
    
    /**
     * Lấy danh sách email được phép truy cập
     * Trong môi trường thực tế, hàm này sẽ gọi API để lấy dữ liệu từ Google Sheets
     */
    async function getAuthorizedEmails() {
        // Mô phỏng độ trễ khi gọi API
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
            // Mô phỏng dữ liệu từ Google Sheets
            // Trong thực tế, sẽ là một cuộc gọi fetch() đến API máy chủ
            const mockResponse = {
                values: MOCK_DATA
            };
            
            // Chuyển đổi dữ liệu thành danh sách email
            return parseAuthorizedEmails(mockResponse.values);
        } catch (error) {
            console.error('Error fetching authorized emails:', error);
            return [];
        }
    }
    
    /**
     * Lấy dữ liệu người dùng và trợ lý AI đã mua
     */
    async function getUserAssistantsMap() {
        if (userAssistantsMap) {
            return userAssistantsMap;
        }
        
        // Mô phỏng độ trễ khi gọi API
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
            // Mô phỏng dữ liệu từ Google Sheets
            const mockResponse = {
                values: MOCK_DATA
            };
            
            // Xây dựng bản đồ ánh xạ người dùng với trợ lý AI đã mua
            userAssistantsMap = buildUserAssistantsMap(mockResponse.values);
            return userAssistantsMap;
        } catch (error) {
            console.error('Error fetching user assistants data:', error);
            return new Map();
        }
    }
    
    /**
     * Kiểm tra xem email đã cung cấp có trong danh sách được phép không
     */
    async function isEmailAuthorized(email) {
        if (!email) return false;
        
        const authorizedEmails = await getAuthorizedEmails();
        const normalizedEmail = email.toLowerCase().trim();
        
        // Demo: Để test dễ dàng, chúng ta sẽ chấp nhận một số email phổ biến
        const allowList = [
            'admin@example.com',
            'test@example.com',
            'demo@gmail.com'
        ];
        
        return authorizedEmails.includes(normalizedEmail) || allowList.includes(normalizedEmail);
    }
    
    /**
     * Kiểm tra xem người dùng có quyền sử dụng trợ lý AI cụ thể không
     */
    async function canAccessAssistant(email, assistantId) {
        if (!email || !assistantId) return false;
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Lấy bản đồ người dùng - trợ lý đã mua
        const userAssistantsMap = await getUserAssistantsMap();
        
        // Lấy danh sách trợ lý AI đã mua cho email này
        const purchasedAssistants = userAssistantsMap.get(normalizedEmail) || [];
        
        // Kiểm tra xem assistantId có trong danh sách trợ lý đã mua không
        return purchasedAssistants.includes(parseInt(assistantId, 10));
    }
    
    /**
     * Lấy danh sách trợ lý AI mà người dùng đã mua
     */
    async function getPurchasedAssistants(email) {
        if (!email) return [];
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Lấy bản đồ người dùng - trợ lý đã mua
        const userAssistantsMap = await getUserAssistantsMap();
        
        // Lấy danh sách trợ lý AI đã mua cho email này
        return userAssistantsMap.get(normalizedEmail) || [];
    }
    
    // API công khai
    return {
        getAuthorizedEmails,
        isEmailAuthorized,
        canAccessAssistant,
        getPurchasedAssistants
    };
})(); 